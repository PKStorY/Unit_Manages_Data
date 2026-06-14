'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { 
  Plus, Edit, Trash2, Search, ArrowLeft, Mic, MicOff, Printer, 
  QrCode, FileText, CheckCircle, AlertTriangle, Users, Loader2, Save, X, RefreshCw
} from 'lucide-react';
import Swal from 'sweetalert2';

interface MeetingAttendee {
  id: string;
  attendee_name: string;
  check_in_time: string;
}

export default function MeetingsPage() {
  const { user, profile } = useAuth();
  
  // Navigation & UI States
  const [view, setView] = useState<'list' | 'form'>('list');
  const [activeTab, setActiveTab] = useState<'details' | 'agendas' | 'qr' | 'print'>('details');
  const [meetings, setMeetings] = useState<any[]>([]);
  const [attendees, setAttendees] = useState<MeetingAttendee[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Speech recognition state
  const [isListening, setIsListening] = useState<Record<string, boolean>>({});
  const [recognition, setRecognition] = useState<any>(null);

  // Form states
  const [formData, setFormData] = useState<any>({
    meeting_name: '',
    meeting_date: new Date().toISOString().split('T')[0],
    location: '',
    summary: '',
    reporter_name: '',
    reporter_phone: '',
    source_info: '',
    source_contact: '',
    agenda_1: '',
    agenda_2: '',
    agenda_3: '',
    agenda_4: '',
    agenda_5: '',
    invitation_text: ''
  });

  useEffect(() => {
    // Initialize Speech Recognition
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const rec = new SpeechRecognition();
        rec.continuous = true;
        rec.interimResults = false;
        rec.lang = 'th-TH';
        setRecognition(rec);
      }
    }
  }, []);

  useEffect(() => {
    if (user && profile) {
      fetchMeetings();
    }
  }, [user, profile, view]);

  useEffect(() => {
    if (editingId && activeTab === 'qr') {
      fetchAttendees();
    }
  }, [editingId, activeTab]);

  const fetchMeetings = async () => {
    setLoading(true);
    try {
      const role = profile?.role || 'user';
      const myProvince = profile?.province;
      
      let query = supabase
        .from('meetings')
        .select('*, profiles!inner(*)')
        .eq('status', 'Active');

      if (role === 'subadmin' && myProvince) {
        query = query.eq('profiles.province', myProvince);
      } else if (role === 'user') {
        query = query.eq('user_id', user?.id);
      }

      const { data, error } = await query.order('meeting_date', { ascending: false });
      if (error) throw error;
      setMeetings(data || []);
    } catch (e: any) {
      console.error(e);
      Swal.fire('Error', 'เกิดข้อผิดพลาดในการดึงข้อมูลการประชุม: ' + e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchAttendees = async () => {
    if (!editingId) return;
    try {
      const { data, error } = await supabase
        .from('meeting_attendees')
        .select('*')
        .eq('meeting_id', editingId)
        .order('check_in_time', { ascending: true });

      if (error) throw error;
      setAttendees(data || []);
    } catch (e: any) {
      console.error(e);
    }
  };

  // Web Speech API handler
  const toggleListening = (fieldKey: string) => {
    if (!recognition) {
      Swal.fire('คำเตือน', 'เบราว์เซอร์นี้ไม่รองรับระบบ Speech-to-Text กรุณาใช้ Google Chrome หรือ Safari', 'warning');
      return;
    }

    if (isListening[fieldKey]) {
      recognition.stop();
      setIsListening(prev => ({ ...prev, [fieldKey]: false }));
    } else {
      // Stop any other active listening
      recognition.stop();
      
      // Clear all active listening states
      const clearedListening: Record<string, boolean> = {};
      clearedListening[fieldKey] = true;
      setIsListening(clearedListening);

      recognition.onresult = (event: any) => {
        const resultText = event.results[event.results.length - 1][0].transcript;
        setFormData((prev: any) => {
          const currentVal = prev[fieldKey] || '';
          return {
            ...prev,
            [fieldKey]: currentVal + (currentVal ? ' ' : '') + resultText
          };
        });
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(prev => ({ ...prev, [fieldKey]: false }));
      };

      recognition.onend = () => {
        setIsListening(prev => ({ ...prev, [fieldKey]: false }));
      };

      recognition.start();
    }
  };

  const handleOpenAddForm = () => {
    setEditingId(null);
    setFormData({
      meeting_name: '',
      meeting_date: new Date().toISOString().split('T')[0],
      location: '',
      summary: '',
      reporter_name: profile?.name || '',
      reporter_phone: profile?.phone || '',
      source_info: '',
      source_contact: '',
      agenda_1: 'เรื่องแจ้งที่ประชุมทราบ:',
      agenda_2: 'การรับรองรายงานการประชุมครั้งก่อน: ไม่มี/รับรองรายงานการประชุมครั้งที่...',
      agenda_3: 'เรื่องเสนอเพื่อทราบ:',
      agenda_4: 'เรื่องเสนอเพื่อพิจารณา:',
      agenda_5: 'เรื่องอื่นๆ (ถ้ามี):',
      invitation_text: `ด้วย ศูนย์ไกล่เกลี่ยข้อพิพาทภาคประชาชน มีความประสงค์จะจัดการประชุมคณะทำงานและผู้ไกล่เกลี่ย เพื่อร่วมปรึกษาหารือการดำเนินงานและพิจารณาข้อร้องเรียนคดีความประจำงวดงาน`
    });
    setActiveTab('details');
    setView('form');
  };

  const handleOpenEditForm = (meeting: any) => {
    setEditingId(meeting.id);
    setFormData(meeting);
    setActiveTab('details');
    setView('form');
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const payload = {
        ...formData,
        user_id: editingId ? formData.user_id : user?.id,
        status: 'Active'
      };

      // Clean profiles from payload
      delete payload.profiles;

      let savedData = null;

      if (editingId) {
        const { data, error } = await supabase
          .from('meetings')
          .update(payload)
          .eq('id', editingId)
          .select();
        if (error) throw error;
        savedData = data?.[0];
      } else {
        const { data, error } = await supabase
          .from('meetings')
          .insert([payload])
          .select();
        if (error) throw error;
        savedData = data?.[0];
      }

      Swal.fire({
        icon: 'success',
        title: 'บันทึกข้อมูลสำเร็จ',
        timer: 1500,
        showConfirmButton: false
      });

      if (savedData && !editingId) {
        setEditingId(savedData.id);
      }
      
      // Stay on form to allow adding agendas or QR code
      setView('form');
      fetchMeetings();

    } catch (e: any) {
      console.error(e);
      Swal.fire('Error', 'ไม่สามารถบันทึกคลาสประชุมได้: ' + e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (id: string) => {
    Swal.fire({
      title: 'ต้องการลบการประชุมนี้?',
      text: 'ข้อมูลบันทึกประชุมจะเข้าถังขยะและไม่แสดงผลในรายงานสรุปสะสม',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#f43f5e',
      confirmButtonText: 'ลบ',
      cancelButtonText: 'ยกเลิก'
    }).then(async (res) => {
      if (res.isConfirmed) {
        try {
          const { error } = await supabase
            .from('meetings')
            .update({ status: 'Deleted' })
            .eq('id', id);
          if (error) throw error;
          Swal.fire('สำเร็จ', 'ลบข้อมูลเรียบร้อย', 'success');
          fetchMeetings();
        } catch (e: any) {
          Swal.fire('Error', 'ไม่สามารถลบได้: ' + e.message, 'error');
        }
      }
    });
  };

  const handlePrint = () => {
    window.print();
  };

  // QR link construction
  const getRegistrationLink = () => {
    if (typeof window === 'undefined' || !editingId) return '';
    return `${window.location.origin}/register/${editingId}`;
  };

  const qrImageUrl = editingId 
    ? `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(getRegistrationLink())}`
    : '';

  return (
    <div className="space-y-6">
      {/* Hide elements on browser printing */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print-area, .print-area * {
            visibility: visible;
          }
          .print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: white !important;
            color: black !important;
            padding: 2cm !important;
          }
          aside, header, nav, button, select, .no-print {
            display: none !important;
          }
        }
      `}</style>

      {view === 'list' ? (
        <div className="space-y-6 no-print">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold text-white flex items-center gap-2">
                <FileText className="h-6 w-6 text-indigo-400" />
                <span>ตัวช่วยบันทึกการประชุมอัจฉริยะ</span>
              </h1>
              <p className="text-xs text-slate-400 font-light mt-1">จัดการหนังสือเชิญประชุม บันทึกรายงานการประชุม และระบบลงทะเบียน QR Code</p>
            </div>

            <button
              onClick={handleOpenAddForm}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold cursor-pointer transition-colors shadow-lg"
            >
              <Plus className="h-4 w-4" />
              <span>เริ่มจัดประชุมใหม่</span>
            </button>
          </div>

          {/* Table List of meetings */}
          <div className="bg-slate-900 border border-slate-800/80 rounded-2xl overflow-hidden">
            {loading ? (
              <div className="py-24 flex flex-col items-center justify-center text-slate-400">
                <Loader2 className="animate-spin h-8 w-8 text-indigo-500 mb-3" />
                <span className="text-xs">กำลังสแกนหาประวัติการประชุม...</span>
              </div>
            ) : meetings.length > 0 ? (
              <div className="overflow-x-auto text-xs">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-950 border-b border-slate-800 text-slate-400 font-medium">
                      {profile?.role !== 'user' && <th className="p-4">จังหวัด</th>}
                      <th className="p-4">หัวข้อการประชุม</th>
                      <th className="p-4">วันที่ประชุม</th>
                      <th className="p-4">สถานที่</th>
                      <th className="p-4">ผู้บันทึก</th>
                      <th className="p-4 text-right">ดำเนินการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    {meetings.map((m) => (
                      <tr key={m.id} className="hover:bg-slate-800/20 transition-colors">
                        {profile?.role !== 'user' && (
                          <td className="p-4 text-indigo-400 font-semibold">{m.profiles?.province}</td>
                        )}
                        <td className="p-4 font-semibold text-white">{m.meeting_name}</td>
                        <td className="p-4">{new Date(m.meeting_date).toLocaleDateString('th-TH')}</td>
                        <td className="p-4">{m.location}</td>
                        <td className="p-4">{m.reporter_name}</td>
                        <td className="p-4 text-right space-x-2">
                          <button
                            onClick={() => handleOpenEditForm(m)}
                            className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
                            title="เปิดเครื่องมือแก้ไข"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(m.id)}
                            className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-red-400 transition-colors cursor-pointer"
                            title="ลบ"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-24 flex flex-col items-center justify-center text-slate-500 text-xs">
                <FileText className="h-10 w-10 mb-2 text-slate-600" />
                <span>ไม่มีบันทึกประชุมเปิดใช้งานในระบบ</span>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Form view with Tabs */
        <div className="space-y-6 no-print">
          {/* Form Header */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => setView('list')}
              className="flex items-center gap-2 text-slate-400 hover:text-white text-xs font-semibold bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 transition-colors cursor-pointer"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>กลับรายการประชุม</span>
            </button>

            <button
              onClick={handleSave}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors shadow-lg"
            >
              <Save className="h-4 w-4" />
              <span>บันทึกการประชุม</span>
            </button>
          </div>

          {/* Steps Tab header */}
          <div className="flex bg-slate-900 border border-slate-800 p-1 rounded-xl text-xs w-full overflow-x-auto">
            <button
              onClick={() => setActiveTab('details')}
              className={`flex-1 min-w-[100px] text-center py-2.5 rounded-lg cursor-pointer transition-all ${activeTab === 'details' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400 hover:text-white'}`}
            >
              1. รายละเอียด & หนังสือเชิญ
            </button>
            <button
              onClick={() => setActiveTab('agendas')}
              className={`flex-1 min-w-[100px] text-center py-2.5 rounded-lg cursor-pointer transition-all ${activeTab === 'agendas' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400 hover:text-white'}`}
            >
              2. บันทึก 5 วาระ (Speech-to-Text)
            </button>
            <button
              disabled={!editingId}
              onClick={() => setActiveTab('qr')}
              className={`flex-1 min-w-[100px] text-center py-2.5 rounded-lg cursor-pointer transition-all disabled:opacity-30 disabled:cursor-not-allowed ${activeTab === 'qr' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400 hover:text-white'}`}
            >
              3. สแกน QR ลงชื่อเข้างาน
            </button>
            <button
              disabled={!editingId}
              onClick={() => setActiveTab('print')}
              className={`flex-1 min-w-[100px] text-center py-2.5 rounded-lg cursor-pointer transition-all disabled:opacity-30 disabled:cursor-not-allowed ${activeTab === 'print' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400 hover:text-white'}`}
            >
              4. รายงานการประชุมทางการ
            </button>
          </div>

          {/* Tab Content 1: Details & invitation letter */}
          {activeTab === 'details' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Form Input fields */}
              <div className="lg:col-span-2 bg-slate-900 border border-slate-800/80 p-6 rounded-2xl space-y-4 text-xs text-slate-300">
                <h3 className="text-sm font-semibold text-white">รายละเอียดจัดประชุมคณะทำงาน</h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5 col-span-2">
                    <label className="text-slate-400 font-medium">หัวข้อ/ชื่อการประชุม <span className="text-rose-500">*</span></label>
                    <input
                      type="text"
                      required
                      placeholder="เช่น ประชุมทบทวนแผนคดีและพิจารณาประเมิน"
                      value={formData.meeting_name}
                      onChange={(e) => setFormData((p: any) => ({ ...p, meeting_name: e.target.value }))}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-slate-400 font-medium">วันที่จัดประชุม <span className="text-rose-500">*</span></label>
                    <input
                      type="date"
                      required
                      value={formData.meeting_date}
                      onChange={(e) => setFormData((p: any) => ({ ...p, meeting_date: e.target.value }))}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-slate-400 font-medium">สถานที่จัด <span className="text-rose-500">*</span></label>
                    <input
                      type="text"
                      required
                      placeholder="เช่น ห้องประชุมใหญ่ศูนย์ หรือ Zoom"
                      value={formData.location}
                      onChange={(e) => setFormData((p: any) => ({ ...p, location: e.target.value }))}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-slate-400 font-medium">ชื่อผู้รายงาน/ผู้คีย์บันทึก <span className="text-rose-500">*</span></label>
                    <input
                      type="text"
                      required
                      value={formData.reporter_name}
                      onChange={(e) => setFormData((p: any) => ({ ...p, reporter_name: e.target.value }))}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-slate-400 font-medium">เบอร์โทรศัพท์ติดต่อ</label>
                    <input
                      type="text"
                      value={formData.reporter_phone}
                      onChange={(e) => setFormData((p: any) => ({ ...p, reporter_phone: e.target.value }))}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-slate-400 font-medium">ชื่อผู้ประสานงานจัดงาน</label>
                    <input
                      type="text"
                      value={formData.source_info}
                      onChange={(e) => setFormData((p: any) => ({ ...p, source_info: e.target.value }))}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-slate-400 font-medium">เบอร์โทรติดต่อผู้ประสานงาน</label>
                    <input
                      type="text"
                      value={formData.source_contact}
                      onChange={(e) => setFormData((p: any) => ({ ...p, source_contact: e.target.value }))}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-slate-400 font-medium">เนื้อหาหนังสือส่งเชิญเข้าร่วมประชุม</label>
                  <textarea
                    rows={4}
                    value={formData.invitation_text}
                    onChange={(e) => setFormData((p: any) => ({ ...p, invitation_text: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-white focus:outline-none focus:border-indigo-500 leading-5"
                  />
                </div>
              </div>

              {/* Styled Invitation Letter Preview */}
              <div className="lg:col-span-1 bg-white border border-slate-200 p-6 rounded-2xl text-slate-800 shadow-md flex flex-col justify-between h-fit">
                <div className="space-y-6 text-[10px] font-sans">
                  <div className="text-center font-bold text-xs border-b pb-3 text-slate-900">
                    หนังสือเชิญประชุม (พรีวิว)
                  </div>
                  
                  <div className="text-right text-slate-500">
                    เลขที่หนังสือ: ศก.ปช./{editingId ? editingId.substring(0, 5) : 'XXXX'}
                  </div>

                  <div className="text-center font-semibold text-slate-900 leading-5">
                    หนังสือเชิญประชุมคณะทำงานผู้ไกล่เกลี่ยข้อพิพาท<br/>
                    เรื่อง: ขอเชิญเข้าร่วมการประชุม
                  </div>

                  <div className="space-y-2 leading-relaxed text-slate-700">
                    <p><span className="font-semibold text-slate-900">เรียน:</span> คณะทำงานและผู้ประสานงานศูนย์ไกล่เกลี่ยประจำพื้นที่</p>
                    <p className="indent-8 text-justify">{formData.invitation_text || '...'}</p>
                    <p className="indent-8 text-justify">
                      ทั้งนี้ กำหนดจัดประชุมในวันที่ <span className="font-semibold text-slate-900">{new Date(formData.meeting_date).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })}</span> ณ สถานที่ <span className="font-semibold text-slate-900">{formData.location || '...'}</span> 
                    </p>
                    <p className="indent-8">จึงเรียนมาเพื่อทราบและขอเรียนเชิญเข้าร่วมการประชุมโดยพร้อมเพรียงกัน</p>
                  </div>

                  <div className="text-right pt-6 space-y-1">
                    <p>ขอแสดงความนับถือ</p>
                    <p className="pt-4 text-slate-500">(ลงชื่อ)....................................................</p>
                    <p className="text-slate-900 font-semibold">({formData.reporter_name || 'ผู้แจ้งเรื่อง'})</p>
                  </div>
                </div>

                <div className="mt-8 pt-4 border-t flex justify-end">
                  <span className="text-[10px] text-slate-400">กรอกรายละเอียดแท็บที่ 1 ครบถ้วนแล้ว ให้ขยับไปแท็บที่ 2 เพื่อจดบันทึกวาระการประชุม</span>
                </div>
              </div>
            </div>
          )}

          {/* Tab Content 2: Minutes with Speech-to-Text */}
          {activeTab === 'agendas' && (
            <div className="bg-slate-900 border border-slate-800/80 p-6 rounded-2xl space-y-6 text-xs text-slate-300">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div>
                  <h3 className="text-sm font-semibold text-white">จดบันทึกระเบียบวาระมติที่ประชุม (5 วาระมาตรฐาน)</h3>
                  <p className="text-[10px] text-slate-500 font-light mt-0.5">กดปุ่มไมโครโฟนเพื่อพูดภาษาไทยในการถอดความแทนการคีย์พิมพ์</p>
                </div>
              </div>

              {/* 5 Agendas list */}
              <div className="space-y-5">
                {[
                  { key: 'agenda_1', label: 'วาระที่ 1: เรื่องแจ้งให้ที่ประชุมทราบ', placeholder: 'ประธานแจ้งนโยบาย รายงานข่าวประชาสัมพันธ์หน่วยงาน...' },
                  { key: 'agenda_2', label: 'วาระที่ 2: รับรองรายงานการประชุมครั้งก่อน', placeholder: 'การรับรองสรุปเรื่องร้องเรียนหรือผลคดีในการประชุมรอบที่แล้ว...' },
                  { key: 'agenda_3', label: 'วาระที่ 3: เรื่องเสนอเพื่อทราบ', placeholder: 'รายงานจำนวนคดีไกล่เกลี่ยที่สำเร็จ งบที่ใช้สะสม...' },
                  { key: 'agenda_4', label: 'วาระที่ 4: เรื่องเสนอเพื่อพิจารณา', placeholder: 'การโหวตข้อพิพาท ประเมินความถูกต้อง หรือคัดกรองจัดระดับศูนย์...' },
                  { key: 'agenda_5', label: 'วาระที่ 5: เรื่องอื่นๆ', placeholder: 'ข้อสงสัยเพิ่มเติม การนัดประชุมครั้งถัดไป...' },
                ].map(ag => {
                  const listening = isListening[ag.key];
                  return (
                    <div key={ag.key} className="space-y-2 border border-slate-800/60 p-4 rounded-xl bg-slate-950/20">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-semibold text-slate-200">{ag.label}</label>
                        
                        <button
                          type="button"
                          onClick={() => toggleListening(ag.key)}
                          className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border text-[10px] font-bold cursor-pointer transition-all ${
                            listening 
                              ? 'bg-rose-500/20 border-rose-500 text-rose-400 animate-pulse' 
                              : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                          }`}
                        >
                          {listening ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
                          <span>{listening ? 'กำลังถอดเสียง (กดเพื่อหยุด)' : 'พูดเพื่อถอดความ'}</span>
                        </button>
                      </div>

                      <textarea
                        rows={3}
                        placeholder={ag.placeholder}
                        value={formData[ag.key] || ''}
                        onChange={(e) => setFormData((p: any) => ({ ...p, [ag.key]: e.target.value }))}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-white focus:outline-none focus:border-indigo-500 leading-5"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Tab Content 3: QR registration and attendee list */}
          {activeTab === 'qr' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* QR display */}
              <div className="lg:col-span-1 bg-slate-900 border border-slate-800/80 p-6 rounded-2xl flex flex-col items-center justify-center text-center space-y-4">
                <QrCode className="h-10 w-10 text-indigo-400" />
                <div>
                  <h3 className="text-xs font-semibold text-white">ลงทะเบียนเข้าประชุมด้วย QR Code</h3>
                  <p className="text-[10px] text-slate-500 font-light mt-1">ให้ผู้ร่วมประชุมสแกนรหัสนี้บนจอภาพ เพื่อพิมพ์ชื่อลงทะเบียนด้วยโทรศัพท์ของตนเอง</p>
                </div>

                {qrImageUrl ? (
                  <div className="p-4 bg-white rounded-2xl border border-slate-700/30">
                    <img src={qrImageUrl} alt="Meeting Registration QR Code" className="w-48 h-48" />
                  </div>
                ) : (
                  <div className="h-48 w-48 bg-slate-950 border border-slate-800 rounded-2xl flex items-center justify-center text-slate-600 text-xs">
                    บันทึกสคริปต์ก่อนเปิดรหัส
                  </div>
                )}

                <div className="w-full text-left bg-slate-950 p-3.5 rounded-xl border border-slate-800/60 text-[10px] break-all select-all font-mono text-indigo-400 cursor-pointer">
                  {getRegistrationLink()}
                </div>
              </div>

              {/* Attendee list */}
              <div className="lg:col-span-2 bg-slate-900 border border-slate-800/80 p-6 rounded-2xl space-y-4 flex flex-col justify-between">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <Users className="h-4.5 w-4.5 text-indigo-400" />
                    <span>ใบลงชื่อเข้าร่วมประชุม ({attendees.length} คน)</span>
                  </h3>

                  <button
                    type="button"
                    onClick={fetchAttendees}
                    className="p-1.5 hover:bg-slate-800 rounded-lg text-indigo-400 hover:text-white transition-colors cursor-pointer"
                    title="ดึงข้อมูลรายชื่อใหม่"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </button>
                </div>

                <div className="overflow-y-auto max-h-[350px] space-y-2 text-xs">
                  {attendees.length > 0 ? (
                    attendees.map((at, idx) => (
                      <div key={at.id} className="flex items-center justify-between p-3 bg-slate-950/40 rounded-xl border border-slate-800/40 hover:border-slate-800 transition-all">
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-slate-500 w-6">{idx + 1}.</span>
                          <span className="font-semibold text-slate-200">{at.attendee_name}</span>
                        </div>
                        <span className="text-[10px] text-slate-500">{new Date(at.check_in_time).toLocaleTimeString('th-TH')}</span>
                      </div>
                    ))
                  ) : (
                    <div className="py-16 text-center text-slate-500 italic flex flex-col items-center justify-center border border-dashed border-slate-800 rounded-xl">
                      <Users className="h-8 w-8 mb-2 text-slate-700" />
                      <span>ยังไม่มีผู้ร่วมประชุมมาแสกนลงทะเบียนเข้าห้องงาน</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Tab Content 4: Minutes PDF Print Layout */}
          {activeTab === 'print' && (
            <div className="bg-slate-900 border border-slate-800/80 p-6 rounded-2xl space-y-6">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div>
                  <h3 className="text-sm font-semibold text-white">รายงานสรุปบันทึกการประชุมอย่างเป็นทางการ</h3>
                  <p className="text-[10px] text-slate-500 font-light mt-0.5">พรีวิวโครงสร้างก่อนสั่งพิมพ์หรือบันทึกเป็นเอกสาร PDF แนบส่ง</p>
                </div>

                <button
                  onClick={handlePrint}
                  className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors shadow-lg"
                >
                  <Printer className="h-4 w-4" />
                  <span>พิมพ์เอกสารบันทึกรายงาน / Save PDF</span>
                </button>
              </div>

              {/* Print Sheet container */}
              <div className="bg-white border rounded-2xl p-8 max-w-2xl mx-auto shadow-md text-slate-800 text-[10px] font-sans leading-relaxed print-area">
                <div className="text-center font-bold text-xs uppercase text-black leading-6">
                  รายงานการประชุมคณะทำงานและผู้ไกล่เกลี่ยข้อพิพาทประจำศูนย์<br/>
                  ครั้งที่ {editingId ? editingId.substring(0, 4) : 'X'}/{new Date(formData.meeting_date).getFullYear() + 543}<br/>
                  ณ สถานที่ {formData.location}
                </div>

                <div className="border-b border-slate-200 my-4" />

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div><span className="font-semibold text-black">วันทีประชุม:</span> {new Date(formData.meeting_date).toLocaleDateString('th-TH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
                    <div><span className="font-semibold text-black">ผู้ประสานงานการจัด:</span> {formData.source_info || '-'}</div>
                  </div>

                  {/* Attendees names in print */}
                  <div>
                    <span className="font-semibold text-black block mb-2">รายชื่อผู้เข้าร่วมการประชุมจริง:</span>
                    {attendees.length > 0 ? (
                      <ol className="list-decimal pl-5 space-y-1">
                        {attendees.map(at => (
                          <li key={at.id}>{at.attendee_name}</li>
                        ))}
                      </ol>
                    ) : (
                      <span className="text-slate-400 italic">ไม่มีข้อมูลการลงชื่อเข้าใช้</span>
                    )}
                  </div>

                  <div className="border-b border-slate-100 my-2" />

                  {/* Agendas summaries */}
                  <div className="space-y-4">
                    <div>
                      <span className="font-semibold text-black block mb-1">ระเบียบวาระที่ 1: เรื่องแจ้งให้ที่ประชุมทราบ</span>
                      <p className="pl-4 text-justify whitespace-pre-line text-slate-600">{formData.agenda_1 || '(ไม่มีบันทึกข้อมูล)'}</p>
                    </div>

                    <div>
                      <span className="font-semibold text-black block mb-1">ระเบียบวาระที่ 2: รับรองรายงานการประชุมครั้งก่อน</span>
                      <p className="pl-4 text-justify whitespace-pre-line text-slate-600">{formData.agenda_2 || '(ไม่มีบันทึกข้อมูล)'}</p>
                    </div>

                    <div>
                      <span className="font-semibold text-black block mb-1">ระเบียบวาระที่ 3: เรื่องเสนอเพื่อทราบ</span>
                      <p className="pl-4 text-justify whitespace-pre-line text-slate-600">{formData.agenda_3 || '(ไม่มีบันทึกข้อมูล)'}</p>
                    </div>

                    <div>
                      <span className="font-semibold text-black block mb-1">ระเบียบวาระที่ 4: เรื่องเสนอเพื่อพิจารณา</span>
                      <p className="pl-4 text-justify whitespace-pre-line text-slate-600">{formData.agenda_4 || '(ไม่มีบันทึกข้อมูล)'}</p>
                    </div>

                    <div>
                      <span className="font-semibold text-black block mb-1">ระเบียบวาระที่ 5: เรื่องอื่นๆ</span>
                      <p className="pl-4 text-justify whitespace-pre-line text-slate-600">{formData.agenda_5 || '(ไม่มีบันทึกข้อมูล)'}</p>
                    </div>
                  </div>

                  <div className="border-b border-slate-200 my-6" />

                  {/* Signs footer */}
                  <div className="flex justify-between pt-4">
                    <div className="text-center w-1/2">
                      <p>ลงชื่อ............................................................ผู้จดรายงาน</p>
                      <p className="mt-2 text-slate-900 font-semibold">({formData.reporter_name || '...........................................'})</p>
                    </div>
                    <div className="text-center w-1/2">
                      <p>ลงชื่อ............................................................ผู้ตรวจรายงาน</p>
                      <p className="mt-2 text-slate-500">(ประธานคณะทำงานประจำศูนย์)</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
}
