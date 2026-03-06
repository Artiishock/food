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
  isNew?: boolean;
}

export interface WinInfo {
  symbol: Symbol;
  cells: GridCell[];
  count: number;
  payout: number;
}

export interface CascadeStep {
  wins: WinInfo[];
  isScatterStep: boolean;
  scatterCells: GridCell[];
  gridBeforeRemoval: GridCell[][];
  gridAfterRemoval: GridCell[][];
  gridAfterDrop: GridCell[][];
  gridAfterFill: GridCell[][];
}

export type BonusType = 'none' | 'order' | 'standard' | 'big';

export interface FreeSpinsSummary {
  totalWin: number;
  completedOrdersCount: number;
  // BIG: сколько раз заказы были выполнены (включая повторные на заменённых слотах)
  totalOrdersCompleted: number;
  packageType: 'standard' | 'big';
}

export interface GameState {
  grid: GridCell[][];
  pendingGrid: GridCell[][] | null;
  pendingOrders: Order[];
  preparedOrders: Order[];
  balance: number;
  currentBet: number;
  totalWin: number;
  isSpinning: boolean;
  isFreeSpins: boolean;
  freeSpinsRemaining: number;
  orders: Order[];
  anteMode: 'none' | 'low' | 'high';
  cascadeSteps: CascadeStep[];
  lastScatterCount: number;
  lastBonusType: BonusType;
  triggeredPackageType: 'standard' | 'big' | null;
  freeSpinsTotalWin: number;           // накопленный выигрыш за весь FS-сеанс
  freeSpinsTotalOrdersCompleted: number; // сколько раз выполнены заказы за FS
  freeSpinsPackageType: 'standard' | 'big' | null;
  // Заполняется когда FS заканчивается — показываем итоговый экран
  freeSpinsSummary: FreeSpinsSummary | null;
}

const FS_TIP_MULTIPLIERS_STANDARD = [5, 8, 10, 15, 20, 25];
const FS_TIP_MULTIPLIERS_BIG      = [8, 12, 15, 25, 35, 50, 75];

export class GameEngine {
  private state: GameState;
  private symbols: Symbol[];
  private foodSymbols: Symbol[];
  private foodTotalWeight: number;
  private allSymbols: Symbol[];

  constructor() {
    this.symbols = symbolsConfig.symbols as Symbol[];
    this.foodSymbols = this.symbols.filter(s => !s.isScatter);
    this.foodTotalWeight = this.foodSymbols.reduce((sum, s) => sum + s.weight, 0);
    this.allSymbols = this.symbols;
    this.state = this.initializeState();
  }

  private initializeState(): GameState {
    return {
      grid: this.generateInitialGrid(),
      pendingGrid: null,
      pendingOrders: [],
      preparedOrders: [],
      balance: 1000000,
      currentBet: gameConfig.betting.defaultBet,
      totalWin: 0,
      isSpinning: false,
      isFreeSpins: false,
      freeSpinsRemaining: 0,
      orders: [],
      anteMode: 'none',
      cascadeSteps: [],
      lastScatterCount: 0,
      lastBonusType: 'none',
      triggeredPackageType: null,
      freeSpinsTotalWin: 0,
      freeSpinsTotalOrdersCompleted: 0,
      freeSpinsPackageType: null,
      freeSpinsSummary: null,
    };
  }

  private generateInitialGrid(): GridCell[][] {
    const ROWS = symbolsConfig.gridSize.rows;
    const COLS = symbolsConfig.gridSize.columns;
    const TOTAL = ROWS * COLS;

    const scatterCount = this.rollScatterCount();
    const positions = new Set<number>();
    while (positions.size < scatterCount) {
      positions.add(Math.floor(Math.random() * TOTAL));
    }

    const grid: GridCell[][] = [];
    for (let row = 0; row < ROWS; row++) {
      grid[row] = [];
      for (let col = 0; col < COLS; col++) {
        const idx = row * COLS + col;
        const isScatterCell = positions.has(idx);
        grid[row][col] = {
          symbol: isScatterCell ? this.getScatterSymbol() : this.getRandomFoodSymbol(),
          row,
          col,
          id: `cell-${row}-${col}-${Date.now()}-${Math.random().toString(36).slice(2)}`
        };
      }
    }
    return grid;
  }

