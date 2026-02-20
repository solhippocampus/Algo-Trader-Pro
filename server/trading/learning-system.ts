import { MotifType } from './motifs';

export interface LearningState {
  motifSuccessRates: Record<MotifType, { success: number; total: number }>;
  transitionProbabilities: Record<string, Record<string, number>>;
  rlQValues: Record<string, Record<string, number>>;
  rlLearningRate: number;
  rlDiscountFactor: number;
}

export class BayesianLearning {
  private successCounts: Record<MotifType, number> = {
    trend: 0,
    momentum: 0,
    volatility: 0,
    sentiment: 0,
  };

  private failureCounts: Record<MotifType, number> = {
    trend: 0,
    momentum: 0,
    volatility: 0,
    sentiment: 0,
  };

  private priors: Record<MotifType, number> = {
    trend: 0.25,
    momentum: 0.25,
    volatility: 0.25,
    sentiment: 0.25,
  };

  recordOutcome(motifType: MotifType, success: boolean) {
    if (success) {
      this.successCounts[motifType]++;
    } else {
      this.failureCounts[motifType]++;
    }
  }

  // Beta-Binomial conjugate prior for success rate estimation
  estimateSuccessRate(motifType: MotifType): number {
    const alpha = 1 + this.successCounts[motifType]; // Prior alpha
    const beta = 1 + this.failureCounts[motifType]; // Prior beta
    return alpha / (alpha + beta);
  }

  updateWeights(): Record<MotifType, number> {
    const weights: Record<MotifType, number> = {
      trend: 0,
      momentum: 0,
      volatility: 0,
      sentiment: 0,
    };

    // Calculate posterior probabilities
    let totalLikelihood = 0;
    for (const motif of Object.keys(this.priors) as MotifType[]) {
      const successRate = this.estimateSuccessRate(motif);
      const likelihood = this.priors[motif] * successRate;
      weights[motif] = likelihood;
      totalLikelihood += likelihood;
    }

    // Normalize
    for (const motif of Object.keys(weights) as MotifType[]) {
      weights[motif] = totalLikelihood > 0 ? weights[motif] / totalLikelihood : 0.25;
    }

    return weights;
  }

  getStats() {
    return {
      successCounts: { ...this.successCounts },
      failureCounts: { ...this.failureCounts },
      successRates: {
        trend: this.estimateSuccessRate('trend'),
        momentum: this.estimateSuccessRate('momentum'),
        volatility: this.estimateSuccessRate('volatility'),
        sentiment: this.estimateSuccessRate('sentiment'),
      },
    };
  }
}

export class MarkovChain {
  private transitions: Map<string, Map<string, number>> = new Map();
  private states: Set<string> = new Set();

  // Price state: 'UPTRENDSTRONG' | 'UPTREND' | 'NEUTRAL' | 'DOWNTREND' | 'DOWNTRENDSTRONG' | 'CRASH'
  recordTransition(fromState: string, toState: string) {
    if (!this.transitions.has(fromState)) {
      this.transitions.set(fromState, new Map());
      this.states.add(fromState);
    }
    if (!this.transitions.get(fromState)!.has(toState)) {
      this.transitions.get(fromState)!.set(toState, 0);
    }
    this.transitions.get(fromState)!.set(toState, this.transitions.get(fromState)!.get(toState)! + 1);
    this.states.add(toState);
  }

  getPriceState(signal: number, volatility: number): string {
    // Determine market state from signal
    if (signal > 0.8 && volatility < 0.5) return 'UPTRENDSTRONG';
    if (signal > 0.65) return 'UPTREND';
    if (signal > 0.35 && signal < 0.65) return 'NEUTRAL';
    if (signal < 0.35) return 'DOWNTREND';
    if (signal < 0.2) return 'DOWNTRENDSTRONG';
    return 'NEUTRAL';
  }

  getTransitionMatrix(): Record<string, Record<string, number>> {
    const matrix: Record<string, Record<string, number>> = {};

    for (const [fromState, transMap] of Array.from(this.transitions.entries())) {
      matrix[fromState] = {};
      const total = Array.from(transMap.values()).reduce((a: number, b: number) => a + b, 0);

      for (const toState of Array.from(this.states.values())) {
        const count = transMap.get(toState) || 0;
        matrix[fromState][toState] = total > 0 ? count / total : 0;
      }
    }

    return matrix;
  }

  predictNextState(currentState: string): string {
    const transitions = this.transitions.get(currentState);
    if (!transitions || transitions.size === 0) return currentState;

    let random = Math.random();
    const total = Array.from(transitions.values()).reduce((a: number, b: number) => a + b, 0);

    for (const [toState, count] of Array.from(transitions.entries())) {
      const probability = count / total;
      if (random < probability) return toState;
      random -= probability;
    }

    return currentState;
  }
}

export class QLearning {
  private qValues: Map<string, Map<string, number>> = new Map();
  private learningRate: number = 0.1;
  private discountFactor: number = 0.95;
  private epsilon: number = 0.1; // Exploration rate

