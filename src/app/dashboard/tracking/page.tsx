'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { 
  Users, CheckCircle, AlertTriangle, Clock, Phone, Search, 
  Filter, MapPin, Loader2, RefreshCw, ShieldAlert, BookOpen
} from 'lucide-react';
import Swal from 'sweetalert2';

interface CenterTracking {
  id: string;
  name: string;
  province: string;
  district: string;
  subdistrict: string;
  phone: string;
  unit_code: string;
  status: 'green' | 'yellow' | 'red';
  zeroReportDetails?: any;
}

export default function TrackingPage() {
  const { user, profile } = useAuth();
  const [centers, setCenters] = useState<CenterTracking[]>([]);
  const [filterMonth, setFilterMonth] = useState<string>(String(new Date().getMonth() === 0 ? 12 : new Date().getMonth()));
  const [filterYear, setFilterYear] = useState<string>(String(new Date().getFullYear() + 543));
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  // Stats counters
  const [stats, setStats] = useState({ green: 0, yellow: 0, red: 0 });

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

  const currentYearBE = new Date().getFullYear() + 543;
  const yearOptions = Array.from({ length: 5 }, (_, i) => String(currentYearBE - i));

  useEffect(() => {
    if (user && profile && (profile.role === 'admin' || profile.role === 'subadmin')) {
      fetchTrackingData();
    }
  }, [user, profile, filterMonth, filterYear]);

  const fetchTrackingData = async () => {
    setLoading(true);
    try {
      const role = profile?.role;
      const myProvince = profile?.province;
      const yearCE = parseInt(filterYear) - 543;
      const monthPad = filterMonth.padStart(2, '0');
      const startDate = `${yearCE}-${monthPad}-01`;
      const lastDay = new Date(yearCE, parseInt(filterMonth), 0).getDate();
      const endDate = `${yearCE}-${monthPad}-${lastDay}`;

      // 1. Fetch all user profiles under tracking scope
      let profilesQuery = supabase
        .from('profiles')
        .select('*')
        .eq('role', 'user')
        .eq('status', 'เปิด');

      if (role === 'subadmin' && myProvince) {
        profilesQuery = profilesQuery.eq('province', myProvince);
      }

      const { data: userProfiles, error: profilesErr } = await profilesQuery;
      if (profilesErr) throw profilesErr;

      const profileIds = (userProfiles || []).map(p => p.id);

      if (profileIds.length === 0) {
        setCenters([]);
        setStats({ green: 0, yellow: 0, red: 0 });
        setLoading(false);
        return;
      }

      // Helper to execute query with user range
      const fetchMonthlyRecordUserIds = async (table: string, dateColumn: string) => {
        const { data } = await supabase
          .from(table)
          .select('user_id')
          .in('user_id', profileIds)
          .eq('status', 'Active')
          .gte(dateColumn, startDate)
          .lte(dateColumn, endDate);
        return (data || []).map(r => r.user_id);
      };

      // 2. Fetch all unique user_ids that have reports for this month
      const [meetUsers, actUsers, trainUsers, emsUsers, lawUsers] = await Promise.all([
        fetchMonthlyRecordUserIds('meetings', 'meeting_date'),
        fetchMonthlyRecordUserIds('activities', 'activity_date'),
        fetchMonthlyRecordUserIds('trainings', 'training_date'),
        fetchMonthlyRecordUserIds('ems_reports', 'start_date_mediation'),
        fetchMonthlyRecordUserIds('other_laws_reports', 'report_date')
      ]);

      // Combine users who have any report (Green)
      const greenUserIds = new Set([
        ...meetUsers, ...actUsers, ...trainUsers, ...emsUsers, ...lawUsers
      ]);

      // 3. Fetch all zero reports for this month
      const { data: zeroReports } = await supabase
        .from('zero_reports')
        .select('*')
        .in('user_id', profileIds)
        .eq('month', parseInt(filterMonth))
        .eq('year', parseInt(filterYear))
        .eq('status', 'Active');

      const zeroReportsMap = new Map();
      (zeroReports || []).forEach(z => {
        zeroReportsMap.set(z.user_id, z);
      });

      // 4. Combine and compute status for each center
      let greenCount = 0;
      let yellowCount = 0;
      let redCount = 0;

      const trackingList: CenterTracking[] = (userProfiles || []).map(p => {
        let status: 'green' | 'yellow' | 'red' = 'red';
        let zeroReportDetails = null;

        if (greenUserIds.has(p.id)) {
          status = 'green';
          greenCount++;
        } else if (zeroReportsMap.has(p.id)) {
          status = 'yellow';
          zeroReportDetails = zeroReportsMap.get(p.id);
          yellowCount++;
        } else {
          status = 'red';
          redCount++;
        }

        return {
          id: p.id,
          name: p.name || p.email,
          province: p.province || '-',
          district: p.district || '-',
          subdistrict: p.subdistrict || '-',
          phone: p.phone || '-',
          unit_code: p.unit_code || '-',
          status,
          zeroReportDetails
        };
      });

      // Sort: Red (needs follow-up) -> Yellow -> Green
      const statusOrder = { red: 1, yellow: 2, green: 3 };
      trackingList.sort((a, b) => statusOrder[a.status] - statusOrder[b.status] || a.province.localeCompare(b.province, 'th'));

      setCenters(trackingList);
      setStats({ green: greenCount, yellow: yellowCount, red: redCount });

    } catch (err: any) {
      console.error(err);
      Swal.fire('Error', 'ไม่สามารถดึงข้อมูลติดตามได้: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const filteredCenters = centers.filter(c => {
    const term = searchTerm.toLowerCase();
    return (
      c.name.toLowerCase().includes(term) ||
      c.province.toLowerCase().includes(term) ||
      c.district.toLowerCase().includes(term) ||
      c.unit_code.toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <ShieldAlert className="h-6 w-6 text-indigo-400" />
            <span>ระบบติดตามและรายงานผลศูนย์ไกล่เกลี่ย</span>
          </h1>
          <p className="text-xs text-slate-400 font-light mt-1">
            {profile?.role === 'admin' 
              ? 'ตรวจเช็คสถานะการส่งรายงานประจำเดือนของทุกศูนย์ทั่วประเทศ' 
              : `ตรวจเช็คสถานะการส่งรายงานของศูนย์ภายในจังหวัด${profile?.province}`}
          </p>
        </div>

        <button
          onClick={fetchTrackingData}
          className="flex items-center justify-center gap-2 px-3 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-xl text-xs font-semibold cursor-pointer transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          <span>รีเฟรชข้อมูล</span>
        </button>
      </div>

      {/* Stats Summary Bento Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="bg-slate-900 border border-slate-800/80 p-5 rounded-2xl flex items-center gap-4 hover:border-rose-500/30 transition-all">
          <div className="p-3 rounded-xl bg-rose-500/10 text-rose-400">
            <Clock className="h-6 w-6" />
          </div>
          <div>
            <span className="text-[10px] text-slate-500 font-medium block">ยังไม่ได้รายงาน</span>
            <span className="text-xl font-bold text-white block mt-0.5">{stats.red} ศูนย์</span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800/80 p-5 rounded-2xl flex items-center gap-4 hover:border-amber-500/30 transition-all">
          <div className="p-3 rounded-xl bg-amber-500/10 text-amber-400">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div>
            <span className="text-[10px] text-slate-500 font-medium block">แจ้งไม่มีผลงาน (Zero)</span>
            <span className="text-xl font-bold text-white block mt-0.5">{stats.yellow} ศูนย์</span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800/80 p-5 rounded-2xl flex items-center gap-4 hover:border-emerald-500/30 transition-all">
          <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400">
            <CheckCircle className="h-6 w-6" />
          </div>
          <div>
            <span className="text-[10px] text-slate-500 font-medium block">ส่งผลงานเรียบร้อย</span>
            <span className="text-xl font-bold text-white block mt-0.5">{stats.green} ศูนย์</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-slate-900 border border-slate-800/80 p-4 rounded-2xl flex flex-col md:flex-row items-center gap-4">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-500" />
          <input
            type="text"
            placeholder="ค้นหาชื่อศูนย์, รหัสหน่วยงาน, จังหวัด หรือ อำเภอ..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-950/60 border border-slate-800 rounded-xl py-2 pl-10 pr-4 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-all"
          />
        </div>

        <div className="flex gap-3 w-full md:w-auto">
          <select
            value={filterMonth}
            onChange={(e) => setFilterMonth(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 cursor-pointer w-full md:w-auto"
          >
            {thaiMonths.map(m => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>

          <select
            value={filterYear}
            onChange={(e) => setFilterYear(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 cursor-pointer w-full md:w-auto"
          >
            {yearOptions.map(y => (
              <option key={y} value={y}>ปี พ.ศ. {y}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Centers Status Grid */}
      {loading ? (
        <div className="py-24 flex flex-col items-center justify-center text-slate-400">
          <Loader2 className="animate-spin h-8 w-8 text-indigo-500 mb-3" />
          <span className="text-xs">กำลังตรวจสอบสถานะการรายงานข้อมูลประจำจังหวัด...</span>
        </div>
      ) : filteredCenters.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCenters.map((c) => (
            <div 
              key={c.id} 
              className={`bg-slate-900 border rounded-2xl p-5 hover:scale-[1.01] transition-all flex flex-col justify-between ${
                c.status === 'red' ? 'border-rose-500/20 hover:border-rose-500/40 shadow-lg shadow-rose-950/5' : 
                c.status === 'yellow' ? 'border-amber-500/20 hover:border-amber-500/40' : 
                'border-slate-800/80 hover:border-slate-700'
              }`}
            >
              <div>
                {/* Center Header */}
                <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-800/60">
                  <div className="overflow-hidden">
                    <span className="text-[10px] text-slate-500 block font-semibold">รหัสศูนย์: {c.unit_code}</span>
                    <h4 className="text-xs font-bold text-white mt-1 truncate" title={c.name}>{c.name}</h4>
                  </div>

                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                    c.status === 'green' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                    c.status === 'yellow' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                    'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                  }`}>
                    {c.status === 'green' ? 'ส่งรายงานแล้ว' : c.status === 'yellow' ? 'รายงานไม่มีผลงาน' : 'ยังไม่ส่งรายงาน'}
                  </span>
                </div>

                {/* Location Info */}
                <div className="mt-4 space-y-2 text-[11px] text-slate-400">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                    <span>ต.{c.subdistrict} อ.{c.district} จ.{c.province}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                    <span>โทรติดต่อ: {c.phone}</span>
                  </div>
                </div>

                {/* Zero Report Details if Yellow */}
                {c.status === 'yellow' && c.zeroReportDetails && (
                  <div className="mt-4 p-3 bg-slate-950/60 border border-slate-800/80 rounded-xl space-y-1 text-[10px] text-slate-400">
                    <span className="font-semibold text-amber-400 flex items-center gap-1.5 mb-1.5">
                      <AlertTriangle className="h-3 w-3" />
                      <span>ข้อมูลการลงตารางว่างเปล่า</span>
                    </span>
                    <p>ผู้รายงาน: {c.zeroReportDetails.reporter_name} ({c.zeroReportDetails.reporter_position})</p>
                    <p>เบอร์ติดต่อ: {c.zeroReportDetails.reporter_phone}</p>
                    <p>วันที่ลงรายงาน: {new Date(c.zeroReportDetails.created_at).toLocaleDateString('th-TH')}</p>
                  </div>
                )}
              </div>

              {/* Action Contact Button */}
              {c.status === 'red' && (
                <div className="mt-6 pt-3 border-t border-slate-800/40">
                  <a
                    href={`tel:${c.phone}`}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-slate-950/50 hover:bg-rose-500/10 hover:text-rose-400 border border-slate-800 hover:border-rose-500/20 text-slate-400 font-semibold rounded-xl text-[10px] transition-all cursor-pointer"
                  >
                    <Phone className="h-3.5 w-3.5" />
                    <span>โทรติดตามรายงาน ({c.phone})</span>
                  </a>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="py-24 flex flex-col items-center justify-center text-slate-500 text-xs border border-dashed border-slate-800 rounded-2xl bg-slate-900/40">
          <Users className="h-10 w-10 mb-2 text-slate-600" />
          <span>ไม่พบรายชื่อศูนย์ตามคำค้นหาที่กรองไว้</span>
        </div>
      )}
    </div>
  );
}
