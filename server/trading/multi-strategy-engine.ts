import { EventEmitter } from "events";

// Strategy types
export type StrategyType = "TREND" | "VOLATILITY" | "EVENT_DRIVEN" | "ML_PREDICTION";

// Market configuration
export const MARKETS = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "AVAXUSDT", "LINKUSDT", "MATICUSDT", "XRPUSDT", "TONUSDT", "ATOMUSDT"];

export interface StrategySignal {
  symbol: string;
  action: "BUY" | "SELL" | "HOLD";
  confidence: number;
  strategy: StrategyType;
  price: number;
  timestamp: Date;
}

export interface MotifPattern {
  id: string;
  symbol: string;
  strategy: StrategyType;
  pattern: string;
  performance: number;
  lastUpdated: Date;
  mutations: number;
}

export interface CoinMetrics {
  symbol: string;
  volatility: number;
  trend: "UP" | "DOWN" | "SIDEWAYS";
  volume24h: number;
  momentum: number;
  rsi: number;
  macd: { value: number; signal: number };
}

export interface EnsembleWeights {
  [symbol: string]: {
    TREND: number;
    VOLATILITY: number;
    EVENT_DRIVEN: number;
    ML_PREDICTION: number;
  };
}

// Monte Carlo Simulation
export class MonteCarloSimulator {
  static async simulate(symbol: string, currentPrice: number, volatility: number, simulations: number = 1000, periods: number = 5): Promise<number[]> {
    const results: number[] = [];
    for (let i = 0; i < simulations; i++) {
      let price = currentPrice;
      for (let p = 0; p < periods; p++) {
        const randomReturn = (Math.random() - 0.5) * volatility;
        price *= (1 + randomReturn);
      }
      results.push(price);
    }
    return results.sort((a, b) => a - b);
  }
}

// Bayesian Probability Update
export class BayesianUpdater {
  private prior: number = 0.5;
  
  update(likelihood: number, evidence: number): number {
    // P(A|B) = P(B|A) * P(A) / P(B)
    const posterior = (likelihood * this.prior) / evidence;
    this.prior = posterior;
    return posterior;
  }

  getProbability(): number {
    return this.prior;
  }
}

// Markov Chain for price transitions
export class MarkovChain {
  private states = ["LOW", "MID", "HIGH"];
  private transitionMatrix: number[][] = [
    [0.6, 0.3, 0.1],
    [0.2, 0.6, 0.2],
    [0.1, 0.3, 0.6],
  ];

  getNextStateProb(currentState: string): { [key: string]: number } {
    const stateIndex = this.states.indexOf(currentState);
    return {
      LOW: this.transitionMatrix[stateIndex][0],
      MID: this.transitionMatrix[stateIndex][1],
      HIGH: this.transitionMatrix[stateIndex][2],
    };
  }
}

// Reinforcement Learning Agent
export class RLAgent {
  private qTable: Map<string, Map<string, number>> = new Map();
  private learningRate: number = 0.1;
  private discountFactor: number = 0.9;
  private epsilon: number = 0.1;

  async chooseAction(state: string, availableActions: string[]): Promise<string> {
    if (Math.random() < this.epsilon) {
      return availableActions[Math.floor(Math.random() * availableActions.length)];
    }

    if (!this.qTable.has(state)) {
      this.qTable.set(state, new Map());
    }

    const stateQs = this.qTable.get(state)!;
    let bestAction = availableActions[0];
    let bestValue = stateQs.get(bestAction) || 0;

    for (const action of availableActions) {
      const value = stateQs.get(action) || 0;
      if (value > bestValue) {
        bestValue = value;
        bestAction = action;
      }
    }

    return bestAction;
  }

  updateQValue(state: string, action: string, reward: number, nextState: string, nextActions: string[]): void {
    if (!this.qTable.has(state)) {
      this.qTable.set(state, new Map());
    }
    if (!this.qTable.has(nextState)) {
      this.qTable.set(nextState, new Map());
    }

    const stateQs = this.qTable.get(state)!;
    const nextStateQs = this.qTable.get(nextState)!;

    const currentQ = stateQs.get(action) || 0;
    const maxNextQ = Math.max(...nextActions.map(a => nextStateQs.get(a) || 0));

    const newQ = currentQ + this.learningRate * (reward + this.discountFactor * maxNextQ - currentQ);
    stateQs.set(action, newQ);
  }

  getWeights(): Map<string, Map<string, number>> {
    return this.qTable;
  }
}

// Ensemble Strategy Engine
export class EnsembleStrategyEngine extends EventEmitter {
  private rlAgent: RLAgent;
  private bayesianUpdaters: Map<string, BayesianUpdater> = new Map();
  private markovChains: Map<string, MarkovChain> = new Map();
  private ensembleWeights: EnsembleWeights = {};
  private coinMetrics: Map<string, CoinMetrics> = new Map();
  private motifPatterns: MotifPattern[] = [];

  constructor() {
    super();
    this.rlAgent = new RLAgent();
    this.initializeMarkets();
  }

  private initializeMarkets(): void {
    for (const market of MARKETS) {
      this.bayesianUpdaters.set(market, new BayesianUpdater());
      this.markovChains.set(market, new MarkovChain());
      this.ensembleWeights[market] = {
        TREND: 0.25,
        VOLATILITY: 0.25,
        EVENT_DRIVEN: 0.25,
        ML_PREDICTION: 0.25,
      };
    }
  }

