'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { motion } from 'motion/react';
import MaterialIcon from '../../components/MaterialIcon';

type AuthMode = 'login' | 'register';

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>('login');
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    grade: 9,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'register') {
        // 注册
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });

        const data = await res.json();

        if (!res.ok) {
          setError(data.error || '注册失败');
          setLoading(false);
          return;
        }

        // 注册成功后自动登录
        setMode('login');
        setLoading(false);
        return;
      }

      // 登录
      const result = await signIn('credentials', {
        email: formData.email,
        password: formData.password,
        redirect: false,
      });

      if (result?.error) {
        setError('邮箱或密码错误');
        setLoading(false);
        return;
      }

      router.push('/');
      router.refresh();
    } catch (err) {
      setError('操作失败，请稍后重试');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-display font-black text-primary mb-2">
            学力跃迁
          </h1>
          <p className="text-on-surface-variant text-sm">
            AI驱动的智能学习平台
          </p>
        </div>

        {/* Form Card */}
        <div className="bg-surface-container-lowest rounded-[2rem] p-8 ambient-shadow">
          <div className="flex gap-2 mb-6 bg-surface-container-low p-1 rounded-full">
            <button
              onClick={() => setMode('login')}
              className={`flex-1 py-2 rounded-full text-sm font-bold transition-all ${
                mode === 'login'
                  ? 'bg-primary text-on-primary shadow-md'
                  : 'text-on-surface-variant'
              }`}
            >
              登录
            </button>
            <button
              onClick={() => setMode('register')}
              className={`flex-1 py-2 rounded-full text-sm font-bold transition-all ${
                mode === 'register'
                  ? 'bg-primary text-on-primary shadow-md'
                  : 'text-on-surface-variant'
              }`}
            >
              注册
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <div>
                <label className="text-xs font-bold text-on-surface-variant mb-1 block">
                  姓名
                </label>
                <div className="relative">
                  <MaterialIcon icon="person" className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" style={{ fontSize: '20px' }} />
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-surface border-2 border-outline-variant rounded-xl py-3 pl-10 pr-4 focus:border-primary focus:outline-none transition-colors"
                    placeholder="请输入姓名"
                  />
                </div>
              </div>
            )}

            {mode === 'register' && (
              <div>
                <label className="text-xs font-bold text-on-surface-variant mb-1 block">
                  年级
                </label>
                <div className="relative">
                  <MaterialIcon icon="school" className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" style={{ fontSize: '20px' }} />
                  <select
                    value={formData.grade}
                    onChange={(e) => setFormData({ ...formData, grade: parseInt(e.target.value) })}
                    className="w-full bg-surface border-2 border-outline-variant rounded-xl py-3 pl-10 pr-4 focus:border-primary focus:outline-none transition-colors appearance-none"
                  >
                    {Array.from({ length: 12 }, (_, i) => (
                      <option key={i + 1} value={i + 1}>
                        {i + 1}年级
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            <div>
              <label className="text-xs font-bold text-on-surface-variant mb-1 block">
                邮箱
              </label>
              <div className="relative">
                <MaterialIcon icon="email" className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" style={{ fontSize: '20px' }} />
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full bg-surface border-2 border-outline-variant rounded-xl py-3 pl-10 pr-4 focus:border-primary focus:outline-none transition-colors"
                  placeholder="请输入邮箱"
                  required
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-on-surface-variant mb-1 block">
                密码
              </label>
              <div className="relative">
                <MaterialIcon icon="lock" className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" style={{ fontSize: '20px' }} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full bg-surface border-2 border-outline-variant rounded-xl py-3 pl-10 pr-12 focus:border-primary focus:outline-none transition-colors"
                  placeholder="请输入密码"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface"
                >
                  {showPassword ? <MaterialIcon icon="visibility_off" className="" style={{ fontSize: '20px' }} /> : <MaterialIcon icon="visibility" className="" style={{ fontSize: '20px' }} />}
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
              disabled={loading}
              className="w-full bg-gradient-to-r from-primary to-primary-container text-on-primary rounded-full py-4 font-display font-bold text-lg hover:scale-[1.02] active:scale-95 transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                '处理中...'
              ) : (
                <>
                  {mode === 'login' ? '登录' : '注册'}
                  <MaterialIcon icon="arrow_forward" className="" style={{ fontSize: '20px' }} />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => router.push('/')}
              className="text-on-surface-variant text-sm hover:text-primary transition-colors"
            >
              返回首页
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-on-surface-variant mt-6">
          登录即表示同意《用户协议》和《隐私政策》
        </p>
      </motion.div>
    </div>
  );
}
