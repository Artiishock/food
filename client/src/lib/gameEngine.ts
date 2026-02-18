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
  // Предвычисленные массивы для быстрого доступа
  private foodSymbols: Symbol[];
  private foodTotalWeight: number;

  constructor() {
    this.symbols = symbolsConfig.symbols as Symbol[];
    this.foodSymbols = this.symbols.filter(s => !s.isScatter);
    this.foodTotalWeight = this.foodSymbols.reduce((sum, s) => sum + s.weight, 0);
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
          symbol: this.getRandomFoodSymbol(),
          row,
          col,
          id: `cell-${row}-${col}-${Date.now()}-${Math.random().toString(36).slice(2)}`
        };
      }
    }
    return grid;
  }

  /**
   * Возвращает случайный символ еды (без scatter).
   * Использует предвычисленный список и общий вес для корректного взвешенного выбора.
   * Гарантирует возврат символа даже при edge cases с floating point.
   */
  private getRandomFoodSymbol(): Symbol {
    const roll = Math.random() * this.foodTotalWeight;
    let accumulated = 0;

    for (let i = 0; i < this.foodSymbols.length; i++) {
      accumulated += this.foodSymbols[i].weight;
      if (roll < accumulated) {
        // Глубокое клонирование чтобы каждая ячейка имела свой объект символа
        return { ...this.foodSymbols[i] };
      }
    }

    // Fallback: последний символ (не первый!) — так распределение точнее
    return { ...this.foodSymbols[this.foodSymbols.length - 1] };
  }

  /**
   * Возвращает случайный символ включая scatter (для проверки триггера)
   */
  private getRandomSymbolWithScatter(): Symbol {
    const total = this.symbols.reduce((sum, s) => sum + s.weight, 0);
    const roll = Math.random() * total;
    let accumulated = 0;

    for (let i = 0; i < this.symbols.length; i++) {
      accumulated += this.symbols[i].weight;
      if (roll < accumulated) {
        return { ...this.symbols[i] };
      }
    }

    return { ...this.symbols[this.symbols.length - 1] };
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

  public async spin(): Promise<{ wins: WinInfo[], cascades: number, totalWin: number }> {
    if (this.state.isSpinning) {
      return { wins: [], cascades: 0, totalWin: 0 };
    }

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

    if (!this.state.isFreeSpins) {
      this.state.orders = [];
      this.generateOrder();
    }

    this.state.grid = this.generateInitialGrid();

    const result = await this.processCascades();

    this.checkFreeSpinsTrigger();

    this.state.balance += result.totalWin;
    this.state.totalWin = result.totalWin;
    this.state.isSpinning = false;

    this.checkOrderCompletion();

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

    while (true) {
      const wins = this.findWinningCombinations(this.state.grid);

      if (wins.length === 0) {
        break;
      }

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
        wins,
        gridBeforeRemoval,
        gridAfterRemoval,
        gridAfterDrop,
        gridAfterFill
      });
    }

    return { wins: allWins, cascades: cascadeCount, totalWin };
  }

  /**
   * ИСПРАВЛЕННАЯ победная логика.
   *
   * Алгоритм:
   * 1. Сканируем всю сетку
   * 2. Группируем ячейки строго по symbol.id (строковый ключ)
   * 3. Группы с 8+ ячейками = победа
   *
   * Защиты:
   * - Пропускаем null/undefined ячейки
   * - Пропускаем ячейки без symbol или с пустым id
   * - Пропускаем scatter символы
   * - Клонируем ячейки перед добавлением в группу
   */
  private findWinningCombinations(grid: GridCell[][]): WinInfo[] {
    const ROWS = symbolsConfig.gridSize.rows;
    const COLS = symbolsConfig.gridSize.columns;

    // Map: symbolId → список ячеек с этим символом
    const groups = new Map<string, GridCell[]>();

    for (let row = 0; row < ROWS; row++) {
      if (!grid[row]) continue;

      for (let col = 0; col < COLS; col++) {
        const cell = grid[row][col];

        // Защита от null/undefined
        if (cell == null) continue;
        if (!cell.symbol) continue;

        const sid = cell.symbol.id;

        // Защита от невалидного id
        if (typeof sid !== 'string' || sid === '') continue;

        // Scatter не участвует в победных комбинациях
        if (cell.symbol.isScatter) continue;

        if (!groups.has(sid)) {
          groups.set(sid, []);
        }

        // Клонируем ячейку чтобы последующие мутации не сломали результат
        groups.get(sid)!.push({
          symbol: { ...cell.symbol },
          row: cell.row,
          col: cell.col,
          id: cell.id,
        });
      }
    }

    const wins: WinInfo[] = [];

    groups.forEach((cells, symbolId) => {
      if (cells.length < symbolsConfig.minWinSymbols) return;

      // Ищем определение символа
      const symbolDef = this.foodSymbols.find(s => s.id === symbolId);
      if (!symbolDef) {
        console.warn(`Win detection: unknown symbol id "${symbolId}"`);
        return;
      }

      wins.push({
        symbol: { ...symbolDef },
        cells,
        count: cells.length,
        payout: 0,
      });
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
        if (
          this.state.grid[cell.row] != null &&
          this.state.grid[cell.row][cell.col] != null
        ) {
          (this.state.grid[cell.row][cell.col] as any) = null;
        }
      }
    }
  }

  private dropSymbols(): void {
    for (let col = 0; col < symbolsConfig.gridSize.columns; col++) {
      // Собираем ненулевые ячейки снизу вверх
      const survivors: GridCell[] = [];

      for (let row = symbolsConfig.gridSize.rows - 1; row >= 0; row--) {
        const cell = this.state.grid[row][col];
        if (cell != null && cell.symbol) {
          survivors.push(cell);
        }
      }

      // Очищаем всю колонку
      for (let row = 0; row < symbolsConfig.gridSize.rows; row++) {
        (this.state.grid[row][col] as any) = null;
      }

      // Расставляем выжившие ячейки снизу вверх
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
        const cell = this.state.grid[row][col];
        if (cell == null || !cell.symbol) {
          this.state.grid[row][col] = {
            symbol: this.getRandomFoodSymbol(),
            row,
            col,
            id: `cell-${row}-${col}-${Date.now()}-${Math.random().toString(36).slice(2)}`
          };
        }
      }
    }
  }

  /**
   * Клонирование сетки.
   * Правильно обрабатывает null ячейки внутри строк.
   */
  private cloneGrid(grid: GridCell[][]): GridCell[][] {
    return grid.map(row =>
      row.map(cell => {
        if (cell == null) return null as any;
        return {
          ...cell,
          symbol: { ...cell.symbol }
        };
      })
    );
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

    for (let i = 0; i < orderCount; i++) {
      const symbol = this.foodSymbols[Math.floor(Math.random() * this.foodSymbols.length)];
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
      const symbol = this.foodSymbols[Math.floor(Math.random() * this.foodSymbols.length)];
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
      let anyCompleted = false;
      for (const order of this.state.orders) {
        if (order.collected >= order.quantity && !order.completed) {
          order.completed = true;
          const tip = this.state.currentBet * order.tipMultiplier;
          this.state.balance += tip;
          this.state.totalWin += tip;
          anyCompleted = true;
        }
      }
      if (!anyCompleted) {
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

    for (let i = 0; i < orderCount; i++) {
      const symbol = this.foodSymbols[Math.floor(Math.random() * this.foodSymbols.length)];
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










