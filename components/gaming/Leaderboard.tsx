'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import type { LeaderboardEntry } from '@/types/gaming';

interface LeaderboardProps {
  theme?: string;
}

export function Leaderboard({ theme }: LeaderboardProps) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [userRank, setUserRank] = useState<number | null>(null);
  const [totalParticipants, setTotalParticipants] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadLeaderboard();
  }, [theme]);

  const loadLeaderboard = async () => {
    setIsLoading(true);
    try {
      const url = theme
        ? `/api/gaming/leaderboard?theme=${theme}&limit=10`
        : '/api/gaming/leaderboard?limit=10';

      const res = await fetch(url);
      const data = await res.json();

      setEntries(data.entries || []);
      setUserRank(data.userRank?.rank || null);
      setTotalParticipants(data.userRank?.totalParticipants || 0);
    } catch (error) {
      console.error('Failed to load leaderboard:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white/5 rounded-xl p-6">
        <div className="animate-pulse text-white/60">加载中...</div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-purple-900/30 to-indigo-900/30 rounded-xl p-6 border border-purple-500/30">
      {/* 标题 */}
      <div className="flex items-center gap-2 mb-6">
        <span className="text-2xl">🏆</span>
        <h3 className="text-lg font-bold text-white">积分排行榜</h3>
      </div>

      {/* 排行榜 */}
      <div className="space-y-2">
        {entries.map((entry, index) => (
          <motion.div
            key={entry.rank}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05 }}
            className="flex items-center justify-between p-3 rounded-lg bg-black/20"
          >
            <div className="flex items-center gap-4">
              {/* 排名 */}
              <div className="w-10 text-center font-bold text-lg text-white">
                {entry.rank <= 3 ? ['🥇', '🥈', '🥉'][entry.rank - 1] : `#${entry.rank}`}
              </div>

              {/* 用户名（匿名） */}
              <div>
                <div className="font-medium text-white">{entry.userName}</div>
                <div className="text-xs text-white/60">
                  Lv.{entry.level}
                </div>
              </div>
            </div>

            {/* 积分 */}
            <div className="text-white font-bold">
              {entry.totalXP} XP
            </div>
          </motion.div>
        ))}
      </div>

      {/* 你的位置 */}
      {userRank && userRank > entries.length && (
        <div className="mt-6 pt-4 border-t border-white/10 text-center">
          <p className="text-purple-300">
            你目前排名 <strong className="text-white">#{userRank}</strong> / {totalParticipants}
          </p>
        </div>
      )}
    </div>
  );
}
