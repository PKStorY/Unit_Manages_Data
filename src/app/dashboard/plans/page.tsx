'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { 
  Plus, Edit, Trash2, Search, Upload, FileText, CheckCircle, 
  AlertCircle, Download, Loader2, ChevronLeft, ChevronRight, X, Mic, MicOff, Sparkles, Calendar, Grid, Trash
} from 'lucide-react';
import Swal from 'sweetalert2';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';

interface SubActivity {
  name: string;
  start_date: string;
  end_date: string;
  budget: string;
  owner: string;
  status: 'Not Started' | 'In Progress' | 'Completed' | 'Delayed';
}

export default function PlansPage() {
  const { user, profile } = useAuth();

  const [activeView, setActiveView] = useState<'table' | 'timeline'>('table');
  const [items, setItems] = useState<any[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  
  // Table Pagination & Search state
  const [totalItems, setTotalItems] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  
  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // File upload state
  const [uploading, setUploading] = useState(false);
  const [uploadedFileUrl, setUploadedFileUrl] = useState<string>('');
  const [uploadedFileName, setUploadedFileName] = useState<string>('');

  // Form states
  const [formData, setFormData] = useState<any>({
    title: '',
    year: new Date().getFullYear() + 543 + '', // Default to current Thai year
    project_description: '',
    reporter_name: '',
    reporter_phone: '',
    source_info: '',
    source_contact: '',
  });
  const [subActivities, setSubActivities] = useState<SubActivity[]>([]);

  // AI Voice & Text integration states (Large Mic Button)
  const [aiStoryText, setAiStoryText] = useState('');
  const [aiParsing, setAiParsing] = useState(false);
  const [highlightFields, setHighlightFields] = useState<Record<string, boolean>>({});

  // Field Speech Recognition state
  const [activeVoiceField, setActiveVoiceField] = useState<string | null>(null);
  const activeVoiceFieldRef = useRef<string | null>(null);

  // Pagination pageSize
  const pageSize = 10;

  // Hook for global dictation (Large mic button)
  const {
    isListening: isGlobalListening,
    startListening: startGlobalListening,
    stopListening: stopGlobalListening,
    isSupported: isSpeechSupported
  } = useSpeechRecognition({
    onResult: (text) => {
      setAiStoryText(prev => (prev ? prev + ' ' + text : text));
    }
  });

  // Hook for in-field dictation (Small mic buttons)
  const {
    isListening: isFieldListening,
    startListening: startFieldListening,
    stopListening: stopFieldListening
  } = useSpeechRecognition({
    onResult: (text) => {
      const fieldName = activeVoiceFieldRef.current;
      if (fieldName) {
        if (fieldName.startsWith('activity_name_')) {
          const idx = parseInt(fieldName.replace('activity_name_', ''));
          updateSubActivity(idx, 'name', (subActivities[idx]?.name || '') + ' ' + text);
        } else if (fieldName.startsWith('activity_owner_')) {
          const idx = parseInt(fieldName.replace('activity_owner_', ''));
          updateSubActivity(idx, 'owner', (subActivities[idx]?.owner || '') + ' ' + text);
        } else {
          setFormData((prev: any) => ({
            ...prev,
            [fieldName]: (prev[fieldName] || '') + ' ' + text
          }));
        }
      }
    }
  });

  // Load data on search or page change
  useEffect(() => {
    fetchData();
  }, [currentPage, searchTerm]);

  // Load profile default values when user profile is loaded
  useEffect(() => {
    if (profile && !editingId && modalOpen) {
      setFormData((prev: any) => {
        const updated = { ...prev };
        if (!updated.reporter_name) updated.reporter_name = profile.name || '';
        if (!updated.reporter_phone) updated.reporter_phone = profile.phone || '';
        return updated;
      });
    }
  }, [profile, modalOpen, editingId]);

  // Check for global mic pending data
  useEffect(() => {
    const pendingData = sessionStorage.getItem('ai_pending_autofill');
    if (pendingData) {
      try {
        const { category, data } = JSON.parse(pendingData);
        if (category === 'plans') {
          setModalOpen(true);
          setFormData((prev: any) => ({
            ...prev,
            ...data
          }));
          if (data.activities && Array.isArray(data.activities)) {
            setSubActivities(data.activities.map((act: any) => ({
              name: act.name || '',
              start_date: act.start_date || '',
              end_date: act.end_date || '',
              budget: act.budget || '',
              owner: act.owner || '',
              status: act.status || 'Not Started'
            })));
          }

          const highlights: Record<string, boolean> = {};
          Object.keys(data).forEach(key => {
            if (data[key] !== undefined && data[key] !== null && data[key] !== '') {
              highlights[key] = true;
            }
          });
          setHighlightFields(highlights);
          setTimeout(() => {
            setHighlightFields({});
          }, 6000);

          Swal.fire({
            icon: 'success',
            title: 'ดึงข้อมูล AI จากหน้าหลักสำเร็จ',
            text: 'ระบบได้กรอกข้อมูลโครงการและกิจกรรมย่อยที่ AI ดึงข้อมูลได้เรียบร้อยแล้ว กรุณาตรวจสอบข้อมูลที่ไฮไลต์และกิจกรรมย่อยก่อนบันทึก',
            confirmButtonColor: '#4f46e5',
            background: '#0f172a',
            color: '#f8fafc'
          });
        }
      } catch (err) {
        console.error('Error parsing pending global mic data:', err);
      } finally {
        sessionStorage.removeItem('ai_pending_autofill');
      }
    }
  }, [profile]);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);

    try {
      const role = profile?.role || 'user';
      const myProvince = profile?.province;

      let query = supabase
        .from('plans')
        .select('*, profiles!inner(*)', { count: 'exact' });

      // Role filtering
      if (role === 'subadmin' && myProvince) {
        query = query.eq('profiles.province', myProvince);
      } else if (role === 'user') {
        query = query.eq('user_id', user.id);
      }

      // Filter active records
      query = query.eq('status', 'Active');

      if (searchTerm) {
        query = query.ilike('title', `%${searchTerm}%`);
      }

      const from = (currentPage - 1) * pageSize;
      const to = from + pageSize - 1;

      query = query.order('created_at', { ascending: false }).range(from, to);

      const { data, count, error } = await query;

      if (error) throw error;

      setItems(data || []);
      setTotalItems(count || 0);
      setTotalPages(Math.ceil((count || 0) / pageSize));

      if (data && data.length > 0 && !selectedPlanId) {
        setSelectedPlanId(data[0].id);
      }
    } catch (err: any) {
      console.error('Error fetching plans:', err);
      Swal.fire('Error', 'ไม่สามารถโหลดข้อมูลแผนงานได้: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAddModal = () => {
    setEditingId(null);
    setUploadedFileUrl('');
    setUploadedFileName('');
    setFormData({
      title: '',
      year: new Date().getFullYear() + 543 + '',
      project_description: '',
      reporter_name: profile?.name || '',
      reporter_phone: profile?.phone || '',
      source_info: '',
      source_contact: '',
    });
    setSubActivities([]);
    setHighlightFields({});
    setModalOpen(true);
  };

  const handleOpenEditModal = (item: any) => {
    setEditingId(item.id);
    
    // Parse description JSON to extract main description and sub activities
    let projectDescription = '';
    let activities: SubActivity[] = [];

    try {
      if (item.description && (item.description.trim().startsWith('{') || item.description.trim().startsWith('['))) {
        const parsed = JSON.parse(item.description);
        if (parsed.activities) {
          projectDescription = parsed.project_description || '';
          activities = parsed.activities || [];
        } else {
          projectDescription = item.description;
        }
      } else {
        projectDescription = item.description || '';
      }
    } catch (e) {
      projectDescription = item.description || '';
    }

    setFormData({
      title: item.title || '',
      year: item.year || '',
      project_description: projectDescription,
      reporter_name: item.reporter_name || '',
      reporter_phone: item.reporter_phone || '',
      source_info: item.source_info || '',
      source_contact: item.source_contact || '',
      user_id: item.user_id,
    });

    setSubActivities(activities);

    if (item.file_link) {
      setUploadedFileUrl(item.file_link);
      const parts = item.file_link.split('/');
      setUploadedFileName(parts[parts.length - 1] || 'เอกสารแนบ');
    } else {
      setUploadedFileUrl('');
      setUploadedFileName('');
    }

    setHighlightFields({});
    setModalOpen(true);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `plans_${Date.now()}.${fileExt}`;
      const filePath = `${user?.id}/${fileName}`;

      const { error } = await supabase.storage
        .from('documents')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('documents')
        .getPublicUrl(filePath);

      setUploadedFileUrl(publicUrl);
      setUploadedFileName(file.name);

      Swal.fire({
        icon: 'success',
        title: 'อัปโหลดเอกสารสำเร็จ',
        timer: 1000,
        showConfirmButton: false
      });
    } catch (err: any) {
      console.error('File upload error:', err);
      Swal.fire('Failed', 'ไม่สามารถอัปโหลดไฟล์: ' + err.message, 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteUploadedFile = () => {
    setUploadedFileUrl('');
    setUploadedFileName('');
  };

  const addSubActivity = () => {
    setSubActivities(prev => [
      ...prev,
      {
        name: '',
        start_date: '',
        end_date: '',
        budget: '',
        owner: '',
        status: 'Not Started'
      }
    ]);
  };

  const removeSubActivity = (index: number) => {
    setSubActivities(prev => prev.filter((_, i) => i !== index));
  };

  const updateSubActivity = (index: number, field: keyof SubActivity, value: string) => {
    setSubActivities(prev => prev.map((act, i) => {
      if (i === index) {
        return { ...act, [field]: value };
      }
      return act;
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    setLoading(true);

    try {
      // Serialize description as JSON containing overall info and sub-activities
      const serializedDescription = JSON.stringify({
        project_description: formData.project_description || '',
        activities: subActivities
      });

      const payload = {
        title: formData.title,
        year: formData.year,
        description: serializedDescription,
        file_link: uploadedFileUrl || '',
        reporter_name: formData.reporter_name,
        reporter_phone: formData.reporter_phone,
        source_info: formData.source_info,
        source_contact: formData.source_contact,
        user_id: editingId ? formData.user_id : user?.id,
        status: 'Active'
      };

      let responseError = null;

      if (editingId) {
        const { error } = await supabase
          .from('plans')
          .update(payload)
          .eq('id', editingId);
        responseError = error;
      } else {
        const { error } = await supabase
          .from('plans')
          .insert([payload]);
        responseError = error;
      }

      if (responseError) throw responseError;

      Swal.fire({
        icon: 'success',
        title: editingId ? 'บันทึกแก้ไขแผนงานสำเร็จ' : 'เพิ่มแผนงานสำเร็จ',
        timer: 1500,
        showConfirmButton: false
      });

      setModalOpen(false);
      fetchData();
    } catch (err: any) {
      console.error('Submit error:', err);
      Swal.fire('Error', 'ไม่สามารถบันทึกข้อมูลได้: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (id: string) => {
    Swal.fire({
      title: 'ต้องการลบแผนงานนี้หรือไม่?',
      text: 'ข้อมูลที่ถูกลบจะไม่แสดงผลในระบบ แต่อาจกู้คืนได้โดยแอดมิน',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#f43f5e',
      cancelButtonColor: '#475569',
      confirmButtonText: 'ใช่, ต้องการลบ',
      cancelButtonText: 'ยกเลิก'
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          const { error } = await supabase
            .from('plans')
            .update({ status: 'Deleted' })
            .eq('id', id);

          if (error) throw error;

          Swal.fire({
            icon: 'success',
            title: 'ลบข้อมูลสำเร็จ',
            timer: 1000,
            showConfirmButton: false
          });

          if (selectedPlanId === id) {
            setSelectedPlanId('');
          }
          fetchData();
        } catch (e: any) {
          console.error(e);
          Swal.fire('Error', 'ไม่สามารถลบได้: ' + e.message, 'error');
        }
      }
    });
  };

  const handleAIParsing = async () => {
    if (!aiStoryText || !aiStoryText.trim()) return;

    setAiParsing(true);
    try {
      const res = await fetch('/api/ai/parse-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          story: aiStoryText,
          fieldsSchema: [
            { name: 'title', label: 'ชื่อแผนงาน/โครงการ', type: 'text' },
            { name: 'year', label: 'ปีงบประมาณ (พ.ศ.)', type: 'text' },
            { name: 'project_description', label: 'รายละเอียดของแผนงาน/วัตถุประสงค์โครงการ', type: 'textarea' },
            { name: 'reporter_name', label: 'ชื่อผู้บันทึกรายงาน', type: 'text' },
            { name: 'reporter_phone', label: 'เบอร์ติดต่อผู้บันทึกรายงาน', type: 'text' },
            { name: 'source_info', label: 'ชื่อผู้ประสานงานหลัก', type: 'text' },
            { name: 'source_contact', label: 'เบอร์โทรติดต่อผู้ประสานงาน', type: 'text' },
            { 
              name: 'activities', 
              label: 'รายการกิจกรรมย่อยทั้งหมดภายใต้แผนงานโครงการนี้', 
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string', description: 'ชื่อกิจกรรมย่อย' },
                  start_date: { type: 'string', description: 'วันเริ่มต้นกิจกรรมย่อย รูปแบบ YYYY-MM-DD' },
                  end_date: { type: 'string', description: 'วันสิ้นสุดกิจกรรมย่อย รูปแบบ YYYY-MM-DD' },
                  budget: { type: 'string', description: 'งบประมาณที่ใช้สำหรับกิจกรรมย่อย (ตัวเลขไม่มีจุลภาคคั่น)' },
                  owner: { type: 'string', description: 'ชื่อผู้รับผิดชอบกิจกรรมย่อย' },
                  status: { 
                    type: 'string', 
                    description: 'สถานะกิจกรรมย่อย เลือกค่าจาก: Not Started, In Progress, Completed, Delayed เท่านั้น' 
                  }
                },
                required: ['name', 'start_date', 'end_date']
              }
            }
          ]
        }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'เกิดข้อผิดพลาดในการประมวลผลของ AI');

      if (result.data) {
        const parsed = result.data;
        const newFormData = { ...formData };
        const highlights: Record<string, boolean> = {};

        Object.keys(parsed).forEach((key) => {
          if (parsed[key] !== undefined && parsed[key] !== null) {
            if (key === 'activities') {
              if (Array.isArray(parsed.activities)) {
                setSubActivities(parsed.activities.map((act: any) => ({
                  name: act.name || '',
                  start_date: act.start_date || '',
                  end_date: act.end_date || '',
                  budget: act.budget || '',
                  owner: act.owner || '',
                  status: act.status || 'Not Started'
                })));
              }
            } else {
              newFormData[key] = parsed[key];
              highlights[key] = true;
            }
          }
        });

        // Set form states
        setFormData(newFormData);
        setHighlightFields(highlights);
        setAiStoryText('');

        Swal.fire({
          icon: 'success',
          title: 'AI กรอกข้อมูลแผนงานสำเร็จ',
          text: 'กรุณาตรวจสอบข้อมูลที่ไฮไลต์และบันทึก',
          timer: 2000,
          showConfirmButton: false
        });

        // Fade out highlights
        setTimeout(() => {
          setHighlightFields({});
        }, 5000);
      }
    } catch (err: any) {
      console.error(err);
      Swal.fire('AI Error', err.message, 'error');
    } finally {
      setAiParsing(false);
    }
  };

  const toggleFieldVoice = (fieldName: string) => {
    if (activeVoiceField === fieldName) {
      stopFieldListening();
      setActiveVoiceField(null);
      activeVoiceFieldRef.current = null;
    } else {
      if (activeVoiceField) {
        stopFieldListening();
      }
      setActiveVoiceField(fieldName);
      activeVoiceFieldRef.current = fieldName;
      startFieldListening();
    }
  };

  // Timeline Helper: calculate month span based on Fiscal Year (October of FY-1 to September of FY)
  const getMonthSpan = (startDateStr: string, endDateStr: string, fiscalYearStr: string) => {
    if (!startDateStr || !endDateStr) return null;
    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return null;

    const fyYear = parseInt(fiscalYearStr) - 543;
    if (isNaN(fyYear)) return null;

    // Helper: get month index relative to Oct 1 of previous year (index 0)
    const getRelativeMonthIndex = (date: Date) => {
      const yearDiff = date.getFullYear() - (fyYear - 1);
      const monthDiff = date.getMonth() - 9; // Oct is month index 9 (0-indexed)
      return yearDiff * 12 + monthDiff;
    };

    let startIndex = getRelativeMonthIndex(startDate);
    let endIndex = getRelativeMonthIndex(endDate);

    // Clip to 0-11 range
    if (startIndex < 0) startIndex = 0;
    if (startIndex > 11) startIndex = 11;
    if (endIndex < 0) endIndex = 0;
    if (endIndex > 11) endIndex = 11;

    if (startIndex > endIndex) {
      const temp = startIndex;
      startIndex = endIndex;
      endIndex = temp;
    }

    return {
      start: startIndex,
      end: endIndex,
      span: endIndex - startIndex + 1
    };
  };

  const activePlan = items.find(item => item.id === selectedPlanId);
  
  // Parse active plan's sub-activities
  let activePlanDescription = '';
  let activePlanActivities: SubActivity[] = [];
  if (activePlan) {
    try {
      if (activePlan.description && (activePlan.description.trim().startsWith('{') || activePlan.description.trim().startsWith('['))) {
        const parsed = JSON.parse(activePlan.description);
        if (parsed.activities) {
          activePlanDescription = parsed.project_description || '';
          activePlanActivities = parsed.activities || [];
        } else {
          activePlanDescription = activePlan.description;
        }
      } else {
        activePlanDescription = activePlan.description || '';
      }
    } catch (e) {
      activePlanDescription = activePlan.description || '';
    }
  }

  // Month list labels for Thai Fiscal Year (Oct - Sep)
  const fiscalMonths = [
    { label: 'ต.ค.', yearOffset: -1 },
    { label: 'พ.ย.', yearOffset: -1 },
    { label: 'ธ.ค.', yearOffset: -1 },
    { label: 'ม.ค.', yearOffset: 0 },
    { label: 'ก.พ.', yearOffset: 0 },
    { label: 'มี.ค.', yearOffset: 0 },
    { label: 'เม.ย.', yearOffset: 0 },
    { label: 'พ.ค.', yearOffset: 0 },
    { label: 'มิ.ย.', yearOffset: 0 },
    { label: 'ก.ค.', yearOffset: 0 },
    { label: 'ส.ค.', yearOffset: 0 },
    { label: 'ก.ย.', yearOffset: 0 }
  ];

  return (
    <div className="space-y-6">
      {/* Top Brand & Actions header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-xl font-bold text-white">แผนการดำเนินงานและตารางเวลาปฏิบัติงานรายปี</h2>
          <p className="text-xs text-slate-400 mt-1">จัดเก็บวิเคราะห์แผนงานและแสดงผลแผนภาพ Gantt Timeline เพื่อประเมินความคืบหน้า</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex bg-slate-900 border border-slate-800 rounded-xl p-0.5">
            <button
              onClick={() => setActiveView('table')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                activeView === 'table' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Grid className="h-4 w-4" />
              <span>ตารางแผนงาน</span>
            </button>
            <button
              onClick={() => setActiveView('timeline')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                activeView === 'timeline' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Calendar className="h-4 w-4" />
              <span>Timeline รายปี</span>
            </button>
          </div>

          <button
            onClick={handleOpenAddModal}
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold cursor-pointer shadow-lg shadow-indigo-600/10 transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>สร้างแผนงาน</span>
          </button>
        </div>
      </div>

      {/* Main View rendering */}
      {activeView === 'table' ? (
        <div className="bg-slate-900 border border-slate-800/80 rounded-2xl overflow-hidden shadow-xl">
          {/* Table Search Toolbar */}
          <div className="p-4 border-b border-slate-800 bg-slate-950/20 flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
              <input
                type="text"
                placeholder="ค้นหาชื่อโครงการ/แผนงาน..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full bg-slate-950 border border-slate-800/80 rounded-xl py-2 pl-9 pr-4 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-all"
              />
            </div>
            <span className="text-[10px] text-slate-500">พบทั้งหมด {totalItems} แผนงาน</span>
          </div>

          {/* Items Table */}
          {loading ? (
            <div className="py-24 flex flex-col items-center justify-center text-slate-400">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
              <span className="text-xs mt-2">กำลังดึงข้อมูลแผนงาน...</span>
            </div>
          ) : items.length > 0 ? (
            <div className="overflow-x-auto text-xs">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-medium bg-slate-950/40">
                    <th className="p-4">ชื่อแผนงาน/โครงการ</th>
                    <th className="p-4">ปีงบประมาณ</th>
                    <th className="p-4">ผู้บันทึกรายงาน</th>
                    <th className="p-4 text-right">การจัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40 text-slate-300">
                  {items.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-850/20 transition-colors">
                      <td className="p-4 font-medium text-white max-w-xs truncate">{item.title}</td>
                      <td className="p-4">พ.ศ. {item.year}</td>
                      <td className="p-4">{item.reporter_name}</td>
                      <td className="p-4 text-right">
                        <div className="inline-flex gap-2">
                          <button
                            onClick={() => handleOpenEditModal(item)}
                            className="p-1.5 hover:bg-slate-800 text-indigo-400 hover:text-indigo-300 rounded-lg transition-colors cursor-pointer"
                            title="แก้ไขรายละเอียด"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(item.id)}
                            className="p-1.5 hover:bg-slate-800 text-rose-500 hover:text-rose-400 rounded-lg transition-colors cursor-pointer"
                            title="ลบรายงาน"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Table pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between p-4 border-t border-slate-800 bg-slate-950/20">
                  <span className="text-[10px] text-slate-400">หน้า {currentPage} จาก {totalPages}</span>
                  <div className="flex gap-2">
                    <button
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      className="p-1.5 bg-slate-900 border border-slate-800 hover:bg-slate-800 rounded-lg text-slate-300 disabled:opacity-30 disabled:hover:bg-slate-900 transition-colors cursor-pointer"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                      disabled={currentPage === totalPages}
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                      className="p-1.5 bg-slate-900 border border-slate-800 hover:bg-slate-800 rounded-lg text-slate-300 disabled:opacity-30 disabled:hover:bg-slate-900 transition-colors cursor-pointer"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="py-24 flex flex-col items-center justify-center text-slate-500">
              <FileText className="h-10 w-10 mb-2 text-slate-700" />
              <span>ไม่พบข้อมูลแผนงานโครงการในฐานข้อมูล</span>
            </div>
          )}
        </div>
      ) : (
        /* Timeline/Gantt View Mode */
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left Side: Plan Selector list */}
          <div className="lg:col-span-1 bg-slate-900 border border-slate-800/80 p-4 rounded-2xl space-y-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800 pb-2">เลือกแผนงาน/โครงการ</h3>
            {items.length > 0 ? (
              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {items.map(item => (
                  <button
                    key={item.id}
                    onClick={() => setSelectedPlanId(item.id)}
                    className={`w-full text-left p-3 rounded-xl border text-xs transition-all cursor-pointer block ${
                      selectedPlanId === item.id
                        ? 'bg-indigo-600/10 border-indigo-500 text-indigo-300 font-semibold'
                        : 'bg-slate-950/20 border-slate-800 text-slate-400 hover:bg-slate-800/50 hover:text-white'
                    }`}
                  >
                    <div className="truncate font-semibold">{item.title}</div>
                    <div className="text-[10px] text-slate-500 mt-1">ปีงบประมาณ พ.ศ. {item.year}</div>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-[10px] text-slate-500 italic">ไม่มีข้อมูลโครงการให้เลือก</p>
            )}
          </div>

          {/* Right Side: Timeline Visualization rendering */}
          <div className="lg:col-span-3 bg-slate-900 border border-slate-800/80 p-6 rounded-2xl space-y-6">
            {activePlan ? (
              <div className="space-y-6">
                {/* Plan Info header */}
                <div className="border-b border-slate-800 pb-4 space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <h3 className="text-sm font-bold text-white">{activePlan.title}</h3>
                    <span className="text-[10px] px-2 py-0.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-md font-semibold">
                      ปีงบประมาณ พ.ศ. {activePlan.year}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 whitespace-pre-wrap">{activePlanDescription || 'ไม่มีข้อมูลรายละเอียดแผนงานหลัก'}</p>
                  
                  {activePlan.file_link && (
                    <a
                      href={activePlan.file_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-[10px] text-indigo-400 hover:text-indigo-300 font-semibold mt-1"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>ดาวน์โหลดเอกสารแนบโครงการหลัก</span>
                    </a>
                  )}
                </div>

                {/* Timeline rendering */}
                <div>
                  <h4 className="text-xs font-semibold text-slate-200 mb-4 flex items-center gap-1.5">
                    <Calendar className="h-4 w-4 text-indigo-400" />
                    <span>ผังไทม์ไลน์แผนปฏิบัติงานประจำปี (Gantt Chart)</span>
                  </h4>

                  {activePlanActivities.length > 0 ? (
                    <div className="space-y-4 overflow-x-auto">
                      <div className="min-w-[650px] space-y-1.5">
                        {/* Timeline Month Headers */}
                        <div className="grid gap-2 text-center text-[10px] font-bold text-slate-400 border-b border-slate-800 pb-2" style={{ gridTemplateColumns: 'repeat(16, minmax(0, 1fr))' }}>
                          <div className="col-span-4 text-left">กิจกรรมย่อย</div>
                          {fiscalMonths.map((m, idx) => (
                            <div key={idx} className="col-span-1">
                              <div>{m.label}</div>
                              <div className="text-[8px] text-slate-500 font-normal mt-0.5">
                                {parseInt(activePlan.year) + m.yearOffset}
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Gantt Rows */}
                        <div className="divide-y divide-slate-800/40">
                          {activePlanActivities.map((act, index) => {
                            const spanInfo = getMonthSpan(act.start_date, act.end_date, activePlan.year);
                            return (
                              <div key={index} className="grid gap-2 items-center py-3.5" style={{ gridTemplateColumns: 'repeat(16, minmax(0, 1fr))' }}>
                                {/* Activity Details */}
                                <div className="col-span-4 min-w-0 pr-2 space-y-1">
                                  <span className="text-xs font-bold text-white block truncate" title={act.name}>
                                    {act.name}
                                  </span>
                                  <div className="text-[9px] text-slate-400 space-y-0.5">
                                    <div className="truncate">ผู้รับผิดชอบ: <span className="text-slate-300 font-medium">{act.owner || 'ไม่ระบุ'}</span></div>
                                    <div>งบประมาณ: <span className="text-indigo-400 font-semibold">{act.budget ? parseInt(act.budget).toLocaleString('th-TH') + ' บาท' : 'ไม่ใช้งบ'}</span></div>
                                    <div className="text-[8px] text-slate-500">
                                      {act.start_date ? new Date(act.start_date).toLocaleDateString('th-TH') : '...'} - {act.end_date ? new Date(act.end_date).toLocaleDateString('th-TH') : '...'}
                                    </div>
                                  </div>
                                </div>

                                {/* Timeline Track */}
                                <div className="col-span-12 grid grid-cols-12 gap-1 h-8 relative bg-slate-950/30 rounded-xl border border-slate-900 overflow-hidden">
                                  {/* Grid Lines */}
                                  {Array.from({ length: 12 }).map((_, i) => (
                                    <div key={i} className="border-r border-slate-800/40 last:border-r-0 h-full" />
                                  ))}

                                  {/* Color filled status bar */}
                                  {spanInfo && (
                                    <div
                                      style={{
                                        gridColumnStart: spanInfo.start + 1,
                                        gridColumnEnd: spanInfo.end + 2
                                      }}
                                      className={`absolute top-1.5 bottom-1.5 rounded-lg flex items-center justify-center text-[9px] font-bold text-white px-2 shadow-md border overflow-hidden truncate transition-all ${
                                        act.status === 'Completed' ? 'bg-emerald-600/90 border-emerald-500/30 shadow-emerald-950/20' :
                                        act.status === 'In Progress' ? 'bg-indigo-600/90 border-indigo-500/30 shadow-indigo-950/20' :
                                        act.status === 'Delayed' ? 'bg-rose-600/90 border-rose-500/30 shadow-rose-950/20' :
                                        'bg-slate-700/90 border-slate-600/30 shadow-slate-950/20'
                                      }`}
                                      title={`${act.name} (${act.status === 'Completed' ? 'สำเร็จ' : act.status === 'In Progress' ? 'กำลังทำ' : act.status === 'Delayed' ? 'ล่าช้า' : 'รอดำเนินการ'})`}
                                    >
                                      {act.status === 'Completed' ? '🟢 สำเร็จ' :
                                       act.status === 'In Progress' ? '🔵 กำลังทำ' :
                                       act.status === 'Delayed' ? '🔴 ล่าช้า' : '⚪ รอดำเนินการ'}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="py-12 border border-dashed border-slate-800 rounded-2xl flex flex-col items-center justify-center text-slate-500 text-xs">
                      <AlertCircle className="h-8 w-8 mb-2 text-slate-650" />
                      <span>แผนงานนี้ยังไม่มีกิจกรรมย่อย กรุณากดปุ่มแก้ไขแผนงานเพื่อเพิ่มกิจกรรมย่อยและกำหนด Timeline</span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="py-24 flex flex-col items-center justify-center text-slate-500 text-xs">
                <Calendar className="h-10 w-10 mb-2 text-slate-700" />
                <span>กรุณาเลือกแผนงานโครงการจากคอลัมน์ซ้าย เพื่อแสดงผลผัง Timeline</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* sliding modal for add/edit plan */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-2xl bg-slate-900 border-l border-slate-800 h-full flex flex-col shadow-2xl animate-slideIn">
            
            {/* Modal Header */}
            <div className="flex h-20 items-center justify-between px-6 border-b border-slate-800/80 bg-slate-950/20">
              <div>
                <h3 className="font-semibold text-white text-sm">
                  {editingId ? 'แก้ไขข้อมูลแผนการดำเนินงาน' : 'สร้างแผนการดำเนินงานใหม่'}
                </h3>
                <p className="text-[10px] text-slate-400 mt-1 font-light">ป้อนรายละเอียดแผนงานและกิจกรรมย่อยเพื่อสร้าง Gantt Timeline</p>
              </div>
              <button 
                onClick={() => setModalOpen(false)}
                className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Form content */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5 text-xs text-slate-300">
              
              {/* AI Auto-fill dictation helper box (streamlined layout) */}
              <div className="bg-gradient-to-br from-slate-900 to-indigo-950/40 border border-indigo-500/20 rounded-2xl p-4 space-y-3 relative overflow-hidden shadow-lg shadow-indigo-950/5">
                <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-xl pointer-events-none" />
                
                <div className="space-y-3">
                  <div className="flex flex-col items-center justify-center p-4 bg-slate-950/40 rounded-xl border border-slate-800/80 space-y-2 relative overflow-hidden">
                    {isGlobalListening ? (
                      <button
                        type="button"
                        onClick={stopGlobalListening}
                        className="w-12 h-12 bg-rose-500 hover:bg-rose-600 text-white rounded-full flex items-center justify-center cursor-pointer transition-all shadow-lg shadow-rose-500/30 relative"
                        title="หยุดบันทึกเสียง"
                      >
                        <span className="absolute inset-0 rounded-full bg-rose-500/30 animate-ping" />
                        <Mic className="h-5.5 w-5.5 animate-pulse" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={startGlobalListening}
                        className="w-12 h-12 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full flex items-center justify-center cursor-pointer transition-all shadow-lg shadow-indigo-600/30 hover:scale-105"
                        title="เริ่มพูดบรรยายรายละเอียดแผนงาน"
                      >
                        <Mic className="h-5.5 w-5.5" />
                      </button>
                    )}
                    
                    <span className="text-[9px] font-semibold text-slate-400">
                      {isGlobalListening ? "🔴 กำลังฟังเสียงพูดของคุณ..." : "🎤 กดเพื่อพูดรายละเอียดแผนงานทั้งหมด"}
                    </span>

                    <textarea
                      rows={5}
                      placeholder="อธิบายแผนงาน เช่น 'โครงการแผนพัฒนาชุมชน ปี 2569 ผู้รายงานสมชาย กิจกรรมแรก อบรมเจรจาไกล่เกลี่ย เริ่มวันที่ 1 ตุลาคม 2568 ถึง 30 พฤศจิกายน 2568 งบ 5 หมื่นบาท...'"
                      value={aiStoryText}
                      onChange={(e) => setAiStoryText(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-[10px] text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-all resize-y min-h-[120px] mt-1"
                    />
                  </div>

                  <button
                    type="button"
                    disabled={aiParsing || !aiStoryText.trim()}
                    onClick={handleAIParsing}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-30 disabled:hover:bg-indigo-600 text-white font-semibold py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-indigo-600/10 transition-all text-[11px]"
                  >
                    {aiParsing ? (
                      <>
                        <Loader2 className="animate-spin h-3.5 w-3.5" />
                        <span>AI กำลังแยกวิเคราะห์ข้อมูล...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-3.5 w-3.5 text-indigo-200" />
                        <span>สั่ง AI กรอกข้อมูลลงฟอร์ม</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Standard inputs block */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-white border-b border-slate-800 pb-1.5">1. รายละเอียดโครงการหลัก</h4>
                
                <div className="grid grid-cols-2 gap-4">
                  {/* Project Title */}
                  <div className="space-y-1.5 col-span-2">
                    <label className="text-slate-400 font-medium">ชื่อแผนงาน/โครงการ <span className="text-rose-500">*</span></label>
                    <div className="relative flex items-center">
                      <input
                        type="text"
                        required
                        placeholder="เช่น โครงการเสริมสร้างความรู้ด้านการไกล่เกลี่ย"
                        value={formData.title}
                        onChange={(e) => setFormData((p: any) => ({ ...p, title: e.target.value }))}
                        className={`w-full bg-slate-950 border rounded-xl py-2 pl-3 pr-10 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-all ${
                          highlightFields.title ? 'border-emerald-500 ring-2 ring-emerald-500/20' : 'border-slate-800'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => toggleFieldVoice('title')}
                        className={`absolute right-2 p-1.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                          activeVoiceField === 'title' ? 'bg-rose-500/20 border-rose-500 text-rose-400 animate-pulse' : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-white'
                        }`}
                      >
                        {activeVoiceField === 'title' ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>

                  {/* Year */}
                  <div className="space-y-1.5">
                    <label className="text-slate-400 font-medium">ปีงบประมาณ (พ.ศ.) <span className="text-rose-500">*</span></label>
                    <input
                      type="text"
                      required
                      placeholder="เช่น 2569"
                      value={formData.year}
                      onChange={(e) => setFormData((p: any) => ({ ...p, year: e.target.value }))}
                      className={`w-full bg-slate-950 border rounded-xl py-2 px-3 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-all ${
                        highlightFields.year ? 'border-emerald-500 ring-2 ring-emerald-500/20' : 'border-slate-800'
                      }`}
                    />
                  </div>

                  {/* Attachment */}
                  <div className="space-y-1.5">
                    <label className="text-slate-400 font-medium">เอกสารแนบโครงการ (ไฟล์หลักฐาน)</label>
                    <div className="flex gap-2">
                      {uploadedFileUrl ? (
                        <div className="flex-1 bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 flex items-center justify-between">
                          <span className="text-slate-300 font-medium truncate max-w-[150px]">{uploadedFileName}</span>
                          <button
                            type="button"
                            onClick={handleDeleteUploadedFile}
                            className="p-1 hover:bg-slate-800 text-rose-500 hover:text-rose-400 rounded transition-colors cursor-pointer"
                            title="ลบเอกสารแนบ"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : (
                        <label className="flex-1 bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-xl py-2 px-3 flex items-center justify-center gap-1.5 text-slate-500 hover:text-slate-300 cursor-pointer transition-all">
                          {uploading ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />
                              <span>กำลังอัปโหลด...</span>
                            </>
                          ) : (
                            <>
                              <Upload className="h-4 w-4" />
                              <span>เลือกไฟล์แนบ</span>
                            </>
                          )}
                          <input type="file" onChange={handleFileUpload} className="hidden" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg" />
                        </label>
                      )}
                    </div>
                  </div>

                  {/* Main Description */}
                  <div className="space-y-1.5 col-span-2">
                    <label className="text-slate-400 font-medium">รายละเอียดของแผนงาน/วัตถุประสงค์โครงการ</label>
                    <div className="relative">
                      <textarea
                        rows={3}
                        placeholder="กรอกรายละเอียดแผนงานหรือวัตถุประสงค์โดยสรุป..."
                        value={formData.project_description}
                        onChange={(e) => setFormData((p: any) => ({ ...p, project_description: e.target.value }))}
                        className={`w-full bg-slate-950 border rounded-xl py-2 pl-3 pr-10 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-all ${
                          highlightFields.project_description ? 'border-emerald-500 ring-2 ring-emerald-500/20' : 'border-slate-800'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => toggleFieldVoice('project_description')}
                        className={`absolute right-2 top-2 p-1.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                          activeVoiceField === 'project_description' ? 'bg-rose-500/20 border-rose-500 text-rose-400 animate-pulse' : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-white'
                        }`}
                      >
                        {activeVoiceField === 'project_description' ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Master-Detail Sub activities section */}
              <div className="space-y-4 pt-2">
                <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                  <h4 className="text-xs font-bold text-white">2. รายการกิจกรรมย่อยและกำหนดไทม์ไลน์</h4>
                  <button
                    type="button"
                    onClick={addSubActivity}
                    className="flex items-center gap-1 px-3 py-1 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-400 border border-indigo-500/20 hover:border-indigo-500/40 rounded-lg text-[10px] font-bold cursor-pointer transition-all"
                  >
                    <Plus className="h-3 w-3" />
                    <span>เพิ่มกิจกรรมย่อย</span>
                  </button>
                </div>

                {subActivities.length > 0 ? (
                  <div className="space-y-4">
                    {subActivities.map((act, index) => {
                      const listeningName = activeVoiceField === `activity_name_${index}`;
                      const listeningOwner = activeVoiceField === `activity_owner_${index}`;
                      return (
                        <div key={index} className="bg-slate-950/40 border border-slate-800/80 rounded-xl p-4 space-y-3 relative">
                          <button
                            type="button"
                            onClick={() => removeSubActivity(index)}
                            className="absolute top-2 right-2 p-1 hover:bg-slate-800 text-rose-500 hover:text-rose-400 rounded transition-colors cursor-pointer"
                            title="ลบกิจกรรมย่อยนี้"
                          >
                            <Trash className="h-3.5 w-3.5" />
                          </button>

                          <div className="grid grid-cols-2 gap-3 text-[10px]">
                            {/* Activity Name */}
                            <div className="space-y-1 col-span-2">
                              <label className="text-slate-400 font-medium">ชื่อกิจกรรมย่อย <span className="text-rose-500">*</span></label>
                              <div className="relative flex items-center">
                                <input
                                  type="text"
                                  required
                                  placeholder="เช่น จัดโครงการสัมมนาชุมชนประจำไตรมาส"
                                  value={act.name}
                                  onChange={(e) => updateSubActivity(index, 'name', e.target.value)}
                                  className={`w-full bg-slate-950 border border-slate-800 rounded-lg py-1.5 pl-2.5 pr-8 text-white focus:outline-none focus:border-indigo-500 text-[10px]`}
                                />
                                <button
                                  type="button"
                                  onClick={() => toggleFieldVoice(`activity_name_${index}`)}
                                  className={`absolute right-1.5 p-1 rounded-md border text-xs cursor-pointer transition-colors ${
                                    listeningName ? 'bg-rose-500/20 border-rose-500 text-rose-400 animate-pulse' : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-white'
                                  }`}
                                >
                                  {listeningName ? <MicOff className="h-3 w-3" /> : <Mic className="h-3 w-3" />}
                                </button>
                              </div>
                            </div>

                            {/* Start Date */}
                            <div className="space-y-1">
                              <label className="text-slate-400 font-medium">วันเริ่มต้นกิจกรรม <span className="text-rose-500">*</span></label>
                              <input
                                type="date"
                                required
                                value={act.start_date}
                                onChange={(e) => updateSubActivity(index, 'start_date', e.target.value)}
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg py-1.5 px-2.5 text-white focus:outline-none focus:border-indigo-500 text-[10px]"
                              />
                            </div>

                            {/* End Date */}
                            <div className="space-y-1">
                              <label className="text-slate-400 font-medium">วันสิ้นสุดกิจกรรม <span className="text-rose-500">*</span></label>
                              <input
                                type="date"
                                required
                                value={act.end_date}
                                onChange={(e) => updateSubActivity(index, 'end_date', e.target.value)}
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg py-1.5 px-2.5 text-white focus:outline-none focus:border-indigo-500 text-[10px]"
                              />
                            </div>

                            {/* Budget */}
                            <div className="space-y-1">
                              <label className="text-slate-400 font-medium">งบประมาณที่ใช้ (บาท)</label>
                              <input
                                type="number"
                                placeholder="ไม่ระบุคืองบรวมหรือไม่มี"
                                value={act.budget}
                                onChange={(e) => updateSubActivity(index, 'budget', e.target.value)}
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg py-1.5 px-2.5 text-white focus:outline-none focus:border-indigo-500 text-[10px]"
                              />
                            </div>

                            {/* Owner */}
                            <div className="space-y-1">
                              <label className="text-slate-400 font-medium">ผู้รับผิดชอบกิจกรรม</label>
                              <div className="relative flex items-center">
                                <input
                                  type="text"
                                  placeholder="ชื่อคนดูแลกิจกรรม"
                                  value={act.owner}
                                  onChange={(e) => updateSubActivity(index, 'owner', e.target.value)}
                                  className="w-full bg-slate-950 border border-slate-800 rounded-lg py-1.5 pl-2.5 pr-8 text-white focus:outline-none focus:border-indigo-500 text-[10px]"
                                />
                                <button
                                  type="button"
                                  onClick={() => toggleFieldVoice(`activity_owner_${index}`)}
                                  className={`absolute right-1.5 p-1 rounded-md border text-xs cursor-pointer transition-colors ${
                                    listeningOwner ? 'bg-rose-500/20 border-rose-500 text-rose-400 animate-pulse' : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-white'
                                  }`}
                                >
                                  {listeningOwner ? <MicOff className="h-3 w-3" /> : <Mic className="h-3 w-3" />}
                                </button>
                              </div>
                            </div>

                            {/* Status */}
                            <div className="space-y-1 col-span-2">
                              <label className="text-slate-400 font-medium">สถานะกิจกรรม</label>
                              <select
                                value={act.status}
                                onChange={(e) => updateSubActivity(index, 'status', e.target.value as any)}
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg py-1.5 px-2.5 text-white focus:outline-none focus:border-indigo-500 text-[10px]"
                              >
                                <option value="Not Started">⚪ รอดำเนินการ</option>
                                <option value="In Progress">🔵 กำลังดำเนินการ</option>
                                <option value="Completed">🟢 เสร็จสิ้นเรียบร้อย</option>
                                <option value="Delayed">🔴 ล่าช้ากว่าแผน</option>
                              </select>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-6 border border-dashed border-slate-800 rounded-xl flex flex-col items-center justify-center text-slate-500 text-[10px]">
                    <span>ยังไม่มีกิจกรรมย่อยแนบในโครงการนี้ กดเพิ่มเพื่อกำหนด Timeline การแสดงผล</span>
                  </div>
                )}
              </div>

              {/* Reporter details */}
              <div className="space-y-4 pt-2">
                <h4 className="text-xs font-bold text-white border-b border-slate-800 pb-1.5">3. ข้อมูลผู้บันทึกและผู้ประสานงาน</h4>
                
                <div className="grid grid-cols-2 gap-4">
                  {/* Reporter Name */}
                  <div className="space-y-1.5">
                    <label className="text-slate-400 font-medium">ชื่อผู้บันทึก <span className="text-rose-500">*</span></label>
                    <input
                      type="text"
                      required
                      placeholder="กรอกชื่อผู้รายงานข้อมูล"
                      value={formData.reporter_name}
                      onChange={(e) => setFormData((p: any) => ({ ...p, reporter_name: e.target.value }))}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  {/* Reporter Phone */}
                  <div className="space-y-1.5">
                    <label className="text-slate-400 font-medium">เบอร์ติดต่อผู้บันทึก</label>
                    <input
                      type="text"
                      placeholder="กรอกเบอร์โทรผู้รายงาน"
                      value={formData.reporter_phone}
                      onChange={(e) => setFormData((p: any) => ({ ...p, reporter_phone: e.target.value }))}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  {/* Source Info */}
                  <div className="space-y-1.5">
                    <label className="text-slate-400 font-medium">ชื่อผู้ประสานงานโครงการ</label>
                    <input
                      type="text"
                      placeholder="กรอกชื่อผู้รับผิดชอบหน้างานหลัก"
                      value={formData.source_info}
                      onChange={(e) => setFormData((p: any) => ({ ...p, source_info: e.target.value }))}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  {/* Source Contact */}
                  <div className="space-y-1.5">
                    <label className="text-slate-400 font-medium">เบอร์ติดต่อผู้ประสานงาน</label>
                    <input
                      type="text"
                      placeholder="เช่น 02-xxx-xxxx"
                      value={formData.source_contact}
                      onChange={(e) => setFormData((p: any) => ({ ...p, source_contact: e.target.value }))}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex gap-3 pt-6 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="flex-1 bg-slate-950 border border-slate-800 hover:bg-slate-900 text-slate-400 font-semibold py-2.5 rounded-xl transition-all cursor-pointer text-center text-xs"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-600/30 text-white font-semibold py-2.5 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 text-xs shadow-lg shadow-indigo-600/10"
                >
                  {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>{editingId ? 'บันทึกแก้ไข' : 'บันทึกสร้างแผนงาน'}</span>
                </button>
              </div>

            </form>
          </div>
        </div>
      )}
    </div>
  );
}
