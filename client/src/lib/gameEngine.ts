import symbolsConfig from '../config/symbols.json';
import gameConfig from '../config/gameConfig.json';

export interface Symbol {
  id: string;
  name: string;
  weight: number;
  payouts?: {
    '12+'?: number;
    '10-11'?: number;
    '8-9'?: number;
  };
  isScatter?: boolean;
}

export interface GridCell {
  symbol: Symbol;
  row: number;
  col: number;
  id: string;
}

export interface Order {
  symbolId: string;
  quantity: number;
  collected: number;
  tipMultiplier: number;
  completed: boolean;
}

export interface CascadeStep {
  wins: { symbol: Symbol, cells: GridCell[], count: number }[];
  newGrid: GridCell[][];
}

export interface GameState {
  grid: GridCell[][];
  balance: number;
  currentBet: number;
  totalWin: number;
  isSpinning: boolean;
  isFreeSpins: boolean;
  freeSpinsRemaining: number;
  orders: Order[];
  anteMode: 'none' | 'low' | 'high';
  cascadeSteps?: CascadeStep[];
}

export class GameEngine {
  private state: GameState;
  private symbols: Symbol[];

  constructor() {
    this.symbols = symbolsConfig.symbols as Symbol[];
    this.state = this.initializeState();
  }

  private initializeState(): GameState {
    return {
      grid: this.generateInitialGrid(),
      balance: 1000000,
      currentBet: gameConfig.betting.defaultBet,
      totalWin: 0,
      isSpinning: false,
      isFreeSpins: false,
      freeSpinsRemaining: 0,
      orders: [],
      anteMode: 'none',
      cascadeSteps: []
    };
  }

  private generateInitialGrid(): GridCell[][] {
    const grid: GridCell[][] = [];
    for (let row = 0; row < symbolsConfig.gridSize.rows; row++) {
      grid[row] = [];
      for (let col = 0; col < symbolsConfig.gridSize.columns; col++) {
        grid[row][col] = {
          symbol: this.getRandomSymbol(),
          row,
          col,
          id: `${row}-${col}-${Date.now()}-${Math.random()}`
        };
      }
    }
    return grid;
  }

  private getRandomSymbol(excludeScatter: boolean = false): Symbol {
    const availableSymbols = excludeScatter ? this.symbols.filter(s => !s.isScatter) : this.symbols;
    const totalWeight = availableSymbols.reduce((sum, s) => sum + s.weight, 0);
    let random = Math.random() * totalWeight;
    
    for (const symbol of availableSymbols) {
      random -= symbol.weight;
      if (random <= 0) {
        return symbol;
      }
    }
    
    return availableSymbols[0];
  }

  public getState(): GameState {
    return { ...this.state };
  }

  public setBet(amount: number): void {
    if (amount >= gameConfig.betting.minBet && amount <= gameConfig.betting.maxBet) {
      this.state.currentBet = amount;
    }
  }

  public setAnteMode(mode: 'none' | 'low' | 'high'): void {
    this.state.anteMode = mode;
  }

