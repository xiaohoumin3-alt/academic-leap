export interface PredictionClientConfig {
  baseUrl?: string;
  timeout?: number;
}

export interface PredictRequest {
  studentId: string;  // 改为 string 与服务层一致
  questionFeatures: {
    difficulty: number;
    knowledgeNodes: string[];
  };
}

export interface PredictResponse {
  studentId: string;  // 改为 string 与服务层一致
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