  // Trend-following strategy (EMA, MACD)
  async analyzeTrend(symbol: string, prices: number[]): Promise<StrategySignal | null> {
    if (prices.length < 20) return null;

    const ema12 = this.calculateEMA(prices, 12);
    const ema26 = this.calculateEMA(prices, 26);
    const macd = ema12 - ema26;

    const action = macd > 0 ? "BUY" : "SELL";
    const confidence = Math.abs(macd) / prices[prices.length - 1];

    return {
      symbol,
      action,
      confidence,
      strategy: "TREND",
      price: prices[prices.length - 1],
      timestamp: new Date(),
    };
  }

  // Volatility strategy (RSI, Bollinger Bands)
  async analyzeVolatility(symbol: string, prices: number[]): Promise<StrategySignal | null> {
    if (prices.length < 14) return null;

    const rsi = this.calculateRSI(prices);
    const action = rsi < 30 ? "BUY" : rsi > 70 ? "SELL" : "HOLD";
    const confidence = Math.abs(rsi - 50) / 50;

    return {
      symbol,
      action,
      confidence,
      strategy: "VOLATILITY",
      price: prices[prices.length - 1],
      timestamp: new Date(),
    };
  }

  // Monte Carlo Based Decision
  async analyzeMonteCarlo(symbol: string, currentPrice: number, volatility: number): Promise<StrategySignal | null> {
    const simulations = await MonteCarloSimulator.simulate(symbol, currentPrice, volatility);
    const mean = simulations.reduce((a, b) => a + b, 0) / simulations.length;
    const std = Math.sqrt(simulations.reduce((sq, n) => sq + Math.pow(n - mean, 2), 0) / simulations.length);

    // If expected value is significantly above current, BUY
    const action = mean > currentPrice * 1.01 ? "BUY" : mean < currentPrice * 0.99 ? "SELL" : "HOLD";
    const confidence = Math.abs(mean - currentPrice) / currentPrice;

    return {
      symbol,
      action,
      confidence: Math.min(confidence, 1),
      strategy: "ML_PREDICTION",
      price: currentPrice,
      timestamp: new Date(),
    };
  }

  // Ensemble decision using RL weighted average
  async makeEnsembleDecision(symbol: string, signals: StrategySignal[]): Promise<StrategySignal | null> {
    if (signals.length === 0) return null;

    const weights = this.ensembleWeights[symbol];
    let weightedBuyScore = 0;
    let weightedSellScore = 0;

    for (const signal of signals) {
      const weight = weights[signal.strategy];
      if (signal.action === "BUY") {
        weightedBuyScore += weight * signal.confidence;
      } else if (signal.action === "SELL") {
        weightedSellScore += weight * signal.confidence;
      }
    }

    const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
    const buyProb = weightedBuyScore / totalWeight;
    const sellProb = weightedSellScore / totalWeight;

    let action: "BUY" | "SELL" | "HOLD" = "HOLD";
    if (buyProb > sellProb && buyProb > 0.4) {
      action = "BUY";
    } else if (sellProb > buyProb && sellProb > 0.4) {
      action = "SELL";
    }

    return {
      symbol,
      action,
      confidence: Math.max(buyProb, sellProb),
      strategy: "TREND",
      price: signals[0]?.price || 0,
      timestamp: new Date(),
    };
  }

  // Bayesian Update with new data
  updateBayesian(symbol: string, tradeSuccess: boolean): void {
    const updater = this.bayesianUpdaters.get(symbol);
    if (updater) {
      const likelihood = tradeSuccess ? 0.8 : 0.2;
      const evidence = 0.5;
      updater.update(likelihood, evidence);
    }
  }

  // Mutate motif patterns
  mutateMotifsForCoin(symbol: string): void {
    const coinsMotifs = this.motifPatterns.filter(m => m.symbol === symbol);

    for (const motif of coinsMotifs) {
      motif.mutations += 1;
      const mutationFactor = 0.05 * Math.random();
      motif.performance *= (1 + mutationFactor);
      motif.lastUpdated = new Date();

      // Update ensemble weights based on motif performance
      if (motif.performance > 0.7) {
        this.ensembleWeights[symbol][motif.strategy as StrategyType] *= 1.1;
      }
    }

    // Normalize weights
    const totalWeight = Object.values(this.ensembleWeights[symbol]).reduce((a, b) => a + b, 0);
    for (const strategy in this.ensembleWeights[symbol]) {
      this.ensembleWeights[symbol][strategy as StrategyType] /= totalWeight;
    }
  }

  private calculateEMA(prices: number[], period: number): number {
    const multiplier = 2 / (period + 1);
    let ema = prices[0];
    for (let i = 1; i < prices.length; i++) {
      ema = prices[i] * multiplier + ema * (1 - multiplier);
    }
    return ema;
  }

  private calculateRSI(prices: number[]): number {
    let avgGain = 0;
    let avgLoss = 0;

    for (let i = 1; i < Math.min(15, prices.length); i++) {
      const change = prices[i] - prices[i - 1];
      if (change > 0) {
        avgGain += change;
      } else {
        avgLoss += Math.abs(change);
      }
    }

    avgGain /= 14;
    avgLoss /= 14;

    const rs = avgLoss !== 0 ? avgGain / avgLoss : 1;
    return 100 - 100 / (1 + rs);
  }

  getEnsembleWeights(): EnsembleWeights {
    return this.ensembleWeights;
  }

  getMotifs(): MotifPattern[] {
    return this.motifPatterns;
  }

  addMotif(motif: MotifPattern): void {
    this.motifPatterns.push(motif);
  }

  getCoinMetrics(symbol: string): CoinMetrics | undefined {
    return this.coinMetrics.get(symbol);
  }

  setCoinMetrics(symbol: string, metrics: CoinMetrics): void {
    this.coinMetrics.set(symbol, metrics);
  }

  getRLAgent(): RLAgent {
    return this.rlAgent;
  }
}

// Export singleton
export const ensembleEngine = new EnsembleStrategyEngine();