  private states = ['LONG', 'SHORT', 'NEUTRAL', 'REDUCE_POSITION'];
  private actionValue = (state: string, action: string, key: string = `${state}:${action}`) => {
    if (!this.qValues.has(key)) {
      this.qValues.set(key, new Map());
    }
    return this.qValues.get(key)!;
  };

  recordReward(state: string, action: string, reward: number, nextState: string) {
    const key = `${state}:${action}`;
    if (!this.qValues.has(key)) {
      this.qValues.set(key, new Map());
    }

    const currentQ = this.qValues.get(key)!.get('value') || 0;
    const maxNextQ = this.getMaxQValue(nextState);

    const newQ = currentQ + this.learningRate * (reward + this.discountFactor * maxNextQ - currentQ);
    this.qValues.get(key)!.set('value', newQ);
  }

  private getMaxQValue(state: string): number {
    let maxQ = -Infinity;
    for (const action of this.states) {
      const key = `${state}:${action}`;
      const q = this.qValues.get(key)?.get('value') || 0;
      maxQ = Math.max(maxQ, q);
    }
    return maxQ === -Infinity ? 0 : maxQ;
  }

  selectAction(state: string, signal: number): string {
    // Exploit-Explore tradeoff
    if (Math.random() < this.epsilon) {
      // Explore: random action
      return this.states[Math.floor(Math.random() * this.states.length)];
    } else {
      // Exploit: best Q-value action
      let bestAction = 'NEUTRAL';
      let bestQ = -Infinity;

      for (const action of this.states) {
        const key = `${state}:${action}`;
        const q = this.qValues.get(key)?.get('value') || 0;
        if (q > bestQ) {
          bestQ = q;
          bestAction = action;
        }
      }

      return bestAction;
    }
  }

  getQValues() {
    const result: Record<string, number> = {};
    for (const [key, valueMap] of Array.from(this.qValues.entries())) {
      result[key] = valueMap.get('value') || 0;
    }
    return result;
  }

  setLearningRate(rate: number) {
    this.learningRate = rate;
  }

  setEpsilon(eps: number) {
    this.epsilon = eps;
  }
}

export class MonteCarloSimulation {
  // Simulate 1000+ scenarios for system robustness
  simulateScenarios(basePrice: number, volatility: number, scenarios: number = 1000) {
    const results: number[] = [];

    for (let i = 0; i < scenarios; i++) {
      let price = basePrice;
      const timeSteps = 100; // 100 time steps

      for (let t = 0; t < timeSteps; t++) {
        // Geometric Brownian Motion
        const drift = 0.0001; // Small drift
        const randomWalk = (Math.random() - 0.5) * volatility;
        price = price * (1 + drift + randomWalk);
      }

      results.push(price);
    }

    // Calculate statistics
    const sorted = results.sort((a, b) => a - b);
    const mean = results.reduce((a, b) => a + b, 0) / results.length;
    const variance = results.reduce((a, b) => a + (b - mean) ** 2, 0) / results.length;
    const stddev = Math.sqrt(variance);

    return {
      mean,
      median: sorted[Math.floor(sorted.length / 2)],
      stddev,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      percentile95: sorted[Math.floor(sorted.length * 0.95)],
      percentile05: sorted[Math.floor(sorted.length * 0.05)],
      scenarios: results,
    };
  }
}

export class AdaptiveLearningEngine {
  private bayesian: BayesianLearning;
  private markov: MarkovChain;
  private qlearning: QLearning;
  private monteCarlo: MonteCarloSimulation;

  constructor() {
    this.bayesian = new BayesianLearning();
    this.markov = new MarkovChain();
    this.qlearning = new QLearning();
    this.monteCarlo = new MonteCarloSimulation();
  }

  recordTradeOutcome(motifType: MotifType, success: boolean, currentState: string, nextState: string, reward: number) {
    // Bayesian update
    this.bayesian.recordOutcome(motifType, success);

    // Markov transition
    this.markov.recordTransition(currentState, nextState);

    // Q-Learning
    const action = success ? (reward > 0 ? 'LONG' : 'SHORT') : 'REDUCE_POSITION';
    this.qlearning.recordReward(currentState, action, reward, nextState);
  }

  getUpdatedWeights(): Record<MotifType, number> {
    return this.bayesian.updateWeights();
  }

  getNextPriceState(currentSignal: number, volatility: number): string {
    const currentState = this.markov.getPriceState(currentSignal, volatility);
    return this.markov.predictNextState(currentState);
  }

  getSystemRobustness(basePrice: number, volatility: number): any {
    return this.monteCarlo.simulateScenarios(basePrice, volatility, 500);
  }

  getStats() {
    return {
      bayesian: this.bayesian.getStats(),
      markov: this.markov.getTransitionMatrix(),
      qlearning: this.qlearning.getQValues(),
    };
  }
}
