'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { 
  Plus, Edit, Trash2, Search, ArrowLeft, Mic, MicOff, Printer, 
  FileText, CheckCircle, AlertTriangle, Loader2, Save, X, RefreshCw, Sparkles, Download, FileSpreadsheet, DollarSign, ArrowUpRight, TrendingUp, HelpCircle
} from 'lucide-react';
import Swal from 'sweetalert2';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';

// ค่ามาตรฐานหมวดหมู่ค่าใช้จ่าย
const EXPENSE_CATEGORIES = [
  'ค่าตอบแทนวิทยากร',
  'ค่าอาหารกลางวันและเครื่องดื่ม',
  'ค่าอาหารว่างและเครื่องดื่ม',
  'ค่าใช้สอยและพาหนะเดินทาง',
  'ค่าวัสดุอุปกรณ์และเอกสาร',
  'อื่นๆ'
];

// ลำดับสถานะ Stepper
const STEPPER_STATES = [
  'ร่างโครงการ',
  'เจ้าหน้าที่ตรวจสอบเบื้องต้น',
  'ยื่นขออนุมัติ',
  'ได้รับอนุมัติ/อยู่ระหว่างจัด',
  'จัดเสร็จสิ้น',
  'รายงานผลแล้ว'
];

interface BudgetItem {
  id?: string;
  category: string;
  description: string;
  estimated_amount: number;
  actual_amount: number;
  receipt_url?: string;
  receipt_name?: string;
}

