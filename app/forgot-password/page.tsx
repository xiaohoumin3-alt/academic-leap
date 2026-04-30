'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import MaterialIcon from '@/components/MaterialIcon';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [code, setCode] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (!data.success) {
        setError(data.error || '发送失败');
        setLoading(false);
        return;
      }

      setSuccess(true);
      setCode(data.code || null);
      setLoading(false);
    } catch {
      setError('网络错误，请稍后重试');
      setLoading(false);
    }
  };

  const handleContinue = () => {
    router.push(`/reset-password?email=${encodeURIComponent(email)}`);
  };

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <h1 className="text-3xl font-display font-black text-primary mb-2">
            忘记密码
          </h1>
          <p className="text-on-surface-variant text-sm">
            输入注册邮箱，我们会发送验证码
          </p>
        </div>

        <div className="bg-surface-container-lowest rounded-[2rem] p-8 ambient-shadow">
          {!success ? (
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
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-surface border-2 border-outline-variant rounded-xl py-3 pl-10 pr-4 focus:border-primary focus:outline-none transition-colors"
                    placeholder="请输入注册邮箱"
                    required
                  />
                </div>
              </div>

              {error && (
                <div className="bg-error-container/20 text-error text-sm py-2 px-4 rounded-xl text-center">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary text-on-primary rounded-full py-4 font-display font-bold hover:scale-[1.02] active:scale-95 transition-all shadow-lg disabled:opacity-50"
              >
                {loading ? '发送中...' : '发送验证码'}
              </button>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="bg-success-container/20 text-success text-sm py-3 px-4 rounded-xl text-center">
                验证码已发送！
              </div>

              {code && (
                <div className="bg-primary-container/30 text-primary text-center py-4 rounded-xl">
                  <p className="text-sm mb-1">您的验证码是（开发模式）：</p>
                  <p className="text-2xl font-mono font-bold">{code}</p>
                </div>
              )}

              <button
                onClick={handleContinue}
                className="w-full bg-primary text-on-primary rounded-full py-4 font-display font-bold hover:scale-[1.02] active:scale-95 transition-all shadow-lg"
              >
                输入验证码继续
              </button>
            </div>
          )}

          <div className="mt-6 text-center">
            <button
              onClick={() => router.push('/login')}
              className="text-on-surface-variant text-sm hover:text-primary transition-colors"
            >
              返回登录
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}