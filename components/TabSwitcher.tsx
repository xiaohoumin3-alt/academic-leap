'use client';

import React from 'react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';

export type TabValue = 'growth' | 'practice';

export interface TabOption {
  value: TabValue;
  label: string;
}

interface TabSwitcherProps {
  options: TabOption[];
  value: TabValue;
  onChange: (value: TabValue) => void;
}

const TabSwitcher: React.FC<TabSwitcherProps> = ({ options, value, onChange }) => {
  return (
    <div className="relative bg-surface-container-low rounded-full p-1 flex">
      {options.map((option) => {
        const isActive = value === option.value;
        return (
          <button
            key={option.value}
            onClick={() => onChange(option.value)}
            className={cn(
              "flex-1 py-2.5 px-4 rounded-full text-sm font-display font-black transition-all relative z-10",
              isActive ? "text-on-primary" : "text-on-surface-variant"
            )}
          >
            {isActive && (
              <motion.div
                layoutId="activeTab"
                className="absolute inset-0 bg-primary rounded-full"
                initial={false}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
              />
            )}
            <span className="relative z-10">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
};

export default TabSwitcher;
