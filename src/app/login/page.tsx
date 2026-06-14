'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Shield, Mail, Lock, AlertCircle, Loader2 } from 'lucide-react';
import Swal from 'sweetalert2';

export default function LoginPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!loading && user && profile) {
      if (profile.status === 'ปิด') {
        supabase.auth.signOut();
        setErrorMsg('บัญชีของคุณถูกปิดการใช้งาน กรุณาติดต่อผู้ดูแลระบบ');
      } else {
        router.replace('/dashboard');
      }
    }
  }, [user, profile, loading, router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMsg('กรุณากรอกอีเมลและรหัสผ่าน');
      return;
    }

    setAuthLoading(true);
    setErrorMsg('');

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password,
      });

      if (error) {
        setErrorMsg('อีเมลหรือรหัสผ่านไม่ถูกต้อง');
      } else if (data.user) {
        // Fetch profile to verify status
        const { data: prof, error: profErr } = await supabase
          .from('profiles')
          .select('status')
          .eq('id', data.user.id)
          .single();

        if (prof && prof.status === 'ปิด') {
          await supabase.auth.signOut();
          setErrorMsg('บัญชีของคุณถูกปิดการใช้งาน กรุณาติดต่อผู้ดูแลระบบ');
        } else {
          Swal.fire({
            icon: 'success',
            title: 'เข้าสู่ระบบสำเร็จ',
            text: 'ยินดีต้อนรับเข้าสู่ระบบจัดการข้อมูล',
            timer: 1500,
            showConfirmButton: false,
          });
          router.replace('/dashboard');
        }
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('เกิดข้อผิดพลาดในการเชื่อมต่อระบบ');
    } finally {
      setAuthLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-slate-950 text-white min-h-screen">
        <Loader2 className="animate-spin h-10 w-10 text-indigo-500 mb-4" />
        <p className="text-slate-400 font-medium">กำลังเตรียมข้อมูลระบบ...</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 min-h-screen p-4">
      {/* Background ambient glows */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-3xl shadow-2xl p-8 transform transition-all duration-300 hover:scale-[1.01] hover:border-slate-700/50 relative z-10">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/20 mb-4">
            <Shield className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-xl font-semibold text-white text-center">
            ระบบบริหารข้อมูลการดำเนินงาน
          </h1>
          <p className="text-sm text-slate-400 mt-1 text-center font-light">
            ศูนย์ไกล่เกลี่ยข้อพิพาทภาคประชาชน
          </p>
        </div>

        {errorMsg && (
          <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl text-sm mb-6 animate-pulse">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              อีเมลผู้ใช้งาน (Email)
            </label>
            <div className="relative">
              <Mail className="absolute left-4 top-3.5 h-5 w-5 text-slate-500" />
              <input
                type="email"
                placeholder="example@rlpd.go.th"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-950/50 border border-slate-800 rounded-xl py-3 pl-12 pr-4 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-sm"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              รหัสผ่าน (Password)
            </label>
            <div className="relative">
              <Lock className="absolute left-4 top-3.5 h-5 w-5 text-slate-500" />
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-950/50 border border-slate-800 rounded-xl py-3 pl-12 pr-4 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-sm"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={authLoading}
            className="w-full bg-gradient-to-r from-indigo-500 to-blue-600 hover:from-indigo-600 hover:to-blue-700 text-white font-medium py-3 px-4 rounded-xl shadow-lg shadow-indigo-500/10 hover:shadow-indigo-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 text-sm mt-8"
          >
            {authLoading ? (
              <>
                <Loader2 className="animate-spin h-5 w-5" />
                <span>กำลังเข้าสู่ระบบ...</span>
              </>
            ) : (
              <span>เข้าสู่ระบบ</span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