  public async spin(): Promise<{ wins: any[], cascades: number, totalWin: number }> {
    if (this.state.isSpinning) return { wins: [], cascades: 0, totalWin: 0 };
    
    // Deduct bet
    let betAmount = this.state.currentBet;
    if (this.state.anteMode === 'low') {
      betAmount *= gameConfig.anteMode.lowAnteMultiplier;
    } else if (this.state.anteMode === 'high') {
      betAmount *= gameConfig.anteMode.highAnteMultiplier;
    }
    
    if (this.state.balance < betAmount) {
      throw new Error('Insufficient balance');
    }
    
    this.state.balance -= betAmount;
    this.state.isSpinning = true;
    this.state.totalWin = 0;
    this.state.cascadeSteps = [];

    // Clear orders if not in free spins mode
    if (!this.state.isFreeSpins) {
      this.state.orders = [];
    }

    // Generate order (if applicable) before grid generation
    this.generateOrder();
    
    // Generate new grid
    this.state.grid = this.generateInitialGrid();
    
    // Process cascades
    const result = await this.processCascades();
    
    // Check for free spins trigger
    this.checkFreeSpinsTrigger();
    
    // Update balance with wins
    this.state.balance += result.totalWin;
    this.state.totalWin = result.totalWin;
    this.state.isSpinning = false;
    
    // Check if orders completed (and clear if normal mode)
    this.checkOrderCompletion();
    
    // Decrement free spins if in free spins mode
    if (this.state.isFreeSpins && this.state.freeSpinsRemaining > 0) {
      this.state.freeSpinsRemaining--;
      if (this.state.freeSpinsRemaining === 0) {
        this.state.isFreeSpins = false;
        this.checkAllOrdersCompletion();
      }
    }
    
    return result;
  }

  private generateOrder(): void {
    if (this.state.isFreeSpins) return;

    let orderChance = gameConfig.orders.normalMode.chance;
    if (this.state.anteMode === 'low') {
      orderChance = gameConfig.anteMode.lowAnteOrderChance;
    } else if (this.state.anteMode === 'high') {
      orderChance = gameConfig.anteMode.highAnteOrderChance;
    }
    
    if (Math.random() < orderChance) {
      const foodSymbols = this.symbols.filter(s => !s.isScatter);
      const symbol = foodSymbols[Math.floor(Math.random() * foodSymbols.length)];
      const quantity = Math.floor(
        Math.random() * 
        (gameConfig.orders.normalMode.maxQuantity - gameConfig.orders.normalMode.minQuantity + 1)
      ) + gameConfig.orders.normalMode.minQuantity;
      
      const tipMultipliers = gameConfig.orders.normalMode.tipMultipliers;
      const tipMultiplier = tipMultipliers[Math.floor(Math.random() * tipMultipliers.length)];
      
      this.state.orders = [{
        symbolId: symbol.id,
        quantity,
        collected: 0,
        tipMultiplier,
        completed: false
      }];
    } else {
      this.state.orders = [];
    }
  }

  private async processCascades(): Promise<{ wins: any[], cascades: number, totalWin: number }> {
    let cascadeCount = 0;
    let totalWin = 0;
    const allWins: any[] = [];
    
    while (true) {
      // Find winning combinations
      const wins = this.findWinningCombinations();
      
      if (wins.length === 0) break;
      
      cascadeCount++;
      
      // Store cascade step for animation
      const stepGrid = this.cloneGrid(this.state.grid);
      this.state.cascadeSteps!.push({ wins, newGrid: stepGrid });
      
      // Calculate winnings
      for (const win of wins) {
        const payout = this.calculatePayout(win.symbol, win.count);
        totalWin += payout * this.state.currentBet;
        allWins.push({ ...win, payout });
        
        // Update order progress
        this.updateOrderProgress(win.symbol.id, win.count);
      }
      
      // Remove winning symbols
      this.removeWinningSymbols(wins);
      
      // Drop symbols down
      this.dropSymbols();
      
      // Fill empty spaces
      this.fillEmptySpaces();
    }
    
    return { wins: allWins, cascades: cascadeCount, totalWin };
  }

  private cloneGrid(grid: GridCell[][]): GridCell[][] {
    return grid.map(row => [...row]);
  }

