'use client';

import React from 'react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';

export type TabValue = 'growth' | 'path' | 'practice' | 'complexity';

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
  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    let newIndex = index;
    if (e.key === 'ArrowRight') newIndex = (index + 1) % options.length;
    if (e.key === 'ArrowLeft') newIndex = (index - 1 + options.length) % options.length;
    if (e.key === 'Home') newIndex = 0;
    if (e.key === 'End') newIndex = options.length - 1;
    if (newIndex !== index) {
      e.preventDefault();
      onChange(options[newIndex].value);
    }
  };

  return (
    <div role="tablist" className="relative bg-surface-container-low rounded-full p-1 flex">
      {options.map((option, index) => {
        const isActive = value === option.value;
        return (
          <button
            key={option.value}
            role="tab"
            aria-selected={isActive}
            aria-label={option.label}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            className={cn(
              "flex-1 py-2.5 px-4 rounded-full text-sm font-display font-black relative z-10",
              "transition-colors duration-150",
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
