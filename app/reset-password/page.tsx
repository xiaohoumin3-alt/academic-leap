'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'motion/react';
import MaterialIcon from '@/components/MaterialIcon';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get('email') || '';

  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code, newPassword }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || '重置失败');
        setLoading(false);
        return;
      }

      router.push('/login?reset=success');
    } catch {
      setError('网络错误，请稍后重试');
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="text-xs font-bold text-on-surface-variant mb-1 block">
          邮箱
        </label>
        <div className="relative">
          <MaterialIcon
            icon="email"
            className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant"
            style={{ fontSize: '20px' }}
          />
          <input
            type="email"
            value={email}
            readOnly
            className="w-full bg-surface-container-low border-2 border-outline-variant rounded-xl py-3 pl-10 pr-4 text-on-surface-variant"
          />
        </div>
      </div>

      <div>
        <label className="text-xs font-bold text-on-surface-variant mb-1 block">
          验证码
        </label>
        <div className="relative">
          <MaterialIcon
            icon="pin"
            className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant"
            style={{ fontSize: '20px' }}
          />
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            className="w-full bg-surface border-2 border-outline-variant rounded-xl py-3 pl-10 pr-4 focus:border-primary focus:outline-none transition-colors font-mono tracking-widest"
            placeholder="请输入6位验证码"
            maxLength={6}
            required
          />
        </div>
      </div>

      <div>
        <label className="text-xs font-bold text-on-surface-variant mb-1 block">
          新密码
        </label>
        <div className="relative">
          <MaterialIcon
            icon="lock"
            className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant"
            style={{ fontSize: '20px' }}
          />
          <input
            type={showPassword ? 'text' : 'password'}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full bg-surface border-2 border-outline-variant rounded-xl py-3 pl-10 pr-12 focus:border-primary focus:outline-none transition-colors"
            placeholder="至少6位字符"
            minLength={6}
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface"
          >
            <MaterialIcon
              icon={showPassword ? 'visibility_off' : 'visibility'}
              style={{ fontSize: '20px' }}
            />
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-error-container/20 text-error text-sm py-2 px-4 rounded-xl text-center">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading || code.length !== 6}
        className="w-full bg-primary text-on-primary rounded-full py-4 font-display font-bold hover:scale-[1.02] active:scale-95 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? '重置中...' : '确认重置'}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <h1 className="text-3xl font-display font-black text-primary mb-2">
            设置新密码
          </h1>
          <p className="text-on-surface-variant text-sm">
            输入验证码并设置新密码
          </p>
        </div>

        <div className="bg-surface-container-lowest rounded-[2rem] p-8 ambient-shadow">
          <Suspense fallback={<div className="text-center py-4">加载中...</div>}>
            <ResetPasswordForm />
          </Suspense>

          <div className="mt-6 text-center">
            <button
              onClick={() => window.history.back()}
              className="text-on-surface-variant text-sm hover:text-primary transition-colors"
            >
              返回上一步
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