  private findWinningCombinations(): { symbol: Symbol, cells: GridCell[], count: number }[] {
    const wins: { symbol: Symbol, cells: GridCell[], count: number }[] = [];
    const symbolGroups = new Map<string, GridCell[]>();
    
    // Group symbols
    for (let row = 0; row < this.state.grid.length; row++) {
      for (let col = 0; col < this.state.grid[row].length; col++) {
        const cell = this.state.grid[row][col];
        if (!cell || cell.symbol.isScatter) continue;
        
        const key = cell.symbol.id;
        if (!symbolGroups.has(key)) {
          symbolGroups.set(key, []);
        }
        symbolGroups.get(key)!.push(cell);
      }
    }
    
    // Check for winning combinations (8 or more)
    symbolGroups.forEach((cells, symbolId) => {
      if (cells.length >= symbolsConfig.minWinSymbols) {
        const symbol = this.symbols.find(s => s.id === symbolId)!;
        wins.push({ symbol, cells, count: cells.length });
      }
    });
    
    return wins;
  }

  private calculatePayout(symbol: Symbol, count: number): number {
    if (!symbol.payouts) return 0;
    
    if (count >= 12 && symbol.payouts['12+']) {
      return symbol.payouts['12+'];
    } else if (count >= 10 && count <= 11 && symbol.payouts['10-11']) {
      return symbol.payouts['10-11'];
    } else if (count >= 8 && count <= 9 && symbol.payouts['8-9']) {
      return symbol.payouts['8-9'];
    }
    
    return 0;
  }

  private updateOrderProgress(symbolId: string, count: number): void {
    for (const order of this.state.orders) {
      if (order.symbolId === symbolId && !order.completed) {
        order.collected = Math.min(order.collected + count, order.quantity);
      }
    }
  }

  private removeWinningSymbols(wins: { cells: GridCell[] }[]): void {
    const cellsToRemove = new Set<string>();
    
    for (const win of wins) {
      for (const cell of win.cells) {
        cellsToRemove.add(`${cell.row}-${cell.col}`);
      }
    }
    
    cellsToRemove.forEach(key => {
      const [row, col] = key.split('-').map(Number);
      // @ts-ignore
      this.state.grid[row][col] = null;
    });
  }

  private dropSymbols(): void {
    for (let col = 0; col < symbolsConfig.gridSize.columns; col++) {
      let emptyRow = symbolsConfig.gridSize.rows - 1;
      
      for (let row = symbolsConfig.gridSize.rows - 1; row >= 0; row--) {
        if (this.state.grid[row][col]) {
          if (emptyRow !== row) {
            this.state.grid[emptyRow][col] = this.state.grid[row][col];
            this.state.grid[emptyRow][col].row = emptyRow;
            // @ts-ignore
            this.state.grid[row][col] = null;
          }
          emptyRow--;
        }
      }
    }
  }

  private fillEmptySpaces(): void {
    for (let row = 0; row < symbolsConfig.gridSize.rows; row++) {
      for (let col = 0; col < symbolsConfig.gridSize.columns; col++) {
        if (!this.state.grid[row][col]) {
          this.state.grid[row][col] = {
            symbol: this.getRandomSymbol(true),
            row,
            col,
            id: `${row}-${col}-${Date.now()}-${Math.random()}`
          };
        }
      }
    }
  }

  private checkFreeSpinsTrigger(): void {
    let scatterCount = 0;
    
    for (let row = 0; row < this.state.grid.length; row++) {
      for (let col = 0; col < this.state.grid[row].length; col++) {
        const cell = this.state.grid[row][col];
        if (cell && cell.symbol.isScatter) {
          scatterCount++;
        }
      }
    }
    
    let scatterTrigger = gameConfig.freeSpins.scatterTrigger;
    if (this.state.anteMode === 'low') {
      scatterTrigger = Math.max(1, Math.floor(scatterTrigger / gameConfig.anteMode.lowAnteScatterBoost));
    } else if (this.state.anteMode === 'high') {
      scatterTrigger = Math.max(1, Math.floor(scatterTrigger / gameConfig.anteMode.highAnteScatterBoost));
    }

    if (scatterCount >= scatterTrigger && !this.state.isFreeSpins) {
      this.triggerFreeSpins();
    }
  }

