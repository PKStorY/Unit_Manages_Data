'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Loader2 } from 'lucide-react';

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (user) {
        router.replace('/dashboard');
      } else {
        router.replace('/login');
      }
    }
  }, [user, loading, router]);

  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-slate-950 text-white min-h-screen">
      <Loader2 className="animate-spin h-10 w-10 text-indigo-500 mb-4" />
      <p className="text-slate-400 font-medium">กำลังเปลี่ยนเส้นทาง...</p>
    </div>
  );
}