  private rollScatterCount(): number {
    const weights = [40, 35, 16, 7, 1.5, 0.5];
    const total = weights.reduce((a, b) => a + b, 0);
    const roll = Math.random() * total;
    let acc = 0;
    for (let i = 0; i < weights.length; i++) {
      acc += weights[i];
      if (roll < acc) return i;
    }
    return 0;
  }

  private getScatterSymbol(): Symbol {
    const scatter = this.allSymbols.find(s => s.isScatter);
    return scatter ? { ...scatter } : { ...this.foodSymbols[0] };
  }

  private getRandomFoodSymbol(): Symbol {
    const roll = Math.random() * this.foodTotalWeight;
    let accumulated = 0;
    for (const sym of this.foodSymbols) {
      accumulated += sym.weight;
      if (roll < accumulated) return { ...sym };
    }
    return { ...this.foodSymbols[this.foodSymbols.length - 1] };
  }

  private getRandomTipMultiplier(pkg?: 'standard' | 'big' | null): number {
    if (pkg === 'big') {
      const arr = FS_TIP_MULTIPLIERS_BIG;
      return arr[Math.floor(Math.random() * arr.length)];
    }
    if (pkg === 'standard') {
      const arr = FS_TIP_MULTIPLIERS_STANDARD;
      return arr[Math.floor(Math.random() * arr.length)];
    }
    const multipliers = [2, 3, 4, 5, 6, 7, 8, 9, 10];
    return multipliers[Math.floor(Math.random() * multipliers.length)];
  }

  public getState(): GameState {
    return JSON.parse(JSON.stringify(this.state));
  }

  public setBet(amount: number): void {
    if (amount >= gameConfig.betting.minBet && amount <= gameConfig.betting.maxBet) {
      this.state.currentBet = amount;
    }
  }

  public setAnteMode(mode: 'none' | 'low' | 'high'): void {
    this.state.anteMode = mode;
  }

  public prepare(): Order[] {
    if (this.state.isSpinning) return [];
    if (!this.state.isFreeSpins) this.state.orders = [];

    const grid = this.generateInitialGrid();
    this.state.pendingGrid = grid;

    const pendingOrders = this.computeOrdersFromGrid(grid);
    this.state.pendingOrders = pendingOrders;
    this.state.preparedOrders = pendingOrders.map(o => ({ ...o }));

    return pendingOrders;
  }

  private computeOrdersFromGrid(grid: GridCell[][]): Order[] {
    let scatterCount = 0;
    for (const row of grid) {
      for (const cell of row) {
        if (cell?.symbol?.isScatter) scatterCount++;
      }
    }
    this.state.lastScatterCount = scatterCount;

    if (this.state.isFreeSpins) return this.state.orders;

    if (scatterCount >= 5) {
      this.state.lastBonusType = 'big';
      return this.buildOrders(5);
    } else if (scatterCount === 4) {
      this.state.lastBonusType = 'standard';
      return this.buildOrders(3);
    } else if (scatterCount >= 1) {
      this.state.lastBonusType = 'order';
      return this.buildOrders(1);
    }

    this.state.lastBonusType = 'none';
    return [];
  }

  private buildOrders(count: number, pkg?: 'standard' | 'big' | null): Order[] {
    const orders: Order[] = [];
    for (let i = 0; i < count; i++) {
      orders.push(this.buildSingleOrder(pkg));
    }
    return orders;
  }

  private buildSingleOrder(pkg?: 'standard' | 'big' | null): Order {
    const symbol = this.foodSymbols[Math.floor(Math.random() * this.foodSymbols.length)];
    const quantity = Math.floor(Math.random() * 11) + 10;
    const tipMultiplier = this.getRandomTipMultiplier(pkg);
    return { symbolId: symbol.id, quantity, collected: 0, tipMultiplier, completed: false };
  }