export default function BudgetsPage() {
  const { user, profile } = useAuth();
  
  // UI & View State
  const [view, setView] = useState<'list' | 'detail' | 'print'>('list');
  const [budgets, setBudgets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modal & Form State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedBudget, setSelectedBudget] = useState<any | null>(null);
  const [activeFormTab, setActiveFormTab] = useState<'info' | 'items'>('info');

  const [formData, setFormData] = useState<any>({
    project_name: '',
    approval_date: '',
    end_date: '',
    budget_amount: 0,
    refund_amount: 0,
    summary: '',
    file_link: '',
    status: 'ร่างโครงการ',
    reporter_name: '',
    reporter_phone: '',
    source_info: '',
    source_contact: '',
  });

  const [budgetItems, setBudgetItems] = useState<BudgetItem[]>([]);
  const [uploadingItemIndex, setUploadingItemIndex] = useState<number | null>(null);
  
  // AI Voice & Dictation Integration
  const [aiStoryText, setAiStoryText] = useState('');
  const [aiParsing, setAiParsing] = useState(false);
  const [highlightFields, setHighlightFields] = useState<Record<string, boolean>>({});
  const [activeVoiceField, setActiveVoiceField] = useState<string | null>(null);
  const activeVoiceFieldRef = useRef<string | null>(null);

  // Hook บันทึกเสียงพูดไมค์ใหญ่
  const {
    isListening: isGlobalListening,
    startListening: startGlobalListening,
    stopListening: stopGlobalListening
  } = useSpeechRecognition({
    onResult: (text, isFinal) => {
      if (isFinal) {
        setAiStoryText(prev => (prev ? prev + ' ' + text : text));
      }
    }
  });

  // Hook บันทึกเสียงพูดฟิลด์เดี่ยว (ไมค์จิ๋ว)
  const {
    isListening: isFieldListening,
    startListening: startFieldListening,
    stopListening: stopFieldListening
  } = useSpeechRecognition({
    continuous: true,
    interimResults: false,
    onResult: (text, isFinal) => {
      const currentField = activeVoiceFieldRef.current;
      if (currentField && isFinal) {
        setFormData((prev: any) => {
          const currentVal = prev[currentField] || '';
          return {
            ...prev,
            [currentField]: currentVal + (currentVal ? ' ' : '') + text
          };
        });
      }
    },
    onEnd: () => {
      setActiveVoiceField(null);
      activeVoiceFieldRef.current = null;
    }
  });

  useEffect(() => {
    fetchBudgets();
  }, [user, profile]);

  // ตรวจเช็คข้อมูลดิ๊กเทชั่นค้างจากหน้าแรก (Global voice assistant)
  useEffect(() => {
    const pendingData = sessionStorage.getItem('ai_pending_autofill');
    if (pendingData) {
      try {
        const { category, data } = JSON.parse(pendingData);
        if (category === 'budgets') {
          handleOpenAddModal();
          setFormData((prev: any) => ({
            ...prev,
            ...data
          }));
          
          const highlights: Record<string, boolean> = {};
          Object.keys(data).forEach(key => {
            if (data[key] !== undefined && data[key] !== null && data[key] !== '') {
              highlights[key] = true;
            }
          });
          setHighlightFields(highlights);
          setTimeout(() => setHighlightFields({}), 6000);

          Swal.fire({
            icon: 'success',
            title: 'ดึงข้อมูล AI สำเร็จ',
            text: 'กรุณาตรวจสอบรายละเอียดโครงการและตารางงบประมาณย่อยอีกครั้ง',
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

  const fetchBudgets = async () => {
    setLoading(true);
    try {
      let query = supabase.from('budgets').select('*');
      
      // กรองระดับสิทธิ์ตามบทบาทผู้ใช้
      if (profile?.role !== 'admin' && profile?.role !== 'subadmin') {
        query = query.eq('user_id', user?.id);
      }

      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) throw error;
      
      // โหลดค่า actual_spent ของแต่ละโครงการประกอบด้วย
      const budgetsWithSpent = await Promise.all((data || []).map(async (b) => {
        const { data: items } = await supabase
          .from('budget_items')
          .select('actual_amount, estimated_amount')
          .eq('budget_id', b.id);
        
        const totalSpent = (items || []).reduce((sum, item) => sum + (Number(item.actual_amount) || 0), 0);
        const totalEstimated = (items || []).reduce((sum, item) => sum + (Number(item.estimated_amount) || 0), 0);
        return {
          ...b,
          actual_spent: totalSpent,
          total_items_estimated: totalEstimated
        };
      }));

      setBudgets(budgetsWithSpent);
    } catch (err: any) {
      console.error('Error fetching budgets:', err);
      Swal.fire('Error', 'ไม่สามารถโหลดข้อมูลโครงการได้: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAddModal = () => {
    setEditingId(null);
    setFormData({
      project_name: '',
      approval_date: '',
      end_date: '',
      budget_amount: 0,
      refund_amount: 0,
      summary: '',
      file_link: '',
      status: 'ร่างโครงการ',
      reporter_name: profile?.name || '',
      reporter_phone: profile?.phone || '',
      source_info: '',
      source_contact: '',
    });
    setBudgetItems([
      { category: 'ค่าตอบแทนวิทยากร', description: '', estimated_amount: 0, actual_amount: 0 },
      { category: 'ค่าอาหารกลางวันและเครื่องดื่ม', description: '', estimated_amount: 0, actual_amount: 0 },
      { category: 'ค่าอาหารว่างและเครื่องดื่ม', description: '', estimated_amount: 0, actual_amount: 0 }
    ]);
    setActiveFormTab('info');
    setModalOpen(true);
  };

  const handleOpenEditModal = async (budget: any) => {
    setEditingId(budget.id);
    setFormData({ ...budget });
    setActiveFormTab('info');
    
    // ดึงค่ารายการย่อย
    try {
      const { data: items, error } = await supabase
        .from('budget_items')
        .select('*')
        .eq('budget_id', budget.id)
        .order('created_at', { ascending: true });
      if (error) throw error;
      setBudgetItems(items || []);
    } catch (err: any) {
      console.error(err);
      Swal.fire('Error', 'ไม่สามารถโหลดรายการใช้จ่ายย่อยได้', 'error');
    }
    setModalOpen(true);
  };

  const handleDeleteBudget = async (id: string) => {
    Swal.fire({
      title: 'คุณแน่ใจหรือไม่?',
      text: 'การลบโครงการนี้จะทำการลบข้อมูลรายการงบประมาณย่อยทั้งหมดด้วย',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'ยืนยันการลบ',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#1e293b',
      background: '#0f172a',
      color: '#f8fafc'
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          const { error } = await supabase.from('budgets').delete().eq('id', id);
          if (error) throw error;
          
          Swal.fire('ลบข้อมูลสำเร็จ', 'ข้อมูลโครงการถูกลบเรียบร้อยแล้ว', 'success');
          fetchBudgets();
        } catch (err: any) {
          Swal.fire('Error', 'ไม่สามารถลบโครงการได้: ' + err.message, 'error');
        }
      }
    });
  };

  // จัดการฟิลด์เดี่ยว (dictation)
  const toggleFieldVoice = (fieldName: string) => {
    if (activeVoiceFieldRef.current === fieldName) {
      stopFieldListening();
    } else {
      if (activeVoiceFieldRef.current) {
        stopFieldListening();
      }
      activeVoiceFieldRef.current = fieldName;
      setActiveVoiceField(fieldName);
      startFieldListening();
    }
  };

  // ประมวลคำพูดด้วย AI
  const handleAIParsing = async () => {
    if (!aiStoryText.trim()) return;
    setAiParsing(true);
    try {
      const res = await fetch('/api/ai/parse-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          story: aiStoryText,
          fieldsSchema: [
            { name: 'project_name', label: 'ชื่อโครงการ' },
            { name: 'approval_date', label: 'วันที่ได้รับอนุมัติ' },
            { name: 'budget_amount', label: 'ยอดงบประมาณอนุมัติ' },
            { name: 'summary', label: 'คำอธิบายโครงการ' },
            { name: 'reporter_name', label: 'ผู้รายงาน' },
            { name: 'reporter_phone', label: 'เบอร์ติดต่อผู้รายงาน' },
            { name: 'source_info', label: 'ผู้ประสานงาน' },
            { name: 'source_contact', label: 'เบอร์ติดต่อผู้ประสานงาน' }
          ]
        })
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'AI Failed to parse');

      const parsedData = result.data;
      if (parsedData) {
        setFormData((prev: any) => ({
          ...prev,
          ...parsedData
        }));
        
        const highlights: Record<string, boolean> = {};
        Object.keys(parsedData).forEach(k => {
          highlights[k] = true;
        });
        setHighlightFields(highlights);
        setTimeout(() => setHighlightFields({}), 5000);
        setAiStoryText('');
        
        Swal.fire({
          icon: 'success',
          title: 'ประมวลผลคำถอดความสำเร็จ',
          text: 'คัดแยกค่าลงช่องป้อนเรียบร้อยแล้ว กรุณาเพิ่มข้อมูลค่าใช้จ่ายต่อในแท็บถัดไป',
          timer: 3000,
          showConfirmButton: false
        });
      }
    } catch (err: any) {
      console.error(err);
      Swal.fire('ล้มเหลว', 'เกิดข้อผิดพลาดในการประมวลผล: ' + err.message, 'error');
    } finally {
      setAiParsing(false);
    }
  };

  // ตารางรายการค่าใช้จ่ายย่อยยืดหยุ่น
  const addBudgetItemRow = () => {
    setBudgetItems(prev => [
      ...prev,
      { category: 'อื่นๆ', description: '', estimated_amount: 0, actual_amount: 0 }
    ]);
  };

  const removeBudgetItemRow = (index: number) => {
    setBudgetItems(prev => prev.filter((_, i) => i !== index));
  };

  const updateBudgetItemField = (index: number, fieldName: keyof BudgetItem, value: any) => {
    setBudgetItems(prev => prev.map((item, i) => {
      if (i === index) {
        return {
          ...item,
          [fieldName]: value
        };
      }
      return item;
    }));
  };

  // อัปโหลดไฟล์หลักฐานย่อยในตาราง
  const handleItemReceiptUpload = async (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingItemIndex(index);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `budget_receipt_${Date.now()}_${index}.${fileExt}`;
      const filePath = `${user?.id}/${fileName}`;

      const { error } = await supabase.storage
        .from('documents')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (error) throw error;

      const { data: publicUrlData } = supabase.storage
        .from('documents')
        .getPublicUrl(filePath);

      updateBudgetItemField(index, 'receipt_url', publicUrlData.publicUrl);
      updateBudgetItemField(index, 'receipt_name', file.name);

      Swal.fire('สำเร็จ', 'อัปโหลดใบเสร็จเรียบร้อยแล้ว', 'success');
    } catch (err: any) {
      console.error(err);
      Swal.fire('อัปโหลดล้มเหลว', err.message, 'error');
    } finally {
      setUploadingItemIndex(null);
    }
  };

  // คำนวณราคายอดรวมอัตโนมัติ
  const totalEstimated = budgetItems.reduce((sum, item) => sum + (Number(item.estimated_amount) || 0), 0);
  const totalActual = budgetItems.reduce((sum, item) => sum + (Number(item.actual_amount) || 0), 0);
  const totalDifference = Math.max(0, totalEstimated - totalActual);

  // ส่งบันทึกข้อมูลหลัก & รายการย่อย
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.project_name) {
      Swal.fire('เตือน', 'กรุณาระบุชื่อโครงการ', 'warning');
      return;
    }

    setLoading(true);
    try {
      const budgetPayload = {
        ...formData,
        budget_amount: totalEstimated, // ยึดราคารวมที่ประเมินจากรายการย่อย
        refund_amount: formData.status === 'รายงานผลแล้ว' ? totalDifference : formData.refund_amount,
        user_id: editingId ? formData.user_id : user?.id,
        status: formData.status
      };

      let budgetId = editingId;

      if (editingId) {
        // อัปเดตข้อมูลโครงการหลัก
        const { error } = await supabase
          .from('budgets')
          .update(budgetPayload)
          .eq('id', editingId);
        if (error) throw error;
      } else {
        // เพิ่มข้อมูลโครงการหลักใหม่
        const { data, error } = await supabase
          .from('budgets')
          .insert([budgetPayload])
          .select()
          .single();
        if (error) throw error;
        budgetId = data.id;
      }

      // บันทึกรายการใช้จ่ายย่อย (ลบอันเก่าออกแล้วแทรกใหม่เพื่อให้ซิงค์)
      if (budgetId) {
        await supabase
          .from('budget_items')
          .delete()
          .eq('budget_id', budgetId);

        const itemsPayload = budgetItems.map(item => ({
          budget_id: budgetId,
          category: item.category,
          description: item.description || '',
          estimated_amount: Number(item.estimated_amount) || 0,
          actual_amount: Number(item.actual_amount) || 0,
          receipt_url: item.receipt_url || null
        }));

        if (itemsPayload.length > 0) {
          const { error: itemsError } = await supabase
            .from('budget_items')
            .insert(itemsPayload);
          if (itemsError) throw itemsError;
        }
      }

      Swal.fire({
        icon: 'success',
        title: editingId ? 'อัปเดตโครงการสำเร็จ' : 'สร้างโครงการสำเร็จ',
        timer: 1500,
        showConfirmButton: false
      });

      setModalOpen(false);
      fetchBudgets();
    } catch (err: any) {
      console.error(err);
      Swal.fire('บันทึกข้อมูลล้มเหลว', err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'ร่างโครงการ': return 'bg-slate-800 text-slate-400 border border-slate-700';
      case 'เจ้าหน้าที่ตรวจสอบเบื้องต้น': return 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20';
      case 'ยื่นขออนุมัติ': return 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
      case 'ได้รับอนุมัติ/อยู่ระหว่างจัด': return 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20';
      case 'จัดเสร็จสิ้น': return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
      case 'รายงานผลแล้ว': return 'bg-rose-500/10 text-rose-400 border border-rose-500/20';
      default: return 'bg-slate-800 text-slate-400';
    }
  };

  // แผนภูมิตัวเลขและสถิติ
  const approvedBudgetsTotal = budgets.reduce((sum, b) => sum + (Number(b.budget_amount) || 0), 0);
  const actualSpentTotal = budgets.reduce((sum, b) => sum + (Number(b.actual_spent) || 0), 0);
  const refundTotal = budgets.reduce((sum, b) => sum + (Number(b.refund_amount) || 0), 0);

  const chartData = budgets.slice(0, 7).map(b => ({
    name: b.project_name.length > 15 ? b.project_name.substring(0, 15) + '...' : b.project_name,
    'งบประมาณตั้งต้น': b.budget_amount,
    'จ่ายจริง': b.actual_spent
  }));

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* ส่วนหัวหน้าเพจ */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-wide">จัดการแผนงบประมาณโครงการ</h1>
          <p className="text-xs text-slate-400 mt-1">
            บันทึกเสนอโครงการกองทุนยุติธรรม จัดการงบประมาณรายหมวดหมู่ และติดตามรายงานรายจ่ายจริง
          </p>
        </div>
        
        {view === 'list' ? (
          <button
            onClick={handleOpenAddModal}
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl transition-all shadow-lg shadow-indigo-600/15 cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>สร้างโครงการใหม่</span>
          </button>
        ) : (
          <button
            onClick={() => setView('list')}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-medium rounded-xl transition-all cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>กลับสู่หน้ารายการ</span>
          </button>
        )}
      </div>

      {view === 'list' && (
        <>
          {/* Bento Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-slate-900 border border-slate-800/80 p-5 rounded-2xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none" />
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider block">งบเสนออนุมัติทั้งหมด</span>
                  <span className="text-xl font-bold text-white block mt-2">
                    {approvedBudgetsTotal.toLocaleString()} <span className="text-xs font-normal text-slate-400">บาท</span>
                  </span>
                </div>
                <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400">
                  <DollarSign className="h-5 w-5" />
                </div>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800/80 p-5 rounded-2xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider block">จ่ายจริงเสร็จสิ้น</span>
                  <span className="text-xl font-bold text-emerald-400 block mt-2">
                    {actualSpentTotal.toLocaleString()} <span className="text-xs font-normal text-slate-400">บาท</span>
                  </span>
                </div>
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
                  <TrendingUp className="h-5 w-5" />
                </div>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800/80 p-5 rounded-2xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/5 rounded-full blur-2xl pointer-events-none" />
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider block">ยอดรวมส่งคืนคลัง</span>
                  <span className="text-xl font-bold text-rose-400 block mt-2">
                    {refundTotal.toLocaleString()} <span className="text-xs font-normal text-slate-400">บาท</span>
                  </span>
                </div>
                <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400">
                  <ArrowUpRight className="h-5 w-5" />
                </div>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800/80 p-5 rounded-2xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/5 rounded-full blur-2xl pointer-events-none" />
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider block">จำนวนโครงการทั้งหมด</span>
                  <span className="text-xl font-bold text-cyan-400 block mt-2">
                    {budgets.length} <span className="text-xs font-normal text-slate-400">โครงการ</span>
                  </span>
                </div>
                <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400">
                  <FileText className="h-5 w-5" />
                </div>
              </div>
            </div>
          </div>

          {/* Chart Section */}
          {budgets.length > 0 && (
            <div className="bg-slate-900/60 border border-slate-800/80 p-6 rounded-2xl shadow-xl">
              <h2 className="text-sm font-semibold text-slate-200 mb-6 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-indigo-400" />
                <span>เปรียบเทียบงบโครงการเสนออนุมัติ VS ค่าใช้จ่ายที่เกิดขึ้นจริง (ล่าสุด 7 โครงการ)</span>
              </h2>
              <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="name" stroke="#64748b" fontSize={9} />
                    <YAxis stroke="#64748b" fontSize={9} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '12px' }}
                      labelStyle={{ color: '#f8fafc', fontWeight: 'bold', fontSize: '11px' }}
                      itemStyle={{ fontSize: '11px' }}
                    />
                    <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
                    <Bar dataKey="งบประมาณตั้งต้น" fill="#6366f1" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="จ่ายจริง" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* List Table Section */}
          <div className="bg-slate-900 border border-slate-800/80 rounded-2xl overflow-hidden shadow-xl">
            {/* Filter Search */}
            <div className="p-5 border-b border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="relative w-full max-w-sm">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                  <Search className="h-4 w-4" />
                </span>
                <input
                  type="text"
                  placeholder="ค้นหาชื่อโครงการ หรือผู้จดบันทึก..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500/80 transition-all font-light"
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={fetchBudgets}
                  className="p-2 bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 rounded-xl transition-all cursor-pointer"
                  title="รีเฟรชข้อมูล"
                >
                  <RefreshCw className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Table layout */}
            <div className="overflow-x-auto">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                  <Loader2 className="h-8 w-8 animate-spin text-indigo-500 mb-3" />
                  <span className="text-xs">กำลังคิวรี่ตารางข้อมูล...</span>
                </div>
              ) : budgets.length === 0 ? (
                <div className="text-center py-20 text-slate-500">
                  <FileText className="h-12 w-12 mx-auto text-slate-700 mb-3" />
                  <p className="text-xs">ไม่พบข้อมูลโครงการในระบบ</p>
                </div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800/80 bg-slate-950/40 text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                      <th className="px-6 py-4">ชื่อโครงการ</th>
                      <th className="px-6 py-4">สถานะขั้นตอน</th>
                      <th className="px-6 py-4">งบประมาณได้รับ</th>
                      <th className="px-6 py-4">เบิกจ่ายจริง</th>
                      <th className="px-6 py-4">ส่วนต่างคืนคลัง</th>
                      <th className="px-6 py-4">วันที่อนุมัติ</th>
                      <th className="px-6 py-4 text-center">การดำเนินการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50 text-xs font-light text-slate-300">
                    {budgets
                      .filter(b => b.project_name.toLowerCase().includes(searchTerm.toLowerCase()) || (b.reporter_name && b.reporter_name.toLowerCase().includes(searchTerm.toLowerCase())))
                      .map(b => (
                        <tr key={b.id} className="hover:bg-slate-950/30 transition-colors">
                          <td className="px-6 py-4 font-normal text-white">
                            {b.project_name}
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex px-2 py-0.5 rounded text-[9px] font-semibold ${getStatusBadgeClass(b.status)}`}>
                              {b.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 font-medium text-slate-200">
                            {Number(b.budget_amount).toLocaleString()} บาท
                          </td>
                          <td className="px-6 py-4 text-emerald-400">
                            {b.status === 'จัดเสร็จสิ้น' || b.status === 'รายงานผลแล้ว' ? (
                              <span>{Number(b.actual_spent).toLocaleString()} บาท</span>
                            ) : (
                              <span className="text-slate-500">-</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-rose-400">
                            {b.status === 'รายงานผลแล้ว' ? (
                              <span>{Number(b.refund_amount).toLocaleString()} บาท</span>
                            ) : (
                              <span className="text-slate-500">-</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-slate-400">
                            {b.approval_date ? new Date(b.approval_date).toLocaleDateString('th-TH') : '-'}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex justify-center items-center gap-2">
                              <button
                                onClick={async () => {
                                  setSelectedBudget(b);
                                  // โหลดรายการย่อย
                                  try {
                                    const { data: items } = await supabase
                                      .from('budget_items')
                                      .select('*')
                                      .eq('budget_id', b.id)
                                      .order('created_at', { ascending: true });
                                    setBudgetItems(items || []);
                                    setView('detail');
                                  } catch (err) {
                                    console.error(err);
                                  }
                                }}
                                className="p-1.5 bg-slate-950 hover:bg-indigo-500/10 text-indigo-400 border border-slate-800 rounded-lg transition-all cursor-pointer"
                                title="ดูรายละเอียดโครงการ"
                              >
                                <FileText className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => handleOpenEditModal(b)}
                                className="p-1.5 bg-slate-950 hover:bg-amber-500/10 text-amber-400 border border-slate-800 rounded-lg transition-all cursor-pointer"
                                title="แก้ไขโครงการ"
                              >
                                <Edit className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteBudget(b.id)}
                                className="p-1.5 bg-slate-950 hover:bg-red-500/10 text-red-400 border border-slate-800 rounded-lg transition-all cursor-pointer"
                                title="ลบโครงการ"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}

      {view === 'detail' && selectedBudget && (
        <div className="bg-slate-900 border border-slate-800/80 rounded-2xl overflow-hidden shadow-xl p-6 space-y-6">
          <div className="flex justify-between items-center border-b border-slate-800/80 pb-4">
            <div>
              <span className={`inline-flex px-2 py-0.5 rounded text-[9px] font-semibold mb-2 ${getStatusBadgeClass(selectedBudget.status)}`}>
                {selectedBudget.status}
              </span>
              <h2 className="text-lg font-bold text-white">{selectedBudget.project_name}</h2>
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={() => setView('print')}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs rounded-xl cursor-pointer"
              >
                <Printer className="h-4 w-4 text-indigo-400" />
                <span>พรีวิวและพิมพ์ใบเสนอโครงการ</span>
              </button>
            </div>
          </div>

          {/* Stepper Status Indicator */}
          <div className="py-4">
            <h3 className="text-xs font-semibold text-slate-300 mb-4 uppercase tracking-wider">ขั้นตอนการจัดทำและติดตามโครงการ</h3>
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 bg-slate-950/60 p-4 rounded-xl border border-slate-800/60">
              {STEPPER_STATES.map((state, idx) => {
                const isCurrent = selectedBudget.status === state;
                const isPassed = STEPPER_STATES.indexOf(selectedBudget.status) >= idx;
                
                return (
                  <div key={state} className="flex-1 flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                        isCurrent 
                          ? 'bg-indigo-600 text-white animate-pulse' 
                          : isPassed 
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                            : 'bg-slate-900 text-slate-500 border border-slate-800'
                      }`}>
                        {idx + 1}
                      </div>
                      <span className={`text-[10px] font-medium ${
                        isCurrent 
                          ? 'text-indigo-400 font-bold' 
                          : isPassed 
                            ? 'text-slate-200' 
                            : 'text-slate-500'
                      }`}>
                        {state}
                      </span>
                    </div>
                    {idx < STEPPER_STATES.length - 1 && (
                      <div className="hidden lg:block flex-1 h-[1px] bg-slate-800" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Info list */}
            <div className="md:col-span-2 space-y-4">
              <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-800/60">
                <h4 className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold mb-2">คำอธิบายโครงการ/สรุปผล</h4>
                <p className="text-xs leading-relaxed text-slate-300 font-light whitespace-pre-line">
                  {selectedBudget.summary || 'ไม่มีคำอธิบายโครงการ'}
                </p>
              </div>

              {/* Expense Table comparison */}
              <div>
                <h4 className="text-xs font-semibold text-slate-200 mb-3 flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4 text-indigo-400" />
                  <span>ตารางวิเคราะห์รายการจ่ายจริงเปรียบเทียบประมาณการ</span>
                </h4>
                
                <div className="bg-slate-950/60 border border-slate-800 rounded-xl overflow-hidden">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-800/80 bg-slate-950 text-[10px] text-slate-400 uppercase tracking-wider font-medium">
                        <th className="px-4 py-3">หมวดหมู่</th>
                        <th className="px-4 py-3">คำอธิบาย</th>
                        <th className="px-4 py-3 text-right">งบประมาณที่ตั้ง</th>
                        <th className="px-4 py-3 text-right">ใช้จริง</th>
                        <th className="px-4 py-3 text-center">หลักฐานแนบ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50 text-slate-300">
                      {budgetItems.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-900/40">
                          <td className="px-4 py-3 text-slate-200 font-medium">{item.category}</td>
                          <td className="px-4 py-3 text-slate-400 font-light">{item.description || '-'}</td>
                          <td className="px-4 py-3 text-right font-medium">{Number(item.estimated_amount).toLocaleString()} บาท</td>
                          <td className="px-4 py-3 text-right text-emerald-400">
                            {selectedBudget.status === 'จัดเสร็จสิ้น' || selectedBudget.status === 'รายงานผลแล้ว' ? (
                              <span>{Number(item.actual_amount).toLocaleString()} บาท</span>
                            ) : (
                              <span className="text-slate-500">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {item.receipt_url ? (
                              <a
                                href={item.receipt_url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-[10px] text-indigo-400 hover:text-indigo-300 font-medium underline"
                              >
                                <Download className="h-3 w-3" />
                                <span>ดาวน์โหลดหลักฐาน</span>
                              </a>
                            ) : (
                              <span className="text-slate-600 text-[10px]">-</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-950 border-t border-slate-800 font-semibold text-slate-200">
                        <td colSpan={2} className="px-4 py-3">ยอดรวมโครงการ</td>
                        <td className="px-4 py-3 text-right">{totalEstimated.toLocaleString()} บาท</td>
                        <td className="px-4 py-3 text-right text-emerald-400">
                          {selectedBudget.status === 'จัดเสร็จสิ้น' || selectedBudget.status === 'รายงานผลแล้ว' ? (
                            <span>{totalActual.toLocaleString()} บาท</span>
                          ) : (
                            <span>-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-500"></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>

            {/* Quick stats & metadata */}
            <div className="space-y-4">
              <div className="bg-slate-950/60 p-5 rounded-2xl border border-slate-800/80 space-y-4">
                <h4 className="text-xs font-semibold text-slate-200 uppercase tracking-wider pb-2 border-b border-slate-800">ข้อมูลการอนุมัติ</h4>
                
                <div className="space-y-3 text-xs">
                  <div>
                    <span className="text-slate-500 block">วันที่จัดโครงการ</span>
                    <span className="text-slate-200 font-medium">
                      {selectedBudget.approval_date ? new Date(selectedBudget.approval_date).toLocaleDateString('th-TH') : '-'}
                      {selectedBudget.end_date && ` ถึง ${new Date(selectedBudget.end_date).toLocaleDateString('th-TH')}`}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">งบส่งคืนคงเหลือ</span>
                    <span className="text-rose-400 font-semibold text-sm">
                      {selectedBudget.status === 'รายงานผลแล้ว' ? `${Number(selectedBudget.refund_amount).toLocaleString()} บาท` : 'รอรายงานผล'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">ผู้รายงาน</span>
                    <span className="text-slate-200 font-medium">{selectedBudget.reporter_name || '-'}</span>
                    {selectedBudget.reporter_phone && (
                      <span className="text-slate-400 block text-[10px]">{selectedBudget.reporter_phone}</span>
                    )}
                  </div>
                  <div>
                    <span className="text-slate-500 block">ผู้ประสานงาน</span>
                    <span className="text-slate-200 font-medium">{selectedBudget.source_info || '-'}</span>
                    {selectedBudget.source_contact && (
                      <span className="text-slate-400 block text-[10px]">{selectedBudget.source_contact}</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Progress utilization */}
              {(selectedBudget.status === 'จัดเสร็จสิ้น' || selectedBudget.status === 'รายงานผลแล้ว') && (
                <div className="bg-slate-950/60 p-5 rounded-2xl border border-slate-800/80">
                  <h4 className="text-xs font-semibold text-slate-200 uppercase tracking-wider pb-2 border-b border-slate-800 mb-3">อัตราส่วนการใช้งบประมาณ</h4>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">ใช้จ่ายไป</span>
                      <span className="text-emerald-400 font-medium">
                        {((totalActual / (totalEstimated || 1)) * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden">
                      <div 
                        className="bg-gradient-to-r from-indigo-500 to-emerald-400 h-full rounded-full transition-all duration-500" 
                        style={{ width: `${Math.min(100, (totalActual / (totalEstimated || 1)) * 100)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-500 pt-1">
                      <span>ยอดจ่ายจริง: {totalActual.toLocaleString()} บาท</span>
                      <span>ประมาณการ: {totalEstimated.toLocaleString()} บาท</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {view === 'print' && selectedBudget && (
        <div className="bg-white text-slate-900 p-8 sm:p-12 rounded-2xl shadow-2xl space-y-8 font-serif relative">
          
          {/* Action buttons (Print) */}
          <div className="absolute top-4 right-4 flex gap-2 no-print">
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg shadow-md cursor-pointer"
            >
              <Printer className="h-4 w-4" />
              <span>พิมพ์เอกสารนี้</span>
            </button>
            <button
              onClick={() => setView('detail')}
              className="flex items-center gap-1.5 px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold rounded-lg cursor-pointer"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>ย้อนกลับ</span>
            </button>
          </div>

          {/* Official Document Layout */}
          <div className="text-center space-y-2 border-b-2 border-slate-900 pb-6">
            <h2 className="text-xl font-bold uppercase tracking-wider text-slate-800">เอกสารเสนอขออนุมัติโครงการและประมาณการค่าใช้จ่าย</h2>
            <h3 className="text-sm font-semibold text-slate-600">ศูนย์ไกล่เกลี่ยข้อพิพาทประจำหมู่บ้าน/ชุมชน (เงินกองทุนยุติธรรม)</h3>
            <p className="text-xs text-slate-500">พิมพ์วันที่: {new Date().toLocaleDateString('th-TH')}</p>
          </div>

          <div className="space-y-6 text-sm leading-relaxed">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="font-bold text-slate-800 block text-xs">ชื่อโครงการ:</span>
                <span className="text-slate-700 block">{selectedBudget.project_name}</span>
              </div>
              <div>
                <span className="font-bold text-slate-800 block text-xs">สถานะโครงการ:</span>
                <span className="text-slate-700 block">{selectedBudget.status}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="font-bold text-slate-800 block text-xs">วันที่เริ่มต้นจัดโครงการ:</span>
                <span className="text-slate-700 block">
                  {selectedBudget.approval_date ? new Date(selectedBudget.approval_date).toLocaleDateString('th-TH') : '-'}
                </span>
              </div>
              <div>
                <span className="font-bold text-slate-800 block text-xs">วันที่สิ้นสุดโครงการ:</span>
                <span className="text-slate-700 block">
                  {selectedBudget.end_date ? new Date(selectedBudget.end_date).toLocaleDateString('th-TH') : '-'}
                </span>
              </div>
            </div>

            <div>
              <span className="font-bold text-slate-800 block text-xs">วัตถุประสงค์และสรุปการทำงาน:</span>
              <p className="text-slate-700 whitespace-pre-line border border-slate-200 p-4 rounded-lg bg-slate-50 font-sans mt-1">
                {selectedBudget.summary || 'ไม่มีคำอธิบายสรุปโครงการ'}
              </p>
            </div>

            <div className="space-y-2">
              <span className="font-bold text-slate-800 block text-xs">ตารางรายการประมาณการค่าใช้จ่ายย่อย:</span>
              
              <table className="w-full border-collapse border border-slate-400 text-xs">
                <thead>
                  <tr className="bg-slate-100 text-slate-800 font-semibold border-b border-slate-400">
                    <th className="border border-slate-400 px-4 py-2.5">หมวดหมู่ค่าใช้จ่าย</th>
                    <th className="border border-slate-400 px-4 py-2.5">รายละเอียดคำอธิบาย</th>
                    <th className="border border-slate-400 px-4 py-2.5 text-right w-[150px]">ประมาณการ (บาท)</th>
                    <th className="border border-slate-400 px-4 py-2.5 text-right w-[150px]">จ่ายจริง (บาท)</th>
                  </tr>
                </thead>
                <tbody className="text-slate-700 font-sans">
                  {budgetItems.map((item, idx) => (
                    <tr key={idx} className="border-b border-slate-400">
                      <td className="border border-slate-400 px-4 py-2 font-medium">{item.category}</td>
                      <td className="border border-slate-400 px-4 py-2">{item.description || '-'}</td>
                      <td className="border border-slate-400 px-4 py-2 text-right">{Number(item.estimated_amount).toLocaleString()}</td>
                      <td className="border border-slate-400 px-4 py-2 text-right">
                        {selectedBudget.status === 'จัดเสร็จสิ้น' || selectedBudget.status === 'รายงานผลแล้ว'
                          ? Number(item.actual_amount).toLocaleString()
                          : '-'}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-slate-50 font-bold text-slate-800 border-t-2 border-slate-900">
                    <td colSpan={2} className="border border-slate-400 px-4 py-2.5 text-right">ยอดรวมงบประมาณโครงการ</td>
                    <td className="border border-slate-400 px-4 py-2.5 text-right">{totalEstimated.toLocaleString()}</td>
                    <td className="border border-slate-400 px-4 py-2.5 text-right">
                      {selectedBudget.status === 'จัดเสร็จสิ้น' || selectedBudget.status === 'รายงานผลแล้ว'
                        ? totalActual.toLocaleString()
                        : '-'}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="pt-10 flex justify-between items-center gap-8 text-center text-xs font-sans">
              <div className="flex-1 space-y-8">
                <p>ลงชื่อ.......................................................... ผู้ประสานงานโครงการ</p>
                <p>( {selectedBudget.source_info || '..........................................................'} )</p>
              </div>
              <div className="flex-1 space-y-8">
                <p>ลงชื่อ.......................................................... ผู้รายงาน/ผู้บันทึก</p>
                <p>( {selectedBudget.reporter_name || '..........................................................'} )</p>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Add / Edit Form Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800/80 w-full max-w-4xl max-h-[90vh] rounded-2xl overflow-hidden shadow-2xl flex flex-col">
            
            {/* Header */}
            <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-900/60">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400">
                  <Sparkles className="h-4 w-4" />
                </div>
                <h3 className="text-sm font-semibold text-white">
                  {editingId ? 'แก้ไขข้อมูลโครงการงบประมาณ' : 'สร้างข้อมูลโครงการงบประมาณใหม่'}
                </h3>
              </div>
              <button 
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Stepper Status in Form (Clickable) */}
            <div className="px-6 py-4 bg-slate-950/60 border-b border-slate-800 flex flex-wrap gap-2 items-center justify-between">
              <span className="text-[10px] text-slate-400 uppercase font-semibold">ขั้นตอนโครงการ (คลิกเพื่อปรับ):</span>
              <div className="flex flex-wrap gap-1.5">
                {STEPPER_STATES.map((state) => {
                  const isActive = formData.status === state;
                  return (
                    <button
                      key={state}
                      type="button"
                      onClick={() => setFormData((prev: any) => ({ ...prev, status: state }))}
                      className={`px-2.5 py-1 rounded-lg text-[9px] font-semibold border transition-all cursor-pointer ${
                        isActive 
                          ? 'bg-indigo-600 border-indigo-500 text-white shadow-md shadow-indigo-600/10' 
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {state}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-800 text-xs">
              <button
                type="button"
                onClick={() => setActiveFormTab('info')}
                className={`px-6 py-3 font-semibold transition-all cursor-pointer ${
                  activeFormTab === 'info' 
                    ? 'border-b-2 border-indigo-500 text-indigo-400' 
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                1. ข้อมูลรายละเอียดโครงการ
              </button>
              <button
                type="button"
                onClick={() => setActiveFormTab('items')}
                className={`px-6 py-3 font-semibold transition-all cursor-pointer flex items-center gap-2 ${
                  activeFormTab === 'items' 
                    ? 'border-b-2 border-indigo-500 text-indigo-400' 
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>2. ตารางแจกแจงงบประมาณย่อย</span>
                <span className="bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded-full text-[9px]">
                  {budgetItems.length}
                </span>
              </button>
            </div>

            {/* Content Form Scroll area */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
              
              {activeFormTab === 'info' && (
                <div className="space-y-6">
                  {/* AI Story input inside Modal */}
                  <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800/80 space-y-3">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold flex items-center gap-1">
                      <Sparkles className="h-3 w-3 text-indigo-400" />
                      <span>บันทึกเสียงพูดถอดข้อมูลโครงการยื่นขออัตโนมัติ (AI Voice Assistant)</span>
                    </span>
                    <div className="flex gap-2">
                      <textarea
                        value={aiStoryText}
                        onChange={(e) => setAiStoryText(e.target.value)}
                        placeholder="พูดอธิบายโครงการ... เช่น สร้างโครงการให้ความรู้สิทธิตามกฎหมาย ได้รับอนุมัติวันที่ 1 มีนาคม 2569 บันทึกโดย นายวินัย รักงาน..."
                        className="flex-1 bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500/80 resize-y min-h-[60px] font-light leading-relaxed"
                      />
                      <div className="flex flex-col gap-2">
                        <button
                          type="button"
                          onClick={isGlobalListening ? stopGlobalListening : startGlobalListening}
                          className={`p-2 rounded-xl border transition-all flex items-center justify-center cursor-pointer ${
                            isGlobalListening 
                              ? 'bg-rose-600 border-rose-500 text-white animate-pulse' 
                              : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                          }`}
                        >
                          {isGlobalListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                        </button>
                        <button
                          type="button"
                          onClick={handleAIParsing}
                          disabled={aiParsing || !aiStoryText.trim()}
                          className="px-3 py-2 bg-indigo-600 disabled:bg-slate-800 hover:bg-indigo-500 text-white text-[10px] font-semibold rounded-xl cursor-pointer transition-all"
                        >
                          {aiParsing ? <Loader2 className="h-4 w-4 animate-spin" /> : 'ดึงข้อมูล'}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Project Name */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold text-slate-300">ชื่อโครงการ/รายการเบิกจ่าย *</label>
                      <input
                        type="text"
                        required
                        value={formData.project_name}
                        onChange={(e) => setFormData((prev: any) => ({ ...prev, project_name: e.target.value }))}
                        className={`w-full bg-slate-950 border rounded-xl px-3.5 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500/80 transition-all font-light ${
                          highlightFields.project_name ? 'border-indigo-500 bg-indigo-950/20' : 'border-slate-800'
                        }`}
                        placeholder="เช่น โครงการเสริมสร้างความรู้ทางกฎหมายประจำปี"
                      />
                    </div>

                    {/* Dates */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-semibold text-slate-300">วันที่เริ่มต้นจัดโครงการ *</label>
                        <input
                          type="date"
                          required
                          value={formData.approval_date}
                          onChange={(e) => setFormData((prev: any) => ({ ...prev, approval_date: e.target.value }))}
                          className={`w-full bg-slate-950 border rounded-xl px-3 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500/80 transition-all font-light ${
                            highlightFields.approval_date ? 'border-indigo-500 bg-indigo-950/20' : 'border-slate-800'
                          }`}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-semibold text-slate-300">วันที่จัดโครงการเสร็จสิ้น</label>
                        <input
                          type="date"
                          value={formData.end_date}
                          onChange={(e) => setFormData((prev: any) => ({ ...prev, end_date: e.target.value }))}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500/80 transition-all font-light"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Summary/Description */}
                  <div className="space-y-1.5 relative">
                    <label className="text-[11px] font-semibold text-slate-300">วัตถุประสงค์และสรุปผลโครงการ</label>
                    <div className="relative">
                      <textarea
                        rows={4}
                        value={formData.summary}
                        onChange={(e) => setFormData((prev: any) => ({ ...prev, summary: e.target.value }))}
                        className={`w-full bg-slate-950 border rounded-xl pl-3.5 pr-10 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500/80 transition-all font-light leading-relaxed ${
                          highlightFields.summary ? 'border-indigo-500 bg-indigo-950/20' : 'border-slate-800'
                        }`}
                        placeholder="รายละเอียดหัวข้อโครงการที่จะจัดอบรม, วัตถุประสงค์ของการดำเนินงาน..."
                      />
                      <button
                        type="button"
                        onClick={() => toggleFieldVoice('summary')}
                        className={`absolute top-2.5 right-2.5 p-1.5 rounded-lg border transition-all cursor-pointer ${
                          activeVoiceField === 'summary' 
                            ? 'bg-rose-600 border-rose-500 text-white animate-pulse' 
                            : 'bg-slate-900 border-slate-800/80 text-slate-400 hover:text-white'
                        }`}
                      >
                        {activeVoiceField === 'summary' ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>

                  {/* Contacts Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-800/60">
                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-semibold text-slate-300">ชื่อผู้บันทึกรายงาน *</label>
                        <input
                          type="text"
                          required
                          value={formData.reporter_name}
                          onChange={(e) => setFormData((prev: any) => ({ ...prev, reporter_name: e.target.value }))}
                          className={`w-full bg-slate-950 border rounded-xl px-3.5 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500/80 transition-all font-light ${
                            highlightFields.reporter_name ? 'border-indigo-500 bg-indigo-950/20' : 'border-slate-800'
                          }`}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-semibold text-slate-300">เบอร์ติดต่อผู้บันทึก</label>
                        <input
                          type="text"
                          value={formData.reporter_phone}
                          onChange={(e) => setFormData((prev: any) => ({ ...prev, reporter_phone: e.target.value }))}
                          className={`w-full bg-slate-950 border rounded-xl px-3.5 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500/80 transition-all font-light ${
                            highlightFields.reporter_phone ? 'border-indigo-500 bg-indigo-950/20' : 'border-slate-800'
                          }`}
                        />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-semibold text-slate-300">ชื่อผู้ประสานงานหลัก</label>
                        <input
                          type="text"
                          value={formData.source_info}
                          onChange={(e) => setFormData((prev: any) => ({ ...prev, source_info: e.target.value }))}
                          className={`w-full bg-slate-950 border rounded-xl px-3.5 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500/80 transition-all font-light ${
                            highlightFields.source_info ? 'border-indigo-500 bg-indigo-950/20' : 'border-slate-800'
                          }`}
                          placeholder="ผู้รับผิดชอบหรือประสานกับทางกองทุน"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-semibold text-slate-300">เบอร์ติดต่อผู้ประสานงาน</label>
                        <input
                          type="text"
                          value={formData.source_contact}
                          onChange={(e) => setFormData((prev: any) => ({ ...prev, source_contact: e.target.value }))}
                          className={`w-full bg-slate-950 border rounded-xl px-3.5 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500/80 transition-all font-light ${
                            highlightFields.source_contact ? 'border-indigo-500 bg-indigo-950/20' : 'border-slate-800'
                          }`}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeFormTab === 'items' && (
                <div className="space-y-6">
                  <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                    <div>
                      <h4 className="text-xs font-semibold text-slate-200">ประมาณการค่าใช้จ่ายย่อย</h4>
                      <p className="text-[10px] text-slate-500 mt-0.5">ระบุรายการตามแผนประมาณการ หากจัดโครงการเสร็จสิ้นสามารถกลับมากรอกยอดเบิกจ่ายจริงพร้อมแนบใบเสร็จได้</p>
                    </div>
                    
                    <button
                      type="button"
                      onClick={addBudgetItemRow}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-semibold rounded-lg cursor-pointer transition-all"
                    >
                      <Plus className="h-3.5 w-3.5 text-indigo-400" />
                      <span>เพิ่มแถวรายการค่าใช้จ่าย</span>
                    </button>
                  </div>

                  {/* Spreadsheet table rows */}
                  <div className="space-y-4">
                    {budgetItems.map((item, index) => {
                      const showActualAndReceipt = formData.status === 'จัดเสร็จสิ้น' || formData.status === 'รายงานผลแล้ว';
                      
                      return (
                        <div key={index} className="grid grid-cols-1 lg:grid-cols-12 gap-4 bg-slate-950/40 p-4 rounded-xl border border-slate-800/80 relative">
                          <button
                            type="button"
                            onClick={() => removeBudgetItemRow(index)}
                            className="absolute -top-2.5 -right-2.5 p-1 bg-slate-900 border border-slate-800 hover:bg-red-500/10 text-slate-500 hover:text-red-400 rounded-full transition-all cursor-pointer"
                            title="ลบแถวนี้"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>

                          {/* Category select */}
                          <div className="lg:col-span-3 space-y-1">
                            <label className="text-[9px] font-semibold text-slate-400">หมวดหมู่หลัก</label>
                            <select
                              value={item.category}
                              onChange={(e) => updateBudgetItemField(index, 'category', e.target.value)}
                              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500/80"
                            >
                              {EXPENSE_CATEGORIES.map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                              ))}
                            </select>
                          </div>

                          {/* Description */}
                          <div className="lg:col-span-3 space-y-1">
                            <label className="text-[9px] font-semibold text-slate-400">รายละเอียดโครงการย่อย (ถ้ามี)</label>
                            <input
                              type="text"
                              value={item.description}
                              onChange={(e) => updateBudgetItemField(index, 'description', e.target.value)}
                              placeholder="เช่น ค่าวิทยากร 500 บาท x 6 ชม."
                              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500/80"
                            />
                          </div>

                          {/* Estimated Amount */}
                          <div className="lg:col-span-2 space-y-1">
                            <label className="text-[9px] font-semibold text-slate-400">ประมาณการตั้งไว้ (บาท)</label>
                            <input
                              type="number"
                              value={item.estimated_amount || ''}
                              onChange={(e) => updateBudgetItemField(index, 'estimated_amount', Number(e.target.value))}
                              placeholder="0"
                              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500/80 text-right"
                            />
                          </div>

                          {/* Actual Amount */}
                          <div className={`lg:col-span-2 space-y-1 ${!showActualAndReceipt ? 'opacity-40 pointer-events-none' : ''}`}>
                            <label className="text-[9px] font-semibold text-slate-400">รายจ่ายจริง (บาท)</label>
                            <input
                              type="number"
                              disabled={!showActualAndReceipt}
                              value={item.actual_amount || ''}
                              onChange={(e) => updateBudgetItemField(index, 'actual_amount', Number(e.target.value))}
                              placeholder="0"
                              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500/80 text-right"
                            />
                          </div>

                          {/* Receipt File Link Upload */}
                          <div className={`lg:col-span-2 space-y-1 ${!showActualAndReceipt ? 'opacity-40 pointer-events-none' : ''}`}>
                            <label className="text-[9px] font-semibold text-slate-400">อัปโหลดหลักฐานใบเสร็จ</label>
                            {item.receipt_url ? (
                              <div className="flex items-center justify-between bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 px-2 py-1.5 rounded-lg text-[9px] truncate">
                                <span className="truncate max-w-[80px]" title={item.receipt_name || 'ไฟล์ใบเสร็จ'}>
                                  {item.receipt_name || 'แนบสำเร็จ'}
                                </span>
                                <button
                                  type="button"
                                  disabled={!showActualAndReceipt}
                                  onClick={() => {
                                    updateBudgetItemField(index, 'receipt_url', '');
                                    updateBudgetItemField(index, 'receipt_name', '');
                                  }}
                                  className="text-indigo-400 hover:text-red-400 cursor-pointer"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </div>
                            ) : (
                              <div className="relative">
                                <input
                                  type="file"
                                  disabled={!showActualAndReceipt || uploadingItemIndex === index}
                                  onChange={(e) => handleItemReceiptUpload(index, e)}
                                  className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                                />
                                <button
                                  type="button"
                                  disabled={!showActualAndReceipt || uploadingItemIndex === index}
                                  className="w-full bg-slate-900 border border-slate-800 text-slate-400 text-[10px] py-2 px-3 rounded-lg text-center truncate hover:text-white"
                                >
                                  {uploadingItemIndex === index ? 'กำลังอัป...' : 'เลือกแนบบิล'}
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Summary Box */}
                  <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800/80 flex flex-col md:flex-row justify-between gap-4 text-xs font-semibold text-slate-300">
                    <div>
                      <span>ยอดงบประมาณรวมจากประมาณการย่อย: </span>
                      <span className="text-white text-sm">{totalEstimated.toLocaleString()} บาท</span>
                    </div>
                    {(formData.status === 'จัดเสร็จสิ้น' || formData.status === 'รายงานผลแล้ว') && (
                      <>
                        <div>
                          <span>ยอดใช้จ่ายจริงรวม: </span>
                          <span className="text-emerald-400 text-sm">{totalActual.toLocaleString()} บาท</span>
                        </div>
                        <div>
                          <span>เงินงบส่งคืนกองทุน (ส่วนต่างเหลือ): </span>
                          <span className="text-rose-400 text-sm">{totalDifference.toLocaleString()} บาท</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

            </form>

            {/* Footer buttons */}
            <div className="p-5 border-t border-slate-800 flex justify-between items-center bg-slate-900/60">
              <span className="text-[10px] text-slate-500">*กรุณากรอกฟิลด์ที่มีดอกจันสีแดงให้ครบถ้วน</span>
              
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 border border-slate-850 hover:bg-slate-800 text-slate-400 hover:text-white text-xs font-medium rounded-xl transition-all cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  className="flex items-center justify-center gap-1.5 px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl transition-all shadow-md cursor-pointer"
                >
                  <Save className="h-4 w-4" />
                  <span>บันทึกโครงการ</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
