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

export interface WinInfo {
  symbol: Symbol;
  cells: GridCell[];
  count: number;
  payout: number;
}

export interface CascadeStep {
  wins: WinInfo[];
  gridBeforeRemoval: GridCell[][];
  gridAfterRemoval: GridCell[][];
  gridAfterDrop: GridCell[][];
  gridAfterFill: GridCell[][];
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
  cascadeSteps: CascadeStep[];
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
          symbol: this.getRandomSymbol(true),
          row,
          col,
          id: `cell-${row}-${col}-${Date.now()}-${Math.random().toString(36)}`
        };
      }
    }
    return grid;
  }

  private getRandomSymbol(excludeScatter: boolean = false): Symbol {
    const availableSymbols = excludeScatter 
      ? this.symbols.filter(s => !s.isScatter) 
      : this.symbols;
    
    const totalWeight = availableSymbols.reduce((sum, s) => sum + s.weight, 0);
    let random = Math.random() * totalWeight;
    
    for (const symbol of availableSymbols) {
      random -= symbol.weight;
      if (random <= 0) {
        return { ...symbol }; // Clone to avoid reference issues
      }
    }
    
    return { ...availableSymbols[0] };
  }

  public getState(): GameState {
    return JSON.parse(JSON.stringify(this.state)); // Deep clone
  }

  public setBet(amount: number): void {
    if (amount >= gameConfig.betting.minBet && amount <= gameConfig.betting.maxBet) {
      this.state.currentBet = amount;
    }
  }

  public setAnteMode(mode: 'none' | 'low' | 'high'): void {
    this.state.anteMode = mode;
  }

  public async spin(): Promise<{ wins: WinInfo[], cascades: number, totalWin: number }> {
    if (this.state.isSpinning) {
      return { wins: [], cascades: 0, totalWin: 0 };
    }
    
    // Calculate bet with ante
    let betAmount = this.state.currentBet;
    if (this.state.anteMode === 'low') {
      betAmount *= gameConfig.anteMode.lowAnteMultiplier;
    } else if (this.state.anteMode === 'high') {
      betAmount *= gameConfig.anteMode.highAnteMultiplier;
    }
    
    if (this.state.balance < betAmount) {
      throw new Error('Insufficient balance');
    }
    
    // Deduct bet
    this.state.balance -= betAmount;
    this.state.isSpinning = true;
    this.state.totalWin = 0;
    this.state.cascadeSteps = [];

    // Generate order if not in free spins
    if (!this.state.isFreeSpins) {
      this.state.orders = [];
      this.generateOrder();
    }

    // Generate new grid
    this.state.grid = this.generateInitialGrid();
    
    console.log('🎰 Initial Grid:');
    this.debugGrid(this.state.grid);
    
    // Process cascades
    const result = await this.processCascades();
    
    // Check for free spins trigger
    this.checkFreeSpinsTrigger();
    
    // Add winnings
    this.state.balance += result.totalWin;
    this.state.totalWin = result.totalWin;
    this.state.isSpinning = false;
    
    // Check order completion
    this.checkOrderCompletion();
    
    // Handle free spins countdown
    if (this.state.isFreeSpins && this.state.freeSpinsRemaining > 0) {
      this.state.freeSpinsRemaining--;
      if (this.state.freeSpinsRemaining === 0) {
        this.state.isFreeSpins = false;
        this.checkAllOrdersCompletion();
      }
    }
    
    return result;
  }

  private async processCascades(): Promise<{ wins: WinInfo[], cascades: number, totalWin: number }> {
    let cascadeCount = 0;
    let totalWin = 0;
    const allWins: WinInfo[] = [];
    
    // Keep processing until no more wins
    while (true) {
      // Find winning combinations in current grid
      const wins = this.findWinningCombinations(this.state.grid);
      
      if (wins.length === 0) {
        console.log('✅ No more wins, cascades complete');
        break;
      }
      
      cascadeCount++;
      console.log(`💥 CASCADE #${cascadeCount}:`);
      
      // Log what was found
      wins.forEach(win => {
        console.log(`  - Found ${win.count}x ${win.symbol.name} (${win.symbol.id})`);
        console.log(`    Positions:`, win.cells.map(c => `(${c.row},${c.col})`).join(', '));
      });
      
      // Calculate winnings
      for (const win of wins) {
        const payout = this.calculatePayout(win.symbol, win.count);
        win.payout = payout * this.state.currentBet;
        totalWin += win.payout;
        allWins.push(win);
        
        // Update order progress
        this.updateOrderProgress(win.symbol.id, win.count);
      }
      
      // Save state before removal
      const gridBeforeRemoval = this.cloneGrid(this.state.grid);
      
      // Remove winning symbols
      this.removeWinningSymbols(wins);
      const gridAfterRemoval = this.cloneGrid(this.state.grid);
      
      // Drop symbols
      this.dropSymbols();
      const gridAfterDrop = this.cloneGrid(this.state.grid);
      
      // Fill empty spaces
      this.fillEmptySpaces();
      const gridAfterFill = this.cloneGrid(this.state.grid);
      
      console.log('🔄 Grid after cascade:');
      this.debugGrid(gridAfterFill);
      
      // Store cascade step
      this.state.cascadeSteps.push({
        wins,
        gridBeforeRemoval,
        gridAfterRemoval,
        gridAfterDrop,
        gridAfterFill
      });
    }
    
    console.log(`🎉 Total: ${cascadeCount} cascades, ${totalWin} win`);
    return { wins: allWins, cascades: cascadeCount, totalWin };
  }

  private findWinningCombinations(grid: GridCell[][]): WinInfo[] {
    const wins: WinInfo[] = [];
    
    // Create a map to group cells by symbol ID (NOT by position!)
    const symbolGroups = new Map<string, GridCell[]>();
    
    // Scan entire grid
    for (let row = 0; row < grid.length; row++) {
      for (let col = 0; col < grid[row].length; col++) {
        const cell = grid[row][col];
        
        // Skip null cells or scatters
        if (!cell || !cell.symbol || cell.symbol.isScatter) {
          continue;
        }
        
        const symbolId = cell.symbol.id;
        
        // Group by symbol ID
        if (!symbolGroups.has(symbolId)) {
          symbolGroups.set(symbolId, []);
        }
        
        symbolGroups.get(symbolId)!.push(cell);
      }
    }
    
    // Check each group for 8+ matches
    symbolGroups.forEach((cells, symbolId) => {
      if (cells.length >= symbolsConfig.minWinSymbols) {
        // Find the symbol definition
        const symbol = this.symbols.find(s => s.id === symbolId);
        
        if (symbol) {
          wins.push({ 
            symbol: { ...symbol }, // Clone
            cells: cells.map(c => ({ ...c })), // Clone cells
            count: cells.length,
            payout: 0
          });
        }
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

  private removeWinningSymbols(wins: WinInfo[]): void {
    // Mark cells for removal by setting them to null
    for (const win of wins) {
      for (const cell of win.cells) {
        // Find and nullify the cell in the grid
        if (this.state.grid[cell.row] && this.state.grid[cell.row][cell.col]) {
          (this.state.grid[cell.row][cell.col] as any) = null;
        }
      }
    }
  }

  private dropSymbols(): void {
    // Process each column independently
    for (let col = 0; col < symbolsConfig.gridSize.columns; col++) {
      // Collect non-null cells from this column (bottom to top)
      const nonNullCells: GridCell[] = [];
      
      for (let row = symbolsConfig.gridSize.rows - 1; row >= 0; row--) {
        const cell = this.state.grid[row][col];
        if (cell) {
          nonNullCells.push(cell);
        }
      }
      
      // Clear the column
      for (let row = 0; row < symbolsConfig.gridSize.rows; row++) {
        (this.state.grid[row][col] as any) = null;
      }
      
      // Place non-null cells at the bottom
      let writeRow = symbolsConfig.gridSize.rows - 1;
      for (const cell of nonNullCells) {
        cell.row = writeRow;
        cell.col = col;
        this.state.grid[writeRow][col] = cell;
        writeRow--;
      }
    }
  }

  private fillEmptySpaces(): void {
    // Fill all null cells with new symbols
    for (let row = 0; row < symbolsConfig.gridSize.rows; row++) {
      for (let col = 0; col < symbolsConfig.gridSize.columns; col++) {
        if (!this.state.grid[row][col]) {
          this.state.grid[row][col] = {
            symbol: this.getRandomSymbol(true), // No scatters
            row,
            col,
            id: `cell-${row}-${col}-${Date.now()}-${Math.random().toString(36)}`
          };
        }
      }
    }
  }

  private cloneGrid(grid: GridCell[][]): GridCell[][] {
    return grid.map(row => 
      row.map(cell => cell ? { 
        ...cell, 
        symbol: { ...cell.symbol } 
      } : null)
    ).filter(row => row !== null) as GridCell[][];
  }

  private debugGrid(grid: GridCell[][]): void {
    console.log('Grid state:');
    for (let row = 0; row < grid.length; row++) {
      const rowStr = grid[row].map(cell => 
        cell ? `${cell.symbol.name.substring(0, 3)}` : '---'
      ).join(' ');
      console.log(`  Row ${row}: ${rowStr}`);
    }
  }

  private checkFreeSpinsTrigger(): void {
    let scatterCount = 0;
    
    for (let row = 0; row < this.state.grid.length; row++) {
      for (let col = 0; col < this.state.grid[row].length; col++) {
        const cell = this.state.grid[row][col];
        if (cell && cell.symbol && cell.symbol.isScatter) {
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

  private generateOrder(): void {
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