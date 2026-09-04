import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-center">
      <p className="text-6xl font-extrabold text-primary">404</p>
      <p className="text-sm text-text-secondary">Page not found · الصفحة غير موجودة</p>
      <Link
        href="/dashboard"
        className="text-sm font-semibold text-primary underline-offset-4 hover:underline"
      >
        Dashboard · لوحة التحكم
      </Link>
    </div>
  );
}