  public async spin(): Promise<{ wins: WinInfo[], cascades: number, totalWin: number }> {
    if (this.state.isSpinning) return { wins: [], cascades: 0, totalWin: 0 };

    // Сбрасываем summary предыдущего сеанса
    this.state.freeSpinsSummary = null;

    let betAmount = this.state.currentBet;
    if (this.state.anteMode === 'low') betAmount *= gameConfig.anteMode.lowAnteMultiplier;
    else if (this.state.anteMode === 'high') betAmount *= gameConfig.anteMode.highAnteMultiplier;

    if (this.state.balance < betAmount) throw new Error('Insufficient balance');

    this.state.balance -= betAmount;
    this.state.isSpinning = true;
    this.state.totalWin = 0;
    this.state.cascadeSteps = [];
    this.state.lastBonusType = 'none';
    this.state.lastScatterCount = 0;
    this.state.triggeredPackageType = null;

    if (this.state.pendingGrid) {
      this.state.grid = this.state.pendingGrid;
      this.state.pendingGrid = null;
    } else {
      if (!this.state.isFreeSpins) this.state.orders = [];
      this.state.grid = this.generateInitialGrid();
      this.checkScatterAndOrders();
    }

    if (this.state.pendingOrders.length > 0) {
      this.state.orders = this.state.pendingOrders;
      this.state.pendingOrders = [];
    }

    const result = await this.processCascades();

    this.state.balance += result.totalWin;
    this.state.totalWin = result.totalWin;
    this.state.isSpinning = false;

    this.checkOrderCompletion();

    if (this.state.isFreeSpins && this.state.freeSpinsRemaining > 0) {
      this.state.freeSpinsRemaining--;

      if (this.state.freeSpinsRemaining === 0) {
        // FS закончились — формируем summary и сбрасываем сеанс
        this.finishFreeSpins();
      }
    }

    return result;
  }

  private finishFreeSpins(): void {
    // Начисляем супербонус если все заказы выполнены (только STANDARD — BIG заменяет заказы)
    let superBonus = 0;
    if (this.state.freeSpinsPackageType === 'standard') {
      const allCompleted = this.state.orders.length > 0 &&
                           this.state.orders.every(o => o.completed);
      if (allCompleted) {
        superBonus = this.state.currentBet * gameConfig.orders.freeSpinsMode.superBonusMultiplier;
        this.state.balance += superBonus;
        this.state.totalWin += superBonus;
        this.state.freeSpinsTotalWin += superBonus;
      }
    }

    this.state.freeSpinsSummary = {
      totalWin: this.state.freeSpinsTotalWin,
      completedOrdersCount: this.state.orders.filter(o => o.completed).length,
      totalOrdersCompleted: this.state.freeSpinsTotalOrdersCompleted,
      packageType: this.state.freeSpinsPackageType ?? 'standard',
    };

    // Сброс FS-состояния
    this.state.isFreeSpins = false;
    this.state.freeSpinsTotalWin = 0;
    this.state.freeSpinsTotalOrdersCompleted = 0;
    this.state.freeSpinsPackageType = null;
    this.state.orders = [];
  }

