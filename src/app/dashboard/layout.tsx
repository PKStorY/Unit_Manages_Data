'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { 
  LayoutDashboard, FileText, Calendar, Compass, Award, ShieldAlert, 
  Menu, X, LogOut, User as UserIcon, BookOpen, Shield, ChevronDown, CheckCircle, AlertTriangle
} from 'lucide-react';
import Link from 'next/link';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, profile, loading, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [reportsOpen, setReportsOpen] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900 text-white">
        <div className="flex flex-col items-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
          <p className="mt-4 text-slate-400 font-medium">กำลังโหลดหน้าต่างระบบ...</p>
        </div>
      </div>
    );
  }

  const roleLabels = {
    admin: { label: 'ผู้ดูแลระบบ (Admin)', color: 'bg-rose-500/10 text-rose-400 border border-rose-500/20' },
    subadmin: { label: 'ผู้ดูแลจังหวัด (Sub-Admin)', color: 'bg-amber-500/10 text-amber-400 border border-amber-500/20' },
    user: { label: 'ศูนย์ไกล่เกลี่ยฯ', color: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' },
  };

  const currentRole = profile?.role || 'user';
  const roleBadge = roleLabels[currentRole];

  const reportModules = [
    { name: 'การประชุม', path: '/dashboard/meetings', icon: Calendar },
    { name: 'แผนงาน', path: '/dashboard/plans', icon: FileText },
    { name: 'กิจกรรม', path: '/dashboard/activities', icon: Compass },
    { name: 'การอบรม', path: '/dashboard/trainings', icon: BookOpen },
    { name: 'งบประมาณทั่วไป', path: '/dashboard/budgets', icon: FileText },
    { name: 'กองทุนยุติธรรม (กทย.4)', path: '/dashboard/justice-fund', icon: FileText },
    { name: 'ไกล่เกลี่ย พ.ร.บ. 2562', path: '/dashboard/ems_reports', icon: Shield },
    { name: 'กฎหมายอื่น', path: '/dashboard/other_laws_reports', icon: FileText },
    { name: 'รายงานไม่มีผลงาน', path: '/dashboard/zero_reports', icon: AlertTriangle },
  ];

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden" 
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-slate-900 border-r border-slate-800/80 transition-transform duration-300 lg:static lg:translate-x-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Brand Header */}
        <div className="flex h-20 items-center justify-between px-6 border-b border-slate-800/80">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 shadow-lg shadow-indigo-500/15">
              <Shield className="h-5 w-5 text-white" />
            </div>
            <div>
              <span className="font-semibold text-white text-sm block">ระบบบริหารศูนย์ไกล่เกลี่ย</span>
              <span className="text-[10px] text-indigo-400 block font-medium tracking-wider">RLPD PROTOTYPE SYSTEM</span>
            </div>
          </div>
          <button className="lg:hidden text-slate-400 hover:text-white" onClick={() => setSidebarOpen(false)}>
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* User Card */}
        <div className="px-6 py-5 border-b border-slate-800/40 bg-slate-900/40">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-800 border border-slate-700">
              <UserIcon className="h-5 w-5 text-indigo-400" />
            </div>
            <div className="overflow-hidden">
              <span className="text-xs font-semibold text-slate-200 block truncate">{profile?.name || user.email}</span>
              <span className="text-[10px] text-slate-500 block truncate mt-0.5">{profile?.province ? `จ.${profile.province}` : 'ส่วนกลาง'}</span>
            </div>
          </div>
          <div className="mt-3">
            <span className={`inline-block text-[10px] font-medium px-2 py-0.5 rounded ${roleBadge.color}`}>
              {roleBadge.label}
            </span>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 space-y-1 px-4 py-6 overflow-y-auto">
          {/* Main Dashboard Link */}
          <Link 
            href="/dashboard"
            onClick={() => setSidebarOpen(false)}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
              pathname === '/dashboard' 
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/15' 
                : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'
            }`}
          >
            <LayoutDashboard className="h-5 w-5" />
            <span>หน้าแรกสรุปข้อมูล</span>
          </Link>

          {/* Collapsible Modules list */}
          <div className="space-y-1">
            <button
              onClick={() => setReportsOpen(!reportsOpen)}
              className="w-full flex items-center justify-between px-4 py-3 text-slate-400 hover:bg-slate-800/50 hover:text-white rounded-xl text-sm font-medium transition-all"
            >
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5" />
                <span>รายงานข้อมูลประจำเดือน</span>
              </div>
              <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${reportsOpen ? 'rotate-180' : ''}`} />
            </button>

            {reportsOpen && (
              <div className="pl-4 space-y-1 animate-fadeIn">
                {reportModules.map((m) => {
                  const Icon = m.icon;
                  const isActive = pathname === m.path;
                  return (
                    <Link
                      key={m.path}
                      href={m.path}
                      onClick={() => setSidebarOpen(false)}
                      className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                        isActive
                          ? 'bg-slate-800 text-indigo-400 border-l-2 border-indigo-500 font-semibold'
                          : 'text-slate-400 hover:bg-slate-800/30 hover:text-white'
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span>{m.name}</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* Assessment System Link */}
          <Link 
            href="/dashboard/assessment"
            onClick={() => setSidebarOpen(false)}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
              pathname.startsWith('/dashboard/assessment')
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/15' 
                : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'
            }`}
          >
            <Award className="h-5 w-5" />
            <span>ประเมินองค์กรต้นแบบ (อกตบ.)</span>
          </Link>

          {/* Admin Tracking Link (Only visible to admin & subadmin) */}
          {(currentRole === 'admin' || currentRole === 'subadmin') && (
            <Link 
              href="/dashboard/tracking"
              onClick={() => setSidebarOpen(false)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                pathname.startsWith('/dashboard/tracking')
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/15' 
                  : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'
              }`}
            >
              <ShieldAlert className="h-5 w-5" />
              <span>ระบบติดตามศูนย์ประเมิน</span>
            </Link>
          )}
        </nav>

        {/* Footer SignOut */}
        <div className="p-4 border-t border-slate-800/60">
          <button 
            onClick={signOut}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-slate-950/40 hover:bg-red-500/10 hover:text-red-400 text-slate-400 font-medium rounded-xl text-sm transition-all border border-slate-800 hover:border-red-500/20 cursor-pointer"
          >
            <LogOut className="h-4 w-4" />
            <span>ออกจากระบบ</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top Navbar */}
        <header className="flex h-20 items-center justify-between border-b border-slate-800/80 px-6 lg:px-8 bg-slate-900/50 backdrop-blur-md">
          <button 
            className="lg:hidden text-slate-400 hover:text-white"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-6 w-6" />
          </button>

          <div className="hidden sm:block">
            <h2 className="text-lg font-semibold text-white">
              {pathname === '/dashboard' ? 'หน้าหลักสรุปข้อมูลการดำเนินงาน' : 'ระบบจัดการคลังข้อมูล'}
            </h2>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-xs text-slate-400 font-light">ข้อมูลหน่วยงาน</p>
              <p className="text-xs font-semibold text-slate-200">{profile?.name || 'ไม่ได้ระบุศูนย์'}</p>
            </div>
            <div className="h-8 w-px bg-slate-800" />
            <span className="text-xs text-indigo-400 font-medium">{new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
          </div>
        </header>

        {/* Content Body */}
        <main className="flex-1 overflow-y-auto p-6 lg:p-8 bg-slate-950">
          {children}
        </main>
      </div>
    </div>
  );
}
