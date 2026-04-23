import React, { useState } from 'react';
import { motion } from 'motion/react';
import MaterialIcon from './MaterialIcon';

interface CalibrationCardProps {
  originalLowestScore: number;
  newStartingScore: number;
  currentScore: number;
  onConfirm: () => void;
  onDismiss: () => void;
}

export const StartingScoreCalibrationCard: React.FC<CalibrationCardProps> = ({
  originalLowestScore,
  newStartingScore,
  currentScore,
  onConfirm,
  onDismiss,
}) => {
  const [showPreview, setShowPreview] = useState(false);
  const [isCalibrating, setIsCalibrating] = useState(false);

  const oldProgress = currentScore - originalLowestScore;
  const newProgress = currentScore - newStartingScore;

  const handleConfirm = async () => {
    setIsCalibrating(true);
    try {
      await onConfirm();
    } finally {
      setIsCalibrating(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-warning-container/10 border border-warning-container/30 rounded-2xl p-5 mb-6"
    >
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-full bg-warning-container text-on-warning-container">
          <MaterialIcon icon="lightbulb" style={{ fontSize: '20px' }} />
        </div>
        <div className="flex-1">
          <h4 className="font-bold text-on-surface mb-1">检测到可能的试玩数据</h4>
          <p className="text-sm text-on-surface-variant mb-3">
            您的历史最低分（{originalLowestScore}分）与当前水平差异较大，可能是试用时的数据。
          </p>

          {showPreview && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="bg-surface rounded-xl p-4 mb-3"
            >
              <div className="flex items-center justify-between text-sm">
                <span className="text-on-surface-variant">校准后起始分</span>
                <span className="font-bold text-primary">{newStartingScore}分</span>
              </div>
              <div className="flex items-center justify-between text-sm mt-1">
                <span className="text-on-surface-variant">进步幅度变化</span>
                <span className="font-medium">
                  <span className="line-through text-on-surface-variant/50">+{oldProgress}分</span>
                  <span className="ml-2 text-success">+{newProgress}分</span>
                </span>
              </div>
            </motion.div>
          )}

          <div className="flex items-center gap-2">
            {!showPreview ? (
              <>
                <button
                  onClick={() => setShowPreview(true)}
                  className="flex-1 py-2 px-4 bg-surface-container text-on-surface rounded-full text-sm font-medium"
                >
                  预览详情
                </button>
                <button
                  onClick={onDismiss}
                  className="flex-1 py-2 px-4 bg-outline/10 text-on-surface rounded-full text-sm font-medium"
                >
                  保持现状
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setShowPreview(false)}
                  className="flex-1 py-2 px-4 bg-surface-container text-on-surface rounded-full text-sm font-medium"
                >
                  返回
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={isCalibrating}
                  className="flex-1 py-2 px-4 bg-primary text-on-primary rounded-full text-sm font-medium disabled:opacity-50"
                >
                  {isCalibrating ? '校准中...' : '确认校准'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};