  private async processCascades(): Promise<{ wins: WinInfo[], cascades: number, totalWin: number }> {
    let cascadeCount = 0;
    let totalWin = 0;
    const allWins: WinInfo[] = [];

    const scatterCells = this.findScatterCells(this.state.grid);
    if (scatterCells.length > 0) {
      const gridBeforeRemoval = this.cloneGrid(this.state.grid);
      this.removeScatterCells(scatterCells);
      const gridAfterRemoval = this.cloneGrid(this.state.grid);
      this.dropSymbols();
      const gridAfterDrop = this.cloneGrid(this.state.grid);
      this.fillEmptySpaces();
      const gridAfterFill = this.cloneGrid(this.state.grid);
      this.state.cascadeSteps.push({
        wins: [], isScatterStep: true, scatterCells,
        gridBeforeRemoval, gridAfterRemoval, gridAfterDrop, gridAfterFill
      });
    }

    while (true) {
      const wins = this.findWinningCombinations(this.state.grid);
      if (wins.length === 0) break;

      cascadeCount++;
      for (const win of wins) {
        const payout = this.calculatePayout(win.symbol, win.count);
        win.payout = payout * this.state.currentBet;
        totalWin += win.payout;
        allWins.push(win);
        this.updateOrderProgress(win.symbol.id, win.count);
      }

      const gridBeforeRemoval = this.cloneGrid(this.state.grid);
      this.removeWinningSymbols(wins);
      const gridAfterRemoval = this.cloneGrid(this.state.grid);
      this.dropSymbols();
      const gridAfterDrop = this.cloneGrid(this.state.grid);
      this.fillEmptySpaces();
      const gridAfterFill = this.cloneGrid(this.state.grid);

      this.state.cascadeSteps.push({
        wins, isScatterStep: false, scatterCells: [],
        gridBeforeRemoval, gridAfterRemoval, gridAfterDrop, gridAfterFill
      });
    }

    return { wins: allWins, cascades: cascadeCount, totalWin };
  }

  private findScatterCells(grid: GridCell[][]): GridCell[] {
    const cells: GridCell[] = [];
    for (const row of grid) {
      for (const cell of row) {
        if (cell?.symbol?.isScatter) cells.push({ ...cell, symbol: { ...cell.symbol } });
      }
    }
    return cells;
  }

  private removeScatterCells(scatterCells: GridCell[]): void {
    for (const cell of scatterCells) {
      if (this.state.grid[cell.row]?.[cell.col]) {
        (this.state.grid[cell.row][cell.col] as any) = null;
      }
    }
  }

  private checkScatterAndOrders(): void {
    let scatterCount = 0;
    for (const row of this.state.grid) {
      for (const cell of row) {
        if (cell?.symbol?.isScatter) scatterCount++;
      }
    }
    this.state.lastScatterCount = scatterCount;
    if (this.state.isFreeSpins) return;

    if (scatterCount >= 5) {
      this.state.lastBonusType = 'big';
      this.triggerBigBonus();
    } else if (scatterCount === 4) {
      this.state.lastBonusType = 'standard';
      this.triggerStandardBonus();
    } else if (scatterCount >= 1) {
      this.state.lastBonusType = 'order';
      this.state.orders = this.buildOrders(1);
    }
  }

  private triggerStandardBonus(): void {
    this.state.isFreeSpins = true;
    this.state.freeSpinsRemaining = 10;
    this.state.freeSpinsTotalWin = 0;
    this.state.freeSpinsTotalOrdersCompleted = 0;
    this.state.triggeredPackageType = 'standard';
    this.state.freeSpinsPackageType = 'standard';
    this.state.orders = this.buildOrders(5, 'standard');
  }

  private triggerBigBonus(): void {
    this.state.isFreeSpins = true;
    this.state.freeSpinsRemaining = 10;
    this.state.freeSpinsTotalWin = 0;
    this.state.freeSpinsTotalOrdersCompleted = 0;
    this.state.triggeredPackageType = 'big';
    this.state.freeSpinsPackageType = 'big';
    const orderCount = Math.random() < 0.5 ? 5 : 6;
    this.state.orders = this.buildOrders(orderCount, 'big');
  }

  private findWinningCombinations(grid: GridCell[][]): WinInfo[] {
    const ROWS = symbolsConfig.gridSize.rows;
    const COLS = symbolsConfig.gridSize.columns;
    const groups = new Map<string, GridCell[]>();

    for (let row = 0; row < ROWS; row++) {
      if (!grid[row]) continue;
      for (let col = 0; col < COLS; col++) {
        const cell = grid[row][col];
        if (!cell?.symbol || cell.symbol.isScatter) continue;
        const sid = cell.symbol.id;
        if (!sid) continue;
        if (!groups.has(sid)) groups.set(sid, []);
        groups.get(sid)!.push({ symbol: { ...cell.symbol }, row: cell.row, col: cell.col, id: cell.id });
      }
    }

    const wins: WinInfo[] = [];
    groups.forEach((cells, symbolId) => {
      if (cells.length < symbolsConfig.minWinSymbols) return;
      const symbolDef = this.foodSymbols.find(s => s.id === symbolId);
      if (!symbolDef) return;
      wins.push({ symbol: { ...symbolDef }, cells, count: cells.length, payout: 0 });
    });

    return wins;
  }

