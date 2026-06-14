'use client';

import React, { useState, useEffect, use } from 'react';
import { supabase } from '@/lib/supabase';
import { CheckCircle, Shield, User, Loader2, AlertCircle } from 'lucide-react';
import Swal from 'sweetalert2';

export default function RegisterAttendeePage({ params }: { params: Promise<{ meetingId: string }> }) {
  const resolvedParams = use(params);
  const { meetingId } = resolvedParams;

  const [meeting, setMeeting] = useState<any>(null);
  const [attendeeName, setAttendeeName] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [registered, setRegistered] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    fetchMeetingDetails();
  }, [meetingId]);

  const fetchMeetingDetails = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('meetings')
        .select('meeting_name, meeting_date, location')
        .eq('id', meetingId)
        .single();

      if (error) {
        setErrorMsg('ไม่พบข้อมูลการประชุมนี้ หรือ ลิงก์ไม่ถูกต้อง');
      } else {
        setMeeting(data);
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('เกิดข้อผิดพลาดในการเชื่อมต่อระบบ');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!attendeeName.trim()) {
      Swal.fire('เตือน', 'กรุณากรอกชื่อ-นามสกุล', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('meeting_attendees')
        .insert([
          {
            meeting_id: meetingId,
            attendee_name: attendeeName.trim()
          }
        ]);

      if (error) throw error;

      setRegistered(true);
      Swal.fire({
        icon: 'success',
        title: 'ลงทะเบียนสำเร็จ',
        text: 'บันทึกรายชื่อของคุณเข้าร่วมประชุมเรียบร้อยแล้ว',
        timer: 1500,
        showConfirmButton: false
      });
    } catch (err: any) {
      console.error(err);
      Swal.fire('Error', 'เกิดข้อผิดพลาดในการลงทะเบียน: ' + err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 text-white p-4">
        <Loader2 className="animate-spin h-8 w-8 text-indigo-500 mb-3" />
        <p className="text-slate-400 text-xs font-light">กำลังดึงข้อมูลการประชุม...</p>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 text-white p-4 text-center">
        <AlertCircle className="h-12 w-12 text-rose-500 mb-4" />
        <h2 className="text-sm font-bold text-white">{errorMsg}</h2>
        <p className="text-xs text-slate-500 mt-2 max-w-xs font-light">กรุณาตรวจสอบลิงก์การลงชื่อเข้าประชุมอีกครั้ง หรือ ติดต่อเจ้าหน้าที่ประจำศูนย์</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 p-4 font-sans text-slate-100">
      {/* Background Glows */}
      <div className="absolute top-1/4 left-1/4 w-80 h-80 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-3xl shadow-2xl p-6 relative z-10 transform transition-all duration-300">
        
        {registered ? (
          <div className="text-center py-8 space-y-4">
            <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
              <CheckCircle className="h-8 w-8 text-emerald-400" />
            </div>
            <h2 className="text-md font-bold text-white">ลงทะเบียนเข้าประชุมสำเร็จ!</h2>
            <p className="text-xs text-slate-400 font-light leading-5 max-w-xs mx-auto">
              ระบบได้ทำการบันทึกชื่อ **{attendeeName}** เข้าร่วมการประชุม **"{meeting?.meeting_name}"** เรียบร้อยแล้ว ขอบคุณครับ/ค่ะ
            </p>
          </div>
        ) : (
          <div>
            {/* Header info */}
            <div className="flex flex-col items-center text-center mb-6">
              <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-2xl flex items-center justify-center mb-3">
                <Shield className="h-6 w-6 text-white" />
              </div>
              <span className="text-[10px] text-indigo-400 font-semibold tracking-wider">ระบบลงทะเบียนเข้าประชุม</span>
              <h1 className="text-sm font-bold text-white mt-1 leading-5 max-w-xs">{meeting?.meeting_name}</h1>
              
              <div className="mt-4 p-3 bg-slate-950/40 border border-slate-800/60 rounded-2xl w-full text-left space-y-1.5 text-[11px] text-slate-400">
                <p><span className="text-slate-600 font-medium">วันที่ประชุม:</span> {new Date(meeting?.meeting_date).toLocaleDateString('th-TH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                <p><span className="text-slate-600 font-medium">สถานที่:</span> {meeting?.location || '-'}</p>
              </div>
            </div>

            {/* Registration Form */}
            <form onSubmit={handleRegister} className="space-y-5">
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-300">
                  ชื่อ-นามสกุลจริง (ภาษาไทย)
                </label>
                <div className="relative">
                  <User className="absolute left-4 top-3 h-4 w-4 text-slate-500" />
                  <input
                    type="text"
                    placeholder="เช่น นายสมชาย ใจดี"
                    value={attendeeName}
                    onChange={(e) => setAttendeeName(e.target.value)}
                    className="w-full bg-slate-950/50 border border-slate-800 rounded-xl py-2.5 pl-11 pr-4 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-xs"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-gradient-to-r from-indigo-500 to-blue-600 hover:from-indigo-600 hover:to-blue-700 text-white font-bold py-2.5 px-4 rounded-xl shadow-lg shadow-indigo-500/10 hover:shadow-indigo-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 text-xs"
              >
                {submitting ? (
                  <>
                    <Loader2 className="animate-spin h-4 w-4" />
                    <span>กำลังลงชื่อ...</span>
                  </>
                ) : (
                  <span>ลงชื่อเข้าประชุม</span>
                )}
              </button>
            </form>
          </div>
        )}

      </div>
    </div>
  );
}
