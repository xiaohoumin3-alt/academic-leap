export interface PredictionClientConfig {
  baseUrl?: string;
  timeout?: number;
}

export interface PredictRequest {
  studentId: number;
  questionFeatures: {
    difficulty: number;
    knowledgeNodes: string[];
  };
}

export interface PredictResponse {
  studentId: number;
  predictions: Array<{
    questionId: string;
    probability: number;
    confidence: number;
  }>;
  metadata: {
    modelVersion: string;
    timestamp: number;
    latency: number;
  };
}