  private calculatePayout(symbol: Symbol, count: number): number {
    if (!symbol.payouts) return 0;
    if (count >= 12) return symbol.payouts['12+'] ?? 0;
    if (count >= 10) return symbol.payouts['10-11'] ?? 0;
    if (count >= 8)  return symbol.payouts['8-9'] ?? 0;
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
    for (const win of wins) {
      for (const cell of win.cells) {
        if (this.state.grid[cell.row]?.[cell.col]) {
          (this.state.grid[cell.row][cell.col] as any) = null;
        }
      }
    }
  }

  private dropSymbols(): void {
    for (let col = 0; col < symbolsConfig.gridSize.columns; col++) {
      const survivors: GridCell[] = [];
      for (let row = symbolsConfig.gridSize.rows - 1; row >= 0; row--) {
        const cell = this.state.grid[row][col];
        if (cell?.symbol) survivors.push(cell);
      }
      for (let row = 0; row < symbolsConfig.gridSize.rows; row++) {
        (this.state.grid[row][col] as any) = null;
      }
      let writeRow = symbolsConfig.gridSize.rows - 1;
      for (const cell of survivors) {
        cell.row = writeRow;
        cell.col = col;
        this.state.grid[writeRow][col] = cell;
        writeRow--;
      }
    }
  }

  private fillEmptySpaces(): void {
    for (let row = 0; row < symbolsConfig.gridSize.rows; row++) {
      for (let col = 0; col < symbolsConfig.gridSize.columns; col++) {
        if (!this.state.grid[row][col]?.symbol) {
          this.state.grid[row][col] = {
            symbol: this.getRandomFoodSymbol(),
            row, col,
            id: `cell-${row}-${col}-${Date.now()}-${Math.random().toString(36).slice(2)}`
          };
        }
      }
    }
  }

  private cloneGrid(grid: GridCell[][]): GridCell[][] {
    return grid.map(row =>
      row.map(cell => cell == null ? null as any : { ...cell, symbol: { ...cell.symbol } })
    );
  }

  private checkOrderCompletion(): void {
    const pkg = this.state.freeSpinsPackageType;

    for (let i = 0; i < this.state.orders.length; i++) {
      const order = this.state.orders[i];
      if (order.collected >= order.quantity && !order.completed) {
        order.completed = true;
        const tip = this.state.currentBet * order.tipMultiplier;
        this.state.balance += tip;
        this.state.totalWin += tip;

        if (this.state.isFreeSpins) {
          this.state.freeSpinsTotalWin += tip;
          this.state.freeSpinsTotalOrdersCompleted++;

          if (pkg === 'big') {
            // BIG: заменяем выполненный заказ новым (конвейер продолжается)
            const newOrder = this.buildSingleOrder('big');
            newOrder.isNew = true;
            this.state.orders[i] = newOrder;
          }
          // STANDARD: оставляем заказ как completed, ничего не заменяем
        }
      }
    }
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
    this.state.freeSpinsTotalWin = 0;
    this.state.freeSpinsTotalOrdersCompleted = 0;
    this.state.freeSpinsSummary = null;

    if (packageType === 'cheap') {
      this.state.triggeredPackageType = 'standard';
      this.state.freeSpinsPackageType = 'standard';
      this.state.orders = this.buildOrders(5, 'standard');
    } else {
      this.state.triggeredPackageType = 'big';
      this.state.freeSpinsPackageType = 'big';
      this.state.orders = this.buildOrders(5, 'big');
    }
  }
}