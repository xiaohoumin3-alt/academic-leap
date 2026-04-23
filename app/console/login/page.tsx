'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import MaterialIcon from '../../../components/MaterialIcon';

export default function AdminLoginPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    email: 'admin@example.com',
    password: 'admin123',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || '登录失败');
        setLoading(false);
        return;
      }

      router.push('/console');
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
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary-container flex items-center justify-center mx-auto mb-4 shadow-lg shadow-primary/20">
            <MaterialIcon icon="rocket_launch" className="w-8 h-8 text-on-primary" />
          </div>
          <h1 className="text-3xl font-display font-black text-primary mb-2">
            后台管理系统
          </h1>
          <p className="text-on-surface-variant text-sm">
            内容引擎控制台
          </p>
        </div>

        {/* Form Card */}
        <div className="bg-surface-container-lowest rounded-[2rem] p-8 border border-outline-variant/5 shadow-xl">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="text-xs font-bold text-on-surface-variant mb-2 block uppercase tracking-wider">
                管理员邮箱
              </label>
              <div className="relative">
                <MaterialIcon icon="email" className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant" />
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full bg-surface-container-low border-2 border-outline-variant/20 rounded-xl py-3.5 pl-12 pr-4 focus:border-primary focus:outline-none transition-colors font-medium"
                  placeholder="admin@example.com"
                  required
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-on-surface-variant mb-2 block uppercase tracking-wider">
                密码
              </label>
              <div className="relative">
                <MaterialIcon icon="lock" className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full bg-surface-container-low border-2 border-outline-variant/20 rounded-xl py-3.5 pl-12 pr-12 focus:border-primary focus:outline-none transition-colors font-medium"
                  placeholder="请输入密码"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-primary transition-colors"
                >
                  {showPassword ? <MaterialIcon icon="visibility_off" /> : <MaterialIcon icon="visibility" />}
                </button>
              </div>
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-error-container/20 text-error text-sm py-3 px-4 rounded-xl flex items-center gap-2"
              >
                <MaterialIcon icon="error" className="w-4 h-4" />
                {error}
              </motion.div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-primary to-primary-container text-on-primary rounded-full py-4 font-display font-bold text-lg hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-on-primary border-t-transparent rounded-full animate-spin" />
                  登录中...
                </>
              ) : (
                <>
                  登录控制台
                  <MaterialIcon icon="arrow_forward" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-outline-variant/10 text-center">
            <button
              onClick={() => router.push('/')}
              className="text-on-surface-variant text-sm hover:text-primary transition-colors flex items-center gap-2 mx-auto"
            >
              <MaterialIcon icon="home" className="w-4 h-4" />
              返回首页
            </button>
          </div>
        </div>

        <div className="mt-6 text-center">
          <p className="text-xs text-on-surface-variant/60 font-mono">
            Test Credentials: admin@example.com / admin123
          </p>
        </div>
      </motion.div>
    </div>
  );
}
