'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend, AreaChart, Area 
} from 'recharts';
import { 
  Calendar, FileText, Compass, BookOpen, Wallet, Shield, AlertTriangle, 
  CheckCircle, Clock, Search, ChevronRight, Filter, TrendingUp, Info,
  Mic, MicOff, Sparkles, Loader2, X
} from 'lucide-react';
import Swal from 'sweetalert2';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';

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
  const router = useRouter();
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

  // AI Voice & Text integration states
  const [aiStoryText, setAiStoryText] = useState('');
  const [aiParsing, setAiParsing] = useState(false);
  const [scriptsModalOpen, setScriptsModalOpen] = useState(false);
  const [activeScriptTab, setActiveScriptTab] = useState('justice_fund');

  const { isListening, startListening, stopListening, isSupported } = useSpeechRecognition({
    onResult: (text, isFinal) => {
      if (isFinal) {
        setAiStoryText(prev => prev ? prev + ' ' + text : text);
      }
    }
  });

  const handleGlobalAIParsing = async () => {
    if (!aiStoryText || !aiStoryText.trim()) {
      Swal.fire('คำเตือน', 'กรุณาระบุรายละเอียดข้อความเสียงหรือพิมพ์ข้อมูลก่อนกดประมวลผล', 'warning');
      return;
    }

    setAiParsing(true);
    try {
      const res = await fetch('/api/ai/classify-and-parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ story: aiStoryText })
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || 'เกิดข้อผิดพลาดในการประมวลผลข้อมูลด้วย AI');
      }

      const { category, categoryTitle, categoryPath, data } = result;

      // Option B: Show verification dialog with sweetalert2
      const dataKeys = Object.keys(data);
      let summaryHtml = '<div class="text-left bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs space-y-2 text-slate-300 font-sans overflow-y-auto max-h-60">';
      
      dataKeys.forEach(k => {
        if (k === 'activities' && Array.isArray(data[k])) {
          summaryHtml += `<p class="text-indigo-400 font-bold border-b border-slate-800 pb-1 mt-2">📌 รายการกิจกรรมย่อย (${data[k].length} รายการ):</p>`;
          data[k].forEach((act: any, idx: number) => {
            summaryHtml += `<div class="pl-2 border-l border-indigo-500/30 my-1">
              <strong>${idx + 1}. ${act.name || '(ไม่มีชื่อ)'}</strong><br/>
              - ช่วงเวลา: ${act.start_date || '?'} ถึง ${act.end_date || '?'}<br/>
              ${act.budget ? `- งบประมาณ: ${parseFloat(act.budget).toLocaleString()} บาท<br/>` : ''}
              ${act.owner ? `- ผู้รับผิดชอบ: ${act.owner}<br/>` : ''}
            </div>`;
          });
        } else if (data[k] !== undefined && data[k] !== null && data[k] !== '') {
          // Map technical field names to clean Thai labels for display
          const keyLabels: Record<string, string> = {
            title: 'ชื่อแผนงาน/โครงการ',
            year: 'ปีงบประมาณ (พ.ศ.)',
            project_description: 'รายละเอียดวัตถุประสงค์',
            meeting_name: 'ชื่อการประชุม',
            meeting_date: 'วันที่ประชุม',
            location: 'สถานที่จัด',
            summary: 'สรุปผล/รายงานผลงาน',
            course_name: 'ชื่อหลักสูตรอบรม',
            training_date: 'วันที่จัดอบรม',
            unit_training: 'หน่วยงานผู้จัด',
            project_name: 'ชื่อโครงการเบิกจ่าย',
            approval_date: 'วันที่อนุมัติเบิกจ่าย',
            budget_amount: 'จำนวนงบประมาณ (บาท)',
            case_no: 'เลขคำร้อง',
            start_date_mediation: 'วันที่รับคำร้อง',
            case_type: 'ประเภทข้อพิพาท',
            civil_dispute_type: 'ข้อพิพาททางแพ่ง',
            criminal_dispute_type: 'ข้อพิพาททางอาญา',
            value_in_dispute: 'ทุนทรัพย์ (บาท)',
            case_final: 'ผลการไกล่เกลี่ย',
            dispute_type: 'ประเภทข้อพิพาทกฎหมายอื่น',
            details: 'รายละเอียดปัญหา',
            action_type: 'การดำเนินการเบื้องต้น',
            action_detail: 'รายละเอียดการปฏิบัติ',
            month: 'รายงานรอบเดือน',
            reporter_name: 'ชื่อผู้รายงาน/ผู้บันทึก',
            reporter_phone: 'เบอร์ติดต่อผู้บันทึก',
            source_info: 'ผู้ประสานงานหลัก',
            source_contact: 'เบอร์โทรผู้ประสานงาน',
          };
          const displayKey = keyLabels[k] || k;
          summaryHtml += `<p><strong>🔹 ${displayKey}:</strong> ${data[k]}</p>`;
        }
      });
      summaryHtml += '</div>';

      Swal.fire({
        title: `🤖 AI ตรวจพบรายงาน "${categoryTitle}"`,
        html: `
          <div class="text-slate-300 text-xs font-light text-left mb-3">
            วิเคราะห์คำพูดของคุณสำเร็จแล้ว ตรวจพบหมวดหมู่และคอลัมน์ต่อไปนี้:
          </div>
          ${summaryHtml}
          <div class="text-slate-400 text-[10px] text-left mt-3">
            *กดยืนยันเพื่อนำทางไปยังหน้าแบบฟอร์มและระบบจะกรอกข้อมูลนี้ลงช่องรับข้อมูลให้คุณโดยอัตโนมัติ
          </div>
        `,
        icon: 'info',
        showCancelButton: true,
        confirmButtonText: 'ยืนยันและนำทางไปหน้าแบบฟอร์ม',
        cancelButtonText: 'ยกเลิก',
        confirmButtonColor: '#4f46e5',
        cancelButtonColor: '#1e293b',
        background: '#0f172a',
        color: '#f8fafc',
        customClass: {
          popup: 'rounded-2xl border border-slate-800',
          title: 'text-sm font-semibold text-white',
          confirmButton: 'text-xs rounded-xl font-medium px-4 py-2.5',
          cancelButton: 'text-xs rounded-xl font-medium px-4 py-2.5'
        }
      }).then((swalResult) => {
        if (swalResult.isConfirmed) {
          // Save in session storage and route
          sessionStorage.setItem('ai_pending_autofill', JSON.stringify({ category, data }));
          setAiStoryText('');
          router.push(categoryPath);
        }
      });

    } catch (err: any) {
      console.error(err);
      Swal.fire({
        icon: 'error',
        title: 'เกิดข้อผิดพลาด',
        text: err.message || 'ไม่สามารถวิเคราะห์ข้อมูลได้',
        background: '#0f172a',
        color: '#f8fafc'
      });
    } finally {
      setAiParsing(false);
    }
  };

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

      {/* AI Voice Command Center (ไมโครโฟนกลาง) */}
      <div className="bg-gradient-to-br from-indigo-950/40 via-slate-900/40 to-slate-900/40 border border-slate-800/60 p-6 rounded-2xl relative overflow-hidden shadow-xl mt-8">
        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex items-center gap-2 mb-4">
          <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400">
            <Sparkles className="h-5 w-5 animate-pulse" />
          </div>
          <span className="text-sm font-semibold text-slate-200">ศูนย์กลางเสียงสั่งงานอัจฉริยะ (Global AI Voice Assistant)</span>
        </div>

        {/* Recording Container (Without headers/descriptions as requested) */}
        <div className="relative rounded-xl border border-slate-800 bg-slate-950/80 p-4">
          <textarea
            value={aiStoryText}
            onChange={(e) => setAiStoryText(e.target.value)}
            placeholder="แตะไมค์แล้วเริ่มพูดเล่าเรื่องโครงการ แผนงาน หรือรายงานคดีไกล่เกลี่ยที่นี่... หรือจะพิมพ์บอกรายละเอียดโดยตรงก็ได้เช่นกัน..."
            className="w-full bg-transparent border-0 text-slate-100 placeholder-slate-500 text-sm focus:ring-0 focus:outline-none resize-y min-h-[120px] font-light leading-relaxed"
            rows={5}
          />
          
          <div className="flex items-center justify-between border-t border-slate-800/60 pt-3 mt-2">
            <div className="flex items-center gap-3">
              {isSupported ? (
                <button
                  type="button"
                  onClick={isListening ? stopListening : startListening}
                  className={`flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-medium transition-all ${
                    isListening 
                      ? 'bg-rose-600 text-white animate-pulse shadow-lg shadow-rose-600/20' 
                      : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
                  }`}
                >
                  {isListening ? (
                    <>
                      <MicOff className="h-4 w-4" />
                      <span>หยุดบันทึกเสียง</span>
                    </>
                  ) : (
                    <>
                      <Mic className="h-4 w-4 text-indigo-400" />
                      <span>บันทึกเสียงพูด</span>
                    </>
                  )}
                </button>
              ) : (
                <span className="text-[10px] text-slate-500">บราวเซอร์ของคุณไม่รองรับ Speech Recognition</span>
              )}

              {isListening && (
                <div className="flex items-center gap-1.5 pl-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
                  <span className="text-[10px] text-rose-400 font-medium">กำลังรับฟังเสียง...</span>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={handleGlobalAIParsing}
              disabled={aiParsing || !aiStoryText.trim()}
              className="flex items-center justify-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 text-white text-xs font-semibold rounded-xl transition-all shadow-md shadow-indigo-600/10 cursor-pointer"
            >
              {aiParsing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                  <span>กำลังวิเคราะห์...</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  <span>ประมวลผลด้วย AI</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Examples section */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">💡 แนะนำตัวอย่างการพูดสั่งงาน (กดคลิกเพื่อลองสคริปต์):</p>
            <button
              type="button"
              onClick={() => setScriptsModalOpen(true)}
              className="text-[10px] text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1 transition-all cursor-pointer"
            >
              <Info className="h-3.5 w-3.5 animate-pulse" />
              <span>ดูสคริปต์นำทางคำพูดแบบละเอียด (9 หมวดหมู่)</span>
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setAiStoryText("บันทึกแผนงานโครงการประจำปีงบประมาณ 2569 ชื่อโครงการ เผยแพร่ความรู้สิทธิตามกฎหมาย มีกิจกรรมย่อย ได้แก่ 1. สัมมนาเจ้าหน้าที่ วันเริ่ม 1 กุมภาพันธ์ 2569 ถึง 15 กุมภาพันธ์ 2569 งบประมาณ 15000 บาท 2. ลงพื้นที่ชุมชน วันเริ่ม 1 มีนาคม 2569 ถึง 30 เมษายน 2569 งบประมาณ 20000 บาท บันทึกโดย นางสาวสมรัก ยิ้มแย้ม โทร 0891234567")}
              className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800/80 text-[10px] text-slate-400 hover:text-slate-200 transition-all font-light cursor-pointer"
            >
              📋 แผนโครงการประจำปี
            </button>
            <button
              type="button"
              onClick={() => setAiStoryText("รายงานไกล่เกลี่ยข้อพิพาททางแพ่ง เลขคำร้อง กก.02/2569 วันที่รับคำร้อง 1 มิถุนายน 2569 ทุนทรัพย์ 120000 บาท คดีกู้ยืมเงิน ผลการไกล่เกลี่ยตกลงกันได้สำเร็จ โดยไกล่เกลี่ยสำเร็จวันที่ 20 มิถุนายน 2569 บันทึกโดย นายรุ่งโรจน์ สมบูรณ์ โทร 0867891234")}
              className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800/80 text-[10px] text-slate-400 hover:text-slate-200 transition-all font-light cursor-pointer"
            >
              ⚖️ รายงานไกล่เกลี่ย พ.ร.บ.
            </button>
            <button
              type="button"
              onClick={() => setAiStoryText("บันทึกการประชุมคณะทำงาน วันประชุมวันที่ 25 มิถุนายน 2569 เวลา 9 โมงเช้า ที่ห้องประชุมใหญ่ชั้น 5 หัวเรื่องประชุม ติดตามผลงานประจำปี ประธานการประชุมคือ นายทวีศักดิ์ เลิศล้ำ ผู้จดบันทึกคือ นางสาวอรวรรณ เรียนดี โทร 0856781234 มติการประชุมคือเห็นชอบกับแผนงานรอบปีงบประมาณใหม่")}
              className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800/80 text-[10px] text-slate-400 hover:text-slate-200 transition-all font-light cursor-pointer"
            >
              👥 บันทึกจัดประชุมคณะทำงาน
            </button>
            <button
              type="button"
              onClick={() => setAiStoryText("ในรอบเดือนมิถุนายน 2569 นี้ ทางศูนย์ประสานงานไกล่เกลี่ยภาคประชาชนไม่มีรายงานหรือผลงานการดำเนินโครงการประชุมหรือการเจรจาคดีใดๆ บันทึกโดย นายวินัย รักสงบ โทร 0811112233")}
              className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800/80 text-[10px] text-slate-400 hover:text-slate-200 transition-all font-light cursor-pointer"
            >
              📭 รายงานไม่มีผลงาน (Zero)
            </button>
          </div>
        </div>
      </div>

      {/* Voice Scripts Guideline Modal */}
      {scriptsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-950/40">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-indigo-400" />
                <div>
                  <h3 className="text-sm font-semibold text-white">💡 คลังสคริปต์คำพูดไกด์ไลน์ (Voice Dictation Guides)</h3>
                  <p className="text-[10px] text-slate-400 font-light mt-0.5">เลือกหมวดหมู่เพื่อดูสคริปต์ตัวอย่างแนวทางการพูดสำหรับใช้กับ AI Voice Assistant เพื่อให้ได้ผลลัพธ์การสกัดข้อมูลถูกต้อง 100%</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setScriptsModalOpen(false)}
                className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-all cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
              {/* Sidebar Tabs */}
              <div className="w-full md:w-60 bg-slate-950/30 border-r border-slate-800 p-4 overflow-y-auto space-y-1">
                <span className="text-[9px] text-slate-500 uppercase tracking-wider font-bold block px-2.5 mb-2">เลือกประเภทรายงาน</span>
                {[
                  { id: 'justice_fund', label: 'ขอทุนกองทุนยุติธรรม', desc: 'แบบ กทย.4' },
                  { id: 'budgets', label: 'ของบประมาณอื่นๆ', desc: 'งบประมาณทั่วไป' },
                  { id: 'meetings', label: 'การประชุมคณะทำงาน', desc: 'รายงานการประชุม' },
                  { id: 'plans', label: 'แผนการดำเนินงาน', desc: 'แผนและกิจกรรมย่อย' },
                  { id: 'activities', label: 'การจัดกิจกรรม', desc: 'รายงานผลกิจกรรม' },
                  { id: 'trainings', label: 'การอบรมสัมมนา', desc: 'ข้อมูลผู้เข้าอบรม' },
                  { id: 'ems_reports', label: 'ไกล่เกลี่ย พ.ร.บ. 2562', desc: 'รายงานเคสไกล่เกลี่ย' },
                  { id: 'other_laws_reports', label: 'การไกล่เกลี่ยกฎหมายอื่น', desc: 'ให้คำแนะนำ/ส่งต่อ' },
                  { id: 'zero_reports', label: 'รายงานไม่มีผลงาน', desc: 'Zero Report' },
                ].map(tab => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveScriptTab(tab.id)}
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs transition-all flex flex-col gap-0.5 ${
                      activeScriptTab === tab.id 
                        ? 'bg-indigo-600 text-white font-medium shadow-md shadow-indigo-600/10' 
                        : 'text-slate-400 hover:bg-slate-850/50 hover:text-white'
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span className={`text-[9px] ${activeScriptTab === tab.id ? 'text-indigo-200' : 'text-slate-500'}`}>{tab.desc}</span>
                  </button>
                ))}
              </div>

              {/* Tab Content Display */}
              <div className="flex-1 p-6 overflow-y-auto space-y-6 text-xs text-slate-300">
                {/* Script descriptions */}
                {activeScriptTab === 'justice_fund' && (
                  <div className="space-y-4">
                    <div className="border-l-2 border-indigo-500 pl-3">
                      <span className="text-white font-semibold text-sm">สคริปต์ขอเสนอโครงการ กองทุนยุติธรรม (กทย.4)</span>
                      <p className="text-[10px] text-slate-500 mt-1">ใช้สำหรับพูดรายละเอียดข้อมูลทั่วไป วัตถุประสงค์ และผู้ประสานงานของศูนย์ในการเสนอขอทุน</p>
                    </div>

                    <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                      <span className="text-[10px] text-indigo-400 font-bold block">🗣️ บทพูดแนะนำที่ควรอ่านออกเสียง:</span>
                      <p className="leading-relaxed font-light text-slate-200">
                        "เสนอโครงการ <span className="bg-indigo-900/30 text-indigo-300 px-1 py-0.5 rounded font-mono">ชื่อโครงการเต็มของคุณ</span> เสนอโดยประธานศูนย์ไกล่เกลี่ย <span className="bg-indigo-900/30 text-indigo-300 px-1 py-0.5 rounded font-mono">ชื่อประธานศูนย์</span> ที่ตั้งสำนักงานอยู่ที่ <span className="bg-indigo-900/30 text-indigo-300 px-1 py-0.5 rounded font-mono">ระบุที่อยู่เลขที่ ถนน ตำบล อำเภอ จังหวัด</span> มีผู้ประสานงานหลักคือ <span className="bg-indigo-900/30 text-indigo-300 px-1 py-0.5 rounded font-mono">ชื่อผู้ประสานงาน</span> โทรศัพท์ติดต่อ <span className="bg-indigo-900/30 text-indigo-300 px-1 py-0.5 rounded font-mono">เบอร์โทรศัพท์</span> อีเมล <span className="bg-indigo-900/30 text-indigo-300 px-1 py-0.5 rounded font-mono">อีเมลผู้ติดต่อ</span> วัตถุประสงค์เพื่อส่งเสริมการเข้าถึงกระบวนการยุติธรรมและสร้างความรู้กฎหมายแก่ประชาชนในพื้นที่ จัดอบรมในวันที่ <span className="bg-indigo-900/30 text-indigo-300 px-1 py-0.5 rounded font-mono">วันที่เริ่มต้นจัด เช่น 15 สิงหาคม 2569</span> สิ้นสุดวันที่ <span className="bg-indigo-900/30 text-indigo-300 px-1 py-0.5 rounded font-mono">วันที่เสร็จสิ้น</span> และดำเนินการประชุมเห็นชอบของคณะทำงานเมื่อวันที่ <span className="bg-indigo-900/30 text-indigo-300 px-1 py-0.5 rounded font-mono">วันที่จัดประชุมเห็นชอบ</span>"
                      </p>
                    </div>

                    <div className="space-y-2">
                      <span className="text-[10px] text-slate-400 font-bold block">💡 เคล็ดลับเพิ่มเติม:</span>
                      <ul className="list-disc pl-4 space-y-1 text-slate-400 font-light leading-relaxed">
                        <li>ระบุวันที่เป็น ค.ศ. หรือ พ.ศ. ให้ชัดเจน เช่น "วันที่ 12 สิงหาคม 2569" เพื่อให้ AI แปลงรูปแบบได้แม่นยำ</li>
                        <li>ชื่อศูนย์และประธานศูนย์จะถูกอ้างอิงไปใช้ในการจัดทำหนังสือรับรองประธาน และรายงานการประชุมโดยอัตโนมัติ</li>
                      </ul>
                    </div>
                  </div>
                )}

                {activeScriptTab === 'budgets' && (
                  <div className="space-y-4">
                    <div className="border-l-2 border-indigo-500 pl-3">
                      <span className="text-white font-semibold text-sm">สคริปต์ขออนุมัติเบิกจ่ายงบประมาณอื่นๆ</span>
                      <p className="text-[10px] text-slate-500 mt-1">ใช้สำหรับการรายงานการขออนุมัติเงินโครงการหรืองบประมาณเบิกจ่ายทั่วไปที่ไม่ใช่เงินกองทุน</p>
                    </div>

                    <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                      <span className="text-[10px] text-indigo-400 font-bold block">🗣️ บทพูดแนะนำที่ควรอ่านออกเสียง:</span>
                      <p className="leading-relaxed font-light text-slate-200">
                        "ขอเบิกจ่ายงบประมาณโครงการ <span className="bg-indigo-900/30 text-indigo-300 px-1 py-0.5 rounded font-mono">ชื่อโครงการ</span> ได้รับอนุมัติงบประมาณจำนวน <span className="bg-indigo-900/30 text-indigo-300 px-1 py-0.5 rounded font-mono">ยอดเงินอนุมัติ เช่น 35000</span> บาท วันที่ได้รับการอนุมัติเบิกจ่ายคือวันที่ <span className="bg-indigo-900/30 text-indigo-300 px-1 py-0.5 rounded font-mono">วันที่อนุมัติ</span> และจัดโครงการเสร็จสิ้นวันที่ <span className="bg-indigo-900/30 text-indigo-300 px-1 py-0.5 rounded font-mono">วันที่จัดเสร็จ</span> โดยมีเงินงบประมาณส่งคืนจำนวน <span className="bg-indigo-900/30 text-indigo-300 px-1 py-0.5 rounded font-mono">เงินทอนคลัง เช่น 1500</span> บาท รายงานโดย <span className="bg-indigo-900/30 text-indigo-300 px-1 py-0.5 rounded font-mono">ผู้รายงาน</span> โทรศัพท์ติดต่อ <span className="bg-indigo-900/30 text-indigo-300 px-1 py-0.5 rounded font-mono">เบอร์ติดต่อ</span>"
                      </p>
                    </div>
                  </div>
                )}

                {activeScriptTab === 'meetings' && (
                  <div className="space-y-4">
                    <div className="border-l-2 border-indigo-500 pl-3">
                      <span className="text-white font-semibold text-sm">สคริปต์จดรายงานการประชุมคณะทำงาน</span>
                      <p className="text-[10px] text-slate-500 mt-1">ใช้สำหรับการจดบันทึกประเด็นและมติที่ประชุมในแต่ละคณะทำงานประจำพื้นที่</p>
                    </div>

                    <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                      <span className="text-[10px] text-indigo-400 font-bold block">🗣️ บทพูดแนะนำที่ควรอ่านออกเสียง:</span>
                      <p className="leading-relaxed font-light text-slate-200">
                        "รายงานการประชุมคณะทำงานประจำปี ครั้งที่ <span className="bg-indigo-900/30 text-indigo-300 px-1 py-0.5 rounded font-mono">1/2569</span> จัดประชุมเมื่อวันที่ <span className="bg-indigo-900/30 text-indigo-300 px-1 py-0.5 rounded font-mono">วันที่จัด</span> ณ <span className="bg-indigo-900/30 text-indigo-300 px-1 py-0.5 rounded font-mono">สถานที่จัด</span> โดยมีมติที่ประชุมเห็นชอบใน <span className="bg-indigo-900/30 text-indigo-300 px-1 py-0.5 rounded font-mono">สรุปมติเห็นชอบโครงการ</span> บันทึกรายงานโดย <span className="bg-indigo-900/30 text-indigo-300 px-1 py-0.5 rounded font-mono">ชื่อของคุณ</span> โทรศัพท์ <span className="bg-indigo-900/30 text-indigo-300 px-1 py-0.5 rounded font-mono">เบอร์โทร</span>"
                      </p>
                    </div>
                  </div>
                )}

                {activeScriptTab === 'plans' && (
                  <div className="space-y-4">
                    <div className="border-l-2 border-indigo-500 pl-3">
                      <span className="text-white font-semibold text-sm">สคริปต์แผนการดำเนินงานประจำปี</span>
                      <p className="text-[10px] text-slate-500 mt-1">ใช้สำหรับการระบุโครงร่างแผนงานภาพใหญ่ตลอดปีพร้อมกิจกรรมย่อย</p>
                    </div>

                    <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                      <span className="text-[10px] text-indigo-400 font-bold block">🗣️ บทพูดแนะนำที่ควรอ่านออกเสียง:</span>
                      <p className="leading-relaxed font-light text-slate-200">
                        "รายงานแผนงานโครงการหลักชื่อ <span className="bg-indigo-900/30 text-indigo-300 px-1 py-0.5 rounded font-mono">ชื่อโครงการหลัก</span> ปีงบประมาณ <span className="bg-indigo-900/30 text-indigo-300 px-1 py-0.5 rounded font-mono">2569</span> บันทึกโดย <span className="bg-indigo-900/30 text-indigo-300 px-1 py-0.5 rounded font-mono">ชื่อของคุณ</span> โทร <span className="bg-indigo-900/30 text-indigo-300 px-1 py-0.5 rounded font-mono">เบอร์ติดต่อ</span> มีกิจกรรมย่อยคือ กิจกรรม <span className="bg-indigo-900/30 text-indigo-300 px-1 py-0.5 rounded font-mono">ชื่อกิจกรรมย่อย</span> เริ่มวันที่ <span className="bg-indigo-900/30 text-indigo-300 px-1 py-0.5 rounded font-mono">วันที่จัด</span> ถึงวันที่ <span className="bg-indigo-900/30 text-indigo-300 px-1 py-0.5 rounded font-mono">วันที่เสร็จ</span> งบประมาณย่อย <span className="bg-indigo-900/30 text-indigo-300 px-1 py-0.5 rounded font-mono">งบประมาณ</span>"
                      </p>
                    </div>
                  </div>
                )}

                {activeScriptTab === 'activities' && (
                  <div className="space-y-4">
                    <div className="border-l-2 border-indigo-500 pl-3">
                      <span className="text-white font-semibold text-sm">สคริปต์รายงานผลกิจกรรมชุมชน</span>
                      <p className="text-[10px] text-slate-500 mt-1">ใช้สำหรับรายงานเมื่อศูนย์ดำเนินกิจกรรมลงพื้นที่เสร็จสิ้นแล้ว</p>
                    </div>

                    <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                      <span className="text-[10px] text-indigo-400 font-bold block">🗣️ บทพูดแนะนำที่ควรอ่านออกเสียง:</span>
                      <p className="leading-relaxed font-light text-slate-200">
                        "รายงานการจัดกิจกรรม <span className="bg-indigo-900/30 text-indigo-300 px-1 py-0.5 rounded font-mono">ชื่อกิจกรรม</span> วันที่ดำเนินกิจกรรมคือวันที่ <span className="bg-indigo-900/30 text-indigo-300 px-1 py-0.5 rounded font-mono">วันที่จัด</span> สถานที่คือ <span className="bg-indigo-900/30 text-indigo-300 px-1 py-0.5 rounded font-mono">สถานที่จัดกิจกรรม</span> มีผลสรุปคือ <span className="bg-indigo-900/30 text-indigo-300 px-1 py-0.5 rounded font-mono">สรุปผลการจัดกิจกรรม</span> บันทึกโดย <span className="bg-indigo-900/30 text-indigo-300 px-1 py-0.5 rounded font-mono">ชื่อผู้รายงาน</span>"
                      </p>
                    </div>
                  </div>
                )}

                {activeScriptTab === 'trainings' && (
                  <div className="space-y-4">
                    <div className="border-l-2 border-indigo-500 pl-3">
                      <span className="text-white font-semibold text-sm">สคริปต์บันทึกรายงานการอบรมสัมมนา</span>
                      <p className="text-[10px] text-slate-500 mt-1">ใช้รายงานประวัติความรู้ของผู้เข้าอบรมในหลักสูตรทางวิชาการ</p>
                    </div>

                    <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                      <span className="text-[10px] text-indigo-400 font-bold block">🗣️ บทพูดแนะนำที่ควรอ่านออกเสียง:</span>
                      <p className="leading-relaxed font-light text-slate-200">
                        "รายงานอบรมแบบ <span className="bg-indigo-900/30 text-indigo-300 px-1 py-0.5 rounded font-mono">ออนไลน์ หรือ ออนไซต์</span> หลักสูตร <span className="bg-indigo-900/30 text-indigo-300 px-1 py-0.5 rounded font-mono">ชื่อหลักสูตร</span> อบรมในวันที่ <span className="bg-indigo-900/30 text-indigo-300 px-1 py-0.5 rounded font-mono">วันที่เริ่มอบรม</span> ผู้เข้ารับการอบรมคือ <span className="bg-indigo-900/30 text-indigo-300 px-1 py-0.5 rounded font-mono">ชื่อผู้เข้าอบรม</span> ดำเนินงานจัดโดยหน่วยงาน <span className="bg-indigo-900/30 text-indigo-300 px-1 py-0.5 rounded font-mono">หน่วยงานผู้จัด</span> รายงานโดย <span className="bg-indigo-900/30 text-indigo-300 px-1 py-0.5 rounded font-mono">ชื่อของคุณ</span>"
                      </p>
                    </div>
                  </div>
                )}

                {activeScriptTab === 'ems_reports' && (
                  <div className="space-y-4">
                    <div className="border-l-2 border-indigo-500 pl-3">
                      <span className="text-white font-semibold text-sm">สคริปต์รายงานเคสไกล่เกลี่ยตาม พ.ร.บ. 2562</span>
                      <p className="text-[10px] text-slate-500 mt-1">ใช้บันทึกประวัติการเจรจาคดีความไกล่เกลี่ยทางการประจำศูนย์</p>
                    </div>

                    <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                      <span className="text-[10px] text-indigo-400 font-bold block">🗣️ บทพูดแนะนำที่ควรอ่านออกเสียง:</span>
                      <p className="leading-relaxed font-light text-slate-200">
                        "รายงานคดีไกล่เกลี่ยคดีเลขที่ <span className="bg-indigo-900/30 text-indigo-300 px-1 py-0.5 rounded font-mono">เลขคดี เช่น กก.15/2569</span> วันที่รับเรื่องคือวันที่ <span className="bg-indigo-900/30 text-indigo-300 px-1 py-0.5 rounded font-mono">วันที่รับคำร้อง</span> เป็นข้อพิพาททาง <span className="bg-indigo-900/30 text-indigo-300 px-1 py-0.5 rounded font-mono">แพ่ง หรือ อาญา</span> คดีเกี่ยวเนื่องกับ <span className="bg-indigo-900/30 text-indigo-300 px-1 py-0.5 rounded font-mono">ประเภทคดี เช่น ละเมิด/กู้ยืม</span> ทุนทรัพย์ไกล่เกลี่ยจำนวน <span className="bg-indigo-900/30 text-indigo-300 px-1 py-0.5 rounded font-mono">ทุนทรัพย์เป็นตัวเลข</span> ผลการไกล่เกลี่ยคือ <span className="bg-indigo-900/30 text-indigo-300 px-1 py-0.5 rounded font-mono">ตกลงกันได้ หรือ ตกลงกันไม่ได้</span> บันทึกโดย <span className="bg-indigo-900/30 text-indigo-300 px-1 py-0.5 rounded font-mono">ผู้ไกล่เกลี่ย</span>"
                      </p>
                    </div>
                  </div>
                )}

                {activeScriptTab === 'other_laws_reports' && (
                  <div className="space-y-4">
                    <div className="border-l-2 border-indigo-500 pl-3">
                      <span className="text-white font-semibold text-sm">สคริปต์รายงานให้คำปรึกษาทางกฎหมาย/ส่งต่อ</span>
                      <p className="text-[10px] text-slate-500 mt-1">ใช้รายงานผลการให้คำแนะนำกฎหมายเบื้องต้นแก่ประชาชน</p>
                    </div>

                    <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                      <span className="text-[10px] text-indigo-400 font-bold block">🗣️ บทพูดแนะนำที่ควรอ่านออกเสียง:</span>
                      <p className="leading-relaxed font-light text-slate-200">
                        "รายงานเคสให้คำปรึกษากฎหมาย วันที่บันทึกรายงานคือวันที่ <span className="bg-indigo-900/30 text-indigo-300 px-1 py-0.5 rounded font-mono">วันที่รับคำแนะนำ</span> ปัญหาเกี่ยวกับเรื่อง <span className="bg-indigo-900/30 text-indigo-300 px-1 py-0.5 rounded font-mono">รายละเอียดปัญหา</span> ได้ดำเนินการ <span className="bg-indigo-900/30 text-indigo-300 px-1 py-0.5 rounded font-mono">ให้ข้อแนะนำ หรือ ประสานส่งต่อ</span> หน่วยงานปลายทางคือ <span className="bg-indigo-900/30 text-indigo-300 px-1 py-0.5 rounded font-mono">เช่น สำนักงานยุติธรรมจังหวัด</span> บันทึกโดย <span className="bg-indigo-900/30 text-indigo-300 px-1 py-0.5 rounded font-mono">ชื่อของคุณ</span>"
                      </p>
                    </div>
                  </div>
                )}

                {activeScriptTab === 'zero_reports' && (
                  <div className="space-y-4">
                    <div className="border-l-2 border-indigo-500 pl-3">
                      <span className="text-white font-semibold text-sm">สคริปต์รายงานไม่มีผลการดำเนินงาน (Zero Report)</span>
                      <p className="text-[10px] text-slate-500 mt-1">ใช้ส่งรายงานความว่างเปล่าประจำรอบเดือนอย่างรวดเร็ว</p>
                    </div>

                    <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                      <span className="text-[10px] text-indigo-400 font-bold block">🗣️ บทพูดแนะนำที่ควรอ่านออกเสียง:</span>
                      <p className="leading-relaxed font-light text-slate-200">
                        "รายงานไม่มีผลการดำเนินงานประจำเดือน <span className="bg-indigo-900/30 text-indigo-300 px-1 py-0.5 rounded font-mono">ระบุเลขเดือน เช่น 6 หรือ 10</span> ปีพ.ศ. <span className="bg-indigo-900/30 text-indigo-300 px-1 py-0.5 rounded font-mono">2569</span> เนื่องจากไม่มีกิจกรรมไกล่เกลี่ยเกิดขึ้นภายในศูนย์ รายงานข้อมูลโดย <span className="bg-indigo-900/30 text-indigo-300 px-1 py-0.5 rounded font-mono">ชื่อผู้ประสานงานหลัก</span> โทร <span className="bg-indigo-900/30 text-indigo-300 px-1 py-0.5 rounded font-mono">เบอร์โทรศัพท์</span>"
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-800 bg-slate-950/40 flex justify-end">
              <button
                type="button"
                onClick={() => setScriptsModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold cursor-pointer transition-all"
              >
                ปิดหน้าต่างคำแนะนำ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