  private triggerFreeSpins(): void {
    this.state.isFreeSpins = true;
    this.state.freeSpinsRemaining = gameConfig.freeSpins.spinsAwarded;
    
    const orderCount = Math.floor(
      Math.random() * 
      (gameConfig.orders.freeSpinsMode.maxOrders - gameConfig.orders.freeSpinsMode.minOrders + 1)
    ) + gameConfig.orders.freeSpinsMode.minOrders;
    
    this.state.orders = [];
    const foodSymbols = this.symbols.filter(s => !s.isScatter);
    
    for (let i = 0; i < orderCount; i++) {
      const symbol = foodSymbols[Math.floor(Math.random() * foodSymbols.length)];
      const quantity = Math.floor(
        Math.random() * 
        (gameConfig.orders.freeSpinsMode.maxQuantity - gameConfig.orders.freeSpinsMode.minQuantity + 1)
      ) + gameConfig.orders.freeSpinsMode.minQuantity;
      
      const tipMultipliers = gameConfig.orders.normalMode.tipMultipliers;
      const tipMultiplier = tipMultipliers[Math.floor(Math.random() * tipMultipliers.length)];
      
      this.state.orders.push({
        symbolId: symbol.id,
        quantity,
        collected: 0,
        tipMultiplier,
        completed: false
      });
    }
  }

  private checkOrderCompletion(): void {
    if (!this.state.isFreeSpins) {
      let orderCompleted = false;
      for (const order of this.state.orders) {
        if (order.collected >= order.quantity && !order.completed) {
          order.completed = true;
          const tip = this.state.currentBet * order.tipMultiplier;
          this.state.balance += tip;
          this.state.totalWin += tip;
          orderCompleted = true;
        }
      }
      
      if (!orderCompleted) {
        this.state.orders = [];
      }
    } else {
      for (const order of this.state.orders) {
        if (order.collected >= order.quantity && !order.completed) {
          order.completed = true;
          const tip = this.state.currentBet * order.tipMultiplier;
          this.state.balance += tip;
          this.state.totalWin += tip;
        }
      }
    }
  }

  private checkAllOrdersCompletion(): void {
    const allCompleted = this.state.orders.every(order => order.completed);
    
    if (allCompleted && this.state.orders.length > 0) {
      const superBonus = this.state.currentBet * gameConfig.orders.freeSpinsMode.superBonusMultiplier;
      this.state.balance += superBonus;
      this.state.totalWin += superBonus;
    }
    
    this.state.orders = [];
  }

  public buyFreeSpins(packageType: 'cheap' | 'standard'): void {
    const pkg = packageType === 'cheap' 
      ? gameConfig.freeSpins.cheapPackage 
      : gameConfig.freeSpins.standardPackage;
    
    if (this.state.balance < pkg.cost * this.state.currentBet) {
      throw new Error('Insufficient balance');
    }
    
    this.state.balance -= pkg.cost * this.state.currentBet;
    this.state.isFreeSpins = true;
    this.state.freeSpinsRemaining = pkg.spins;
    
    const orderCount = Math.min(pkg.maxOrders, gameConfig.orders.freeSpinsMode.maxOrders);
    this.state.orders = [];
    const foodSymbols = this.symbols.filter(s => !s.isScatter);
    
    for (let i = 0; i < orderCount; i++) {
      const symbol = foodSymbols[Math.floor(Math.random() * foodSymbols.length)];
      const quantity = Math.floor(
        Math.random() * 
        (gameConfig.orders.freeSpinsMode.maxQuantity - gameConfig.orders.freeSpinsMode.minQuantity + 1)
      ) + gameConfig.orders.freeSpinsMode.minQuantity;
      
      const tipMultiplier = pkg.tipMultipliers[Math.floor(Math.random() * pkg.tipMultipliers.length)];
      
      this.state.orders.push({
        symbolId: symbol.id,
        quantity,
        collected: 0,
        tipMultiplier,
        completed: false
      });
    }
  }
}
