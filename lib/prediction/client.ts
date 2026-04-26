import type { PredictionClientConfig, PredictRequest, PredictResponse } from './types';

export class PredictionClient {
  private baseUrl: string;
  private timeout: number;

  constructor(config: PredictionClientConfig = {}) {
    this.baseUrl = config.baseUrl || process.env.PREDICTION_SERVICE_URL || 'http://localhost:3001';
    this.timeout = config.timeout || 5000;
  }

  async predict(request: PredictRequest): Promise<PredictResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${this.baseUrl}/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`Prediction service error: ${response.status}`);
      }

      return await response.json();
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async predictSafe(request: PredictRequest): Promise<PredictResponse | null> {
    try {
      return await this.predict(request);
    } catch {
      return null;
    }
  }
}

let clientInstance: PredictionClient | null = null;

export function getPredictionClient(): PredictionClient {
  if (!clientInstance) {
    clientInstance = new PredictionClient();
  }
  return clientInstance;
}