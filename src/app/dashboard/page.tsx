'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend, AreaChart, Area 
} from 'recharts';
import { 
  Calendar, FileText, Compass, BookOpen, Wallet, Shield, AlertTriangle, 
  CheckCircle, Clock, Search, ChevronRight, Filter, TrendingUp, Info
} from 'lucide-react';
import Swal from 'sweetalert2';

interface DashboardStats {
  counts: {
    meetings: number;
    plans: number;
    activities: number;
    trainings: number;
    budgets: number;
    emsReports: number;
    otherLaws: number;
  };
  totalBudget: number;
  totalDisputeValue: number;
  mediationResults: { name: string; value: number }[];
  recentItems: any[];
  trackingStatus: 'green' | 'yellow' | 'red';
  trackingDetails: any | null;
}

export default function DashboardPage() {
  const { user, profile } = useAuth();
  const [filterMonth, setFilterMonth] = useState<string>('');
  const [filterYear, setFilterYear] = useState<string>(String(new Date().getFullYear() + 543));
  const [stats, setStats] = useState<DashboardStats>({
    counts: { meetings: 0, plans: 0, activities: 0, trainings: 0, budgets: 0, emsReports: 0, otherLaws: 0 },
    totalBudget: 0,
    totalDisputeValue: 0,
    mediationResults: [
      { name: 'ตกลงกันได้', value: 0 },
      { name: 'ตกลงกันไม่ได้', value: 0 },
      { name: 'อื่นๆ', value: 0 }
    ],
    recentItems: [],
    trackingStatus: 'red',
    trackingDetails: null
  });
  const [loading, setLoading] = useState(true);

  // Month options in Thai
  const thaiMonths = [
    { value: '1', label: 'มกราคม' },
    { value: '2', label: 'กุมภาพันธ์' },
    { value: '3', label: 'มีนาคม' },
    { value: '4', label: 'เมษายน' },
    { value: '5', label: 'พฤษภาคม' },
    { value: '6', label: 'มิถุนายน' },
    { value: '7', label: 'กรกฎาคม' },
    { value: '8', label: 'สิงหาคม' },
    { value: '9', label: 'กันยายน' },
    { value: '10', label: 'ตุลาคม' },
    { value: '11', label: 'พฤศจิกายน' },
    { value: '12', label: 'ธันวาคม' }
  ];

  // Year options (Buddhist Era)
  const currentYearBE = new Date().getFullYear() + 543;
  const yearOptions = Array.from({ length: 5 }, (_, i) => String(currentYearBE - i));

  // Determine Grace Period
  const today = new Date();
  const isGracePeriod = today.getDate() < 3;

  useEffect(() => {
    if (user && profile) {
      fetchDashboardData();
    }
  }, [user, profile, filterMonth, filterYear]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const yearCE = parseInt(filterYear) - 543;
      const role = profile?.role || 'user';
      const myProvince = profile?.province;

      // Base query builder based on role
      const applyRoleFilter = (query: any) => {
        if (role === 'admin') {
          return query;
        } else if (role === 'subadmin' && myProvince) {
          return query.eq('profiles.province', myProvince);
        } else {
          return query.eq('user_id', user?.id);
        }
      };

      // Define date filter conditions
      const filterByDate = (query: any, dateColumn: string, isPlanOrYearText = false) => {
        if (isPlanOrYearText) {
          if (filterYear) {
            query = query.eq(dateColumn, filterYear);
          }
          return query;
        }

        if (filterYear) {
          const startDate = `${yearCE}-01-01`;
          const endDate = `${yearCE}-12-31`;
          query = query.gte(dateColumn, startDate).lte(dateColumn, endDate);
        }

        if (filterMonth) {
          const monthPad = filterMonth.padStart(2, '0');
          // PostgreSQL substring match or date_part
          if (filterYear) {
            const startDate = `${yearCE}-${monthPad}-01`;
            // Get last day of month
            const lastDay = new Date(yearCE, parseInt(filterMonth), 0).getDate();
            const endDate = `${yearCE}-${monthPad}-${lastDay}`;
            query = query.gte(dateColumn, startDate).lte(dateColumn, endDate);
          } else {
            // If only month is filtered (rare, but possible)
            query = query.filter(dateColumn, 'like', `%-${monthPad}-%`);
          }
        }

        return query;
      };

      // 1. Fetch count from all categories
      const getCategoryData = async (table: string, dateColumn: string, isYearText = false) => {
        let q = supabase.from(table).select('*, profiles!inner(*)', { count: 'exact' });
        q = applyRoleFilter(q);
        q = filterByDate(q, dateColumn, isYearText);
        q = q.eq('status', 'Active');
        const { data, count, error } = await q;
        if (error) console.error(`Error fetching ${table}:`, error);
        return { data: data || [], count: count || 0 };
      };

      const meetings = await getCategoryData('meetings', 'meeting_date');
      const plans = await getCategoryData('plans', 'year', true);
      const activities = await getCategoryData('activities', 'activity_date');
      const trainings = await getCategoryData('trainings', 'training_date');
      const budgets = await getCategoryData('budgets', 'approval_date');
      const emsReports = await getCategoryData('ems_reports', 'start_date_mediation');
      const otherLaws = await getCategoryData('other_laws_reports', 'report_date');

      // Calculate aggregates
      let totalBudget = 0;
      budgets.data.forEach((b: any) => {
        totalBudget += parseFloat(b.budget_amount) || 0;
      });

      let totalDisputeValue = 0;
      let successCases = 0;
      let failCases = 0;
      let otherCases = 0;

      emsReports.data.forEach((r: any) => {
        totalDisputeValue += parseFloat(r.value_in_dispute) || 0;
        const result = String(r.case_final).trim();
        if (result === 'ตกลงกันได้') successCases++;
        else if (result === 'ตกลงกันไม่ได้') failCases++;
        else otherCases++;
      });

      // Recent items consolidation
      const recentItems: any[] = [];
      const addRecent = (items: any[], type: string, titleField: string, dateField: string, icon: any, color: string) => {
        items.forEach(item => {
          recentItems.push({
            id: item.id,
            type,
            title: item[titleField],
            date: new Date(item[dateField]).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }),
            timestamp: new Date(item[dateField]).getTime(),
            icon,
            color
          });
        });
      };

      addRecent(meetings.data.slice(0, 3), 'การประชุม', 'meeting_name', 'meeting_date', Calendar, 'text-indigo-400');
      addRecent(activities.data.slice(0, 3), 'กิจกรรม', 'activity_name', 'activity_date', Compass, 'text-sky-400');
      addRecent(budgets.data.slice(0, 3), 'งบประมาณ', 'project_name', 'approval_date', Wallet, 'text-emerald-400');
      addRecent(emsReports.data.slice(0, 3), 'ไกล่เกลี่ย', 'case_no', 'start_date_mediation', Shield, 'text-rose-400');

      recentItems.sort((a, b) => b.timestamp - a.timestamp);

      // --- Tracking status check (For the active month / last month) ---
      // We calculate for targetMonth and targetYear (last month by default)
      const targetMonthVal = filterMonth ? parseInt(filterMonth) : (today.getMonth() === 0 ? 12 : today.getMonth());
      const targetYearVal = filterYear ? parseInt(filterYear) : (today.getMonth() === 0 ? currentYearBE - 1 : currentYearBE);

      let trackingStatus: 'green' | 'yellow' | 'red' = 'red';
      let trackingDetails = null;

      // Check if user has active reports in the target month (excluding plans & budgets)
      const hasGreenReport = 
        meetings.data.some((m: any) => m.user_id === user?.id) ||
        activities.data.some((a: any) => a.user_id === user?.id) ||
        trainings.data.some((t: any) => t.user_id === user?.id) ||
        emsReports.data.some((r: any) => r.user_id === user?.id) ||
        otherLaws.data.some((l: any) => l.user_id === user?.id);

      if (hasGreenReport) {
        trackingStatus = 'green';
      } else {
        // Check ZeroReport table for this user & month/year
        const { data: zeroData } = await supabase
          .from('zero_reports')
          .select('*')
          .eq('user_id', user?.id)
          .eq('month', targetMonthVal)
          .eq('year', targetYearVal)
          .eq('status', 'Active')
          .maybeSingle();

        if (zeroData) {
          trackingStatus = 'yellow';
          trackingDetails = zeroData;
        } else {
          trackingStatus = 'red';
        }
      }

      setStats({
        counts: {
          meetings: meetings.count,
          plans: plans.count,
          activities: activities.count,
          trainings: trainings.count,
          budgets: budgets.count,
          emsReports: emsReports.count,
          otherLaws: otherLaws.count
        },
        totalBudget,
        totalDisputeValue,
        mediationResults: [
          { name: 'ตกลงกันได้', value: successCases },
          { name: 'ตกลงกันไม่ได้', value: failCases },
          { name: 'อื่นๆ', value: otherCases }
        ],
        recentItems: recentItems.slice(0, 5),
        trackingStatus,
        trackingDetails
      });

    } catch (err) {
      console.error('Error compiling dashboard stats:', err);
    } finally {
      setLoading(false);
    }
  };

  const COLORS = ['#10b981', '#f43f5e', '#64748b'];

  const chartData = [
    { name: 'การประชุม', จำนวน: stats.counts.meetings },
    { name: 'กิจกรรม', จำนวน: stats.counts.activities },
    { name: 'อบรม', จำนวน: stats.counts.trainings },
    { name: 'ข้อพิพาทอื่น', จำนวน: stats.counts.otherLaws }
  ];

  return (
    <div className="space-y-8">
      {/* Filters & Title Section */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-slate-900/40 p-6 rounded-2xl border border-slate-800/60">
        <div>
          <h1 className="text-xl font-bold text-white">ยินดีต้อนรับ, คุณ{profile?.name || user?.email}</h1>
          <p className="text-sm text-slate-400 font-light mt-1">สรุปภาพรวมรายงานผลการดำเนินงานและสถิติคดีความไกล่เกลี่ย</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
            <Filter className="h-4 w-4 text-indigo-400" />
            <span className="text-xs text-slate-400">กรองตัวเลือก:</span>
          </div>

          <select
            value={filterMonth}
            onChange={(e) => setFilterMonth(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
          >
            <option value="">ทุกเดือน</option>
            {thaiMonths.map(m => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>

          <select
            value={filterYear}
            onChange={(e) => setFilterYear(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
          >
            {yearOptions.map(y => (
              <option key={y} value={y}>ปี พ.ศ. {y}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Bento Grid: Module KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        <div className="bg-slate-900 border border-slate-800/80 p-5 rounded-2xl hover:border-indigo-500/30 transition-all group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">การประชุม (ครั้ง)</span>
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 group-hover:scale-110 transition-transform">
              <Calendar className="h-5 w-5" />
            </div>
          </div>
          <p className="text-2xl font-bold text-white mt-4">{stats.counts.meetings}</p>
        </div>

        <div className="bg-slate-900 border border-slate-800/80 p-5 rounded-2xl hover:border-sky-500/30 transition-all group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">การจัดกิจกรรม (งาน)</span>
            <div className="p-2 rounded-xl bg-sky-500/10 text-sky-400 group-hover:scale-110 transition-transform">
              <Compass className="h-5 w-5" />
            </div>
          </div>
          <p className="text-2xl font-bold text-white mt-4">{stats.counts.activities}</p>
        </div>

        <div className="bg-slate-900 border border-slate-800/80 p-5 rounded-2xl hover:border-emerald-500/30 transition-all group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">งบประมาณสะสม (บาท)</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 group-hover:scale-110 transition-transform">
              <Wallet className="h-5 w-5" />
            </div>
          </div>
          <p className="text-2xl font-bold text-white mt-4">{stats.totalBudget.toLocaleString('th-TH')}</p>
        </div>

        <div className="bg-slate-900 border border-slate-800/80 p-5 rounded-2xl hover:border-rose-500/30 transition-all group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">ทุนทรัพย์ไกล่เกลี่ย (บาท)</span>
            <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400 group-hover:scale-110 transition-transform">
              <Shield className="h-5 w-5" />
            </div>
          </div>
          <p className="text-2xl font-bold text-white mt-4">{stats.totalDisputeValue.toLocaleString('th-TH')}</p>
        </div>
      </div>

      {/* Main Stats Panel (Charts & Status Tracking) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Monthly Status Tracking Card */}
        <div className="lg:col-span-1 bg-slate-900 border border-slate-800/80 p-6 rounded-2xl flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none" />
          
          <div>
            <div className="flex items-center gap-2">
              <Info className="h-4 w-4 text-indigo-400" />
              <h3 className="text-sm font-semibold text-slate-200">สถานะรายงานเดือนล่าสุด</h3>
            </div>
            
            <div className="mt-8 flex flex-col items-center justify-center p-6 bg-slate-950/40 rounded-2xl border border-slate-800/50">
              {stats.trackingStatus === 'green' && (
                <>
                  <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center shadow-lg shadow-emerald-500/10 mb-4 animate-pulse">
                    <CheckCircle className="h-8 w-8 text-emerald-400" />
                  </div>
                  <span className="text-sm font-semibold text-emerald-400">มีรายงานข้อมูลแล้ว</span>
                  <p className="text-[11px] text-slate-400 mt-2 text-center font-light">คุณรายงานข้อมูลคดี/กิจกรรมแล้วในเดือนนี้</p>
                </>
              )}

              {stats.trackingStatus === 'yellow' && (
                <>
                  <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shadow-lg shadow-amber-500/10 mb-4 animate-pulse">
                    <AlertTriangle className="h-8 w-8 text-amber-400" />
                  </div>
                  <span className="text-sm font-semibold text-amber-400">รายงานไม่มีผลงาน (Zero Report)</span>
                  <p className="text-[11px] text-slate-400 mt-2 text-center font-light">
                    ผู้รายงาน: {stats.trackingDetails?.reporter_name}<br/>
                    ลงชื่อเมื่อ: {new Date(stats.trackingDetails?.created_at).toLocaleDateString('th-TH')}
                  </p>
                </>
              )}

              {stats.trackingStatus === 'red' && (
                <>
                  <div className="w-16 h-16 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center shadow-lg shadow-rose-500/10 mb-4 animate-pulse">
                    <Clock className="h-8 w-8 text-rose-400" />
                  </div>
                  <span className="text-sm font-semibold text-rose-400">ยังไม่ส่งรายงาน</span>
                  <p className="text-[11px] text-slate-400 mt-2 text-center font-light">กรุณาส่งรายงานคดี คณะประชุม หรือสกรีนส่งตารางศูนย์ข้อมูลว่างเปล่า</p>
                </>
              )}
            </div>
          </div>

          <div className="mt-8 pt-4 border-t border-slate-800/60">
            <div className="flex justify-between items-center text-xs text-slate-400">
              <span>ระยะเวลาผ่อนผัน (Grace Period):</span>
              <span className={`px-2 py-0.5 rounded ${isGracePeriod ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' : 'bg-slate-800 text-slate-500'}`}>
                {isGracePeriod ? 'ยังอยู่ในกำหนด (ก่อนวันที่ 3)' : 'สิ้นสุดเวลาผ่อนผัน'}
              </span>
            </div>
          </div>
        </div>

        {/* Bar Chart: Category Counts */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800/80 p-6 rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-200">เปรียบเทียบสถิติการรายงานข้อมูล</h3>
            <span className="text-[10px] text-slate-500 font-light">นับตามจำนวนครั้งที่บันทึก</span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '12px' }}
                  labelStyle={{ color: '#94a3b8', fontSize: '12px' }}
                  itemStyle={{ color: '#fff', fontSize: '12px' }}
                />
                <Bar dataKey="จำนวน" fill="url(#colorIndigo)" radius={[8, 8, 0, 0]}>
                  <defs>
                    <linearGradient id="colorIndigo" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#4f46e5" stopOpacity={0.2}/>
                    </linearGradient>
                  </defs>
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Secondary Stats Panel (Mediation Pie Chart & Recent Logs) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Pie Chart: Mediation Results */}
        <div className="lg:col-span-1 bg-slate-900 border border-slate-800/80 p-6 rounded-2xl flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-200 mb-4">สถิติผลการไกล่เกลี่ยคดีความ</h3>
          </div>

          <div className="h-56 w-full flex justify-center">
            {stats.counts.emsReports > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.mediationResults}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {stats.mediationResults.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '12px' }}
                    itemStyle={{ color: '#fff', fontSize: '11px' }}
                  />
                  <Legend iconSize={10} layout="horizontal" verticalAlign="bottom" wrapperStyle={{ fontSize: '11px', color: '#94a3b8' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center text-slate-500 text-xs">
                <Shield className="h-8 w-8 mb-2 text-slate-600" />
                <span>ไม่มีข้อมูลสถิติคดีไกล่เกลี่ยในเงื่อนไขการค้นหา</span>
              </div>
            )}
          </div>
        </div>

        {/* Recent Activity Log list */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800/80 p-6 rounded-2xl">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-sm font-semibold text-slate-200">ประวัติบันทึกรายงานล่าสุด</h3>
            <span className="text-[10px] text-indigo-400 font-medium">สแกนจากระบบฐานข้อมูล</span>
          </div>

          <div className="space-y-4">
            {stats.recentItems.length > 0 ? (
              stats.recentItems.map((item, index) => {
                const Icon = item.icon;
                return (
                  <div key={item.id + index} className="flex items-center justify-between p-3.5 bg-slate-950/40 rounded-xl border border-slate-800/40 hover:border-slate-800 transition-all">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-xl bg-slate-900 border border-slate-800 ${item.color}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <span className="text-xs font-semibold text-slate-200 block">{item.title || '(ไม่มีชื่อเรื่อง)'}</span>
                        <span className="text-[10px] text-slate-500 block mt-1 font-light">โมดูล: {item.type}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 font-medium">{item.date}</span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="py-12 flex flex-col items-center justify-center text-slate-500 text-xs border border-dashed border-slate-800 rounded-xl">
                <FileText className="h-8 w-8 mb-2 text-slate-600" />
                <span>ไม่มีบันทึกประวัติการรายงานล่าสุด</span>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
