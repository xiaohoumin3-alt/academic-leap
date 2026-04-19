import Link from 'next/link';
import { Home, ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-surface p-6">
      <div className="max-w-md w-full bg-surface-container-lowest rounded-[2rem] p-8 shadow-xl text-center">
        <div className="w-24 h-24 rounded-full bg-surface-container flex items-center justify-center mx-auto mb-6">
          <span className="text-6xl font-display font-black text-primary">404</span>
        </div>

        <h1 className="text-2xl font-display font-black text-on-surface mb-4">
          页面不存在
        </h1>

        <p className="text-on-surface-variant mb-8">
          你访问的页面可能已被移动或删除。
        </p>

        <Link
          href="/"
          className="inline-flex items-center gap-2 w-full py-4 rounded-full bg-primary text-on-primary font-display font-bold text-lg justify-center hover:scale-[1.02] active:scale-95 transition-all"
        >
          <Home className="w-5 h-5" />
          返回首页
        </Link>
      </div>
    </div>
  );
}
