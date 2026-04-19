import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { Zap, Clock, TrendingUp, AlertCircle, CheckCircle2, X } from 'lucide-react';

export type BehaviorTag = '秒解' | '流畅' | '稳住' | '偏慢' | '错误' | '完美';

export interface BehaviorFeedback {
  tag: BehaviorTag;
  message: string;
  color: 'success' | 'warning' | 'error' | 'info';
  icon?: React.ReactNode;
}

const behaviorConfig: Record<BehaviorTag, BehaviorFeedback> = {
  '秒解': {
    tag: '秒解',
    message: '闪电般的反应！',
    color: 'success',
    icon: <Zap className="w-4 h-4" />,
  },
  '流畅': {
    tag: '流畅',
    message: '思路清晰，继续保持！',
    color: 'success',
    icon: <CheckCircle2 className="w-4 h-4" />,
  },
  '稳住': {
    tag: '稳住',
    message: '慢慢来，准确率更重要',
    color: 'info',
    icon: <Clock className="w-4 h-4" />,
  },
  '偏慢': {
    tag: '偏慢',
    message: '可以再快一点哦',
    color: 'warning',
    icon: <TrendingUp className="w-4 h-4" />,
  },
  '错误': {
    tag: '错误',
    message: '再仔细想想',
    color: 'error',
    icon: <X className="w-4 h-4" />,
  },
  '完美': {
    tag: '完美',
    message: '太棒了！满分回答！',
    color: 'success',
    icon: <Zap className="w-4 h-4" />,
  },
};

interface BehaviorBadgeProps {
  tag: BehaviorTag;
  show?: boolean;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
}

export const BehaviorBadge: React.FC<BehaviorBadgeProps> = ({
  tag,
  show = true,
  position = 'top-right',
}) => {
  const config = behaviorConfig[tag];

  if (!show || !config) return null;

  const positionClasses = {
    'top-right': 'top-0 right-0 translate-x-2 -translate-y-1/2',
    'top-left': 'top-0 left-0 -translate-x-2 -translate-y-1/2',
    'bottom-right': 'bottom-0 right-0 translate-x-2 translate-y-1/2',
    'bottom-left': 'bottom-0 left-0 -translate-x-2 translate-y-1/2',
  };

  const colorClasses = {
    success: 'bg-success text-on-success',
    warning: 'bg-warning text-on-warning',
    error: 'bg-error text-on-error',
    info: 'bg-tertiary text-on-tertiary',
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        exit={{ scale: 0, rotate: 180 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        className={cn(
          'absolute z-10 px-3 py-1.5 rounded-full text-xs font-bold shadow-lg flex items-center gap-1.5',
          colorClasses[config.color],
          positionClasses[position]
        )}
      >
        {config.icon}
        {config.tag}
      </motion.div>
    </AnimatePresence>
  );
};

interface FeedbackPopupProps {
  behavior: BehaviorTag;
  duration?: number;
  onClose?: () => void;
}

export const FeedbackPopup: React.FC<FeedbackPopupProps> = ({
  behavior,
  duration = 2000,
  onClose,
}) => {
  const config = behaviorConfig[behavior];

  React.useEffect(() => {
    if (duration > 0 && onClose) {
      const timer = setTimeout(onClose, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  if (!config) return null;

  const colorClasses = {
    success: 'bg-success/10 border-success text-on-success',
    warning: 'bg-warning/10 border-warning text-on-warning',
    error: 'bg-error/10 border-error text-on-error',
    info: 'bg-tertiary/10 border-tertiary text-on-tertiary',
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.8, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.8, y: -20 }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        className={cn(
          'fixed top-1/4 left-1/2 -translate-x-1/2 px-6 py-4 rounded-2xl border-2 shadow-2xl z-50 flex items-center gap-3',
          colorClasses[config.color]
        )}
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.1, type: 'spring', stiffness: 300 }}
          className="w-10 h-10 rounded-full bg-current/10 flex items-center justify-center"
        >
          {config.icon}
        </motion.div>
        <div>
          <p className="font-bold text-sm">{config.tag}</p>
          <p className="text-xs opacity-80">{config.message}</p>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

interface StreakCounterProps {
  count: number;
  max?: number;
}

export const StreakCounter: React.FC<StreakCounterProps> = ({ count, max = 10 }) => {
  const percentage = Math.min(100, (count / max) * 100);

  return (
    <div className="flex items-center gap-2">
      <motion.div
        key={count}
        initial={{ scale: 1.2 }}
        animate={{ scale: 1 }}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 rounded-full"
      >
        <Zap className="w-4 h-4 text-primary" />
        <span className="font-bold text-primary text-sm">{count}</span>
      </motion.div>

      {/* 进度条 */}
      <div className="w-16 h-2 bg-surface-variant rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-gradient-to-r from-primary to-primary-container"
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>
    </div>
  );
};

interface DifficultyChangeProps {
  type: 'up' | 'down' | null;
  message: string;
  onClose: () => void;
}

export const DifficultyChange: React.FC<DifficultyChangeProps> = ({
  type,
  message,
  onClose,
}) => {
  React.useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  if (!type) return null;

  const config = {
    up: {
      bg: 'bg-success-container',
      text: 'text-on-success-container',
      icon: <TrendingUp className="w-5 h-5" />,
      label: '难度提升',
    },
    down: {
      bg: 'bg-warning-container',
      text: 'text-on-warning-container',
      icon: <AlertCircle className="w-5 h-5" />,
      label: '难度调整',
    },
  };

  const { bg, text, icon, label } = config[type];

  return (
    <motion.div
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -100, opacity: 0 }}
      className={cn(
        'fixed top-4 left-1/2 -translate-x-1/2 px-6 py-4 rounded-2xl shadow-xl z-50 flex items-center gap-4',
        bg,
        text
      )}
    >
      <div className="w-10 h-10 rounded-full bg-current/10 flex items-center justify-center">
        {icon}
      </div>
      <div>
        <p className="font-bold text-sm">{label}</p>
        <p className="text-xs opacity-80">{message}</p>
      </div>
    </motion.div>
  );
};

// 难度变更通知
export const useDifficultyNotification = () => {
  const [notification, setNotification] = React.useState<{
    type: 'up' | 'down' | null;
    message: string;
  }>({ type: null, message: '' });

  const showNotification = (type: 'up' | 'down', message: string) => {
    setNotification({ type, message });
  };

  const closeNotification = () => {
    setNotification({ type: null, message: '' });
  };

  return {
    notification,
    showNotification,
    closeNotification,
    NotificationComponent: notification.type ? (
      <DifficultyChange
        type={notification.type}
        message={notification.message}
        onClose={closeNotification}
      />
    ) : null,
  };
};
