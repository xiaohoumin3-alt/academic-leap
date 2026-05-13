import { redirect } from 'next/navigation';

export default function AdminPage() {
  // 重定向到管理后台主页
  redirect('/admin/complexity');
}
