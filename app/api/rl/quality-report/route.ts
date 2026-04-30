import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { HealthMonitor } from '@/lib/rl/health/monitor';
import { LabelQualityModel } from '@/lib/rl/quality/label-quality';
import { FeatureNormalizer } from '@/lib/rl/normalize/feature-normalizer';
import { AdaptationController } from '@/lib/rl/control/adaptation-controller';
import {
  isFeatureEnabled,
  getFeatureConfig,
  LQMConfig,
  NormalizerConfig,
  AdaptationConfig,
} from '@/lib/rl/config/phase3-features';

// Global instances for component state
const globalHealthMonitor = new HealthMonitor();
const globalLQM = isFeatureEnabled('lqm') ? new LabelQualityModel(getFeatureConfig<LQMConfig>('lqm')) : null;
const globalNormalizer = isFeatureEnabled('normalizer') ? new FeatureNormalizer(getFeatureConfig<NormalizerConfig>('normalizer')) : null;
const globalAdaptationController = new AdaptationController(getFeatureConfig<AdaptationConfig>('adaptation'));

/**
 * Quality Report Response Type
 */
interface QualityReportResponse {
  questionQuality: {
    questionId: string;
    estimatedQuality: number;
    confidence: number;
    isNoisy: boolean;
  }[];
  distributionStats: Record<string, {
    mean: number;
    std: number;
    count: number;
  }>;
  adaptationState: {
    currentExplorationRate: number;
    confidenceLevel: number;
    learningProgress: number;
    recommendedAction: 'explore' | 'exploit' | 'maintain';
  };
  phase3Features: {
    lqm: { enabled: boolean };
    normalizer: { enabled: boolean };
    adaptation: { enabled: boolean };
  };
  timestamp: string;
}

/**
 * GET /api/rl/quality-report
 *
 * Returns the current state of Phase 3 RL components:
 * - Question quality estimates from LQM
 * - Distribution statistics from Normalizer
 * - Adaptation state from AdaptationController
 * - Feature enablement status
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get health status for adaptation controller
    const healthStatus = globalHealthMonitor.check();

    // Update adaptation controller with current health metrics
    globalAdaptationController.update({
      le: healthStatus.metrics.le ?? 0,
      cs: healthStatus.metrics.cs ?? 0,
      confidence: healthStatus.metrics.cs ?? 0, // Use CS as a proxy for confidence
    });

    // Get question quality data from LQM
    const questionQuality: QualityReportResponse['questionQuality'] = [];
    if (globalLQM) {
      const trackedQuestions = globalLQM.getTrackedQuestions();
      for (const questionId of trackedQuestions) {
        const quality = globalLQM.getQuality(questionId);
        if (quality) {
          questionQuality.push(quality);
        }
      }
    }

    // Get distribution stats from normalizer
    const distributionStats: QualityReportResponse['distributionStats'] = {};
    if (globalNormalizer) {
      // Common features that may have stats
      const features = ['reward', 'theta', 'deltaC', 'le', 'cs'];
      for (const feature of features) {
        const stats = globalNormalizer.getStats(feature);
        if (stats.count > 0) {
          distributionStats[feature] = stats;
        }
      }
    }

    // Get adaptation state
    const adaptationState = globalAdaptationController.getRecommendation();

    // Build response
    const response: QualityReportResponse = {
      questionQuality,
      distributionStats,
      adaptationState,
      phase3Features: {
        lqm: { enabled: isFeatureEnabled('lqm') },
        normalizer: { enabled: isFeatureEnabled('normalizer') },
        adaptation: { enabled: isFeatureEnabled('adaptation') },
      },
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Quality report error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}