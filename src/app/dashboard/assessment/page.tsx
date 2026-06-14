'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { 
  Award, Calendar, Settings, FileText, CheckCircle, AlertTriangle, 
  Upload, Download, Loader2, Save, Send, ChevronDown, ChevronUp, UserCheck
} from 'lucide-react';
import Swal from 'sweetalert2';

interface AssessmentSettings {
  targetYear: string;
  startDate: string;
  endDate: string;
  welcomeMessage: string;
  regulationLink: string;
}

const CRITERIA_GROUPS = [
  {
    title: 'หมวดที่ 1: การบริหารจัดการองค์การและโครงสร้าง (โครงสร้าง)',
    items: [
      { key: '1_1', label: '1.1 การวางโครงสร้างการทำงานและแผนงานประจำปี' },
      { key: '1_2', label: '1.2 การระบุกำหนดบทบาทหน้าที่คณะทำงานและผู้ไกล่เกลี่ย' },
      { key: '1_3', label: '1.3 การบริหารจัดการอาคารสถานที่และระบบระเบียนคลังข้อมูล' }
    ]
  },
  {
    title: 'หมวดที่ 2: การพัฒนาศักยภาพและการประชาสัมพันธ์ (การประชาสัมพันธ์)',
    items: [
      { key: '2_1', label: '2.1 การดำเนินกิจกรรมให้ความรู้กฎหมายและสิทธิชุมชน' },
      { key: '2_2', label: '2.2 การสร้างเครือข่ายความร่วมมือและสื่อประชาสัมพันธ์' }
    ]
  },
  {
    title: 'หมวดที่ 3: กระบวนการไกล่เกลี่ยข้อพิพาทและคุ้มครองสิทธิ (กระบวนการ)',
    items: [
      { key: '3_1', label: '3.1 ระบบการรับคำร้อง คัดกรอง และบันทึกเรื่องร้องเรียน' },
      { key: '3_2', label: '3.2 การเตรียมความพร้อมและนัดหมายคู่กรณีเข้าสู่การไกล่เกลี่ย' },
      { key: '3_3', label: '3.3 วิธีการดำเนินงานระหว่างจัดกระบวนการเจรจาไกล่เกลี่ย' },
      { key: '3_4', label: '3.4 การจัดทำเอกสารและทำสัญญาประนีประนอมยอมความ' },
      { key: '3_5', label: '3.5 การติดตามประเมินผลสัมฤทธิ์คดีความหลังสิ้นสุดกระบวนการ' }
    ]
  },
  {
    title: 'หมวดที่ 4: มาตรฐานการจริยธรรมและการคุ้มครองผู้บริโภค (จริยธรรม)',
    items: [
      { key: '4_1', label: '4.1 การกำกับดูแลจริยธรรมและมารยาทของผู้รับหน้าที่ไกล่เกลี่ย' },
      { key: '4_2', label: '4.2 มาตรการรักษาความลับและความเป็นส่วนตัวของผู้รับบริการ' },
      { key: '4_3', label: '4.3 การรวบรวมประเมินระดับความพึงพอใจของผู้มาใช้บริการ' }
    ]
  },
  {
    title: 'หมวดที่ 5: การประยุกต์ใช้นวัตกรรมและการพัฒนาสู่ความยั่งยืน (นวัตกรรม)',
    items: [
      { key: '5_1', label: '5.1 การประยุกต์ใช้เทคโนโลยีสารสนเทศช่วยบริหารข้อมูล' },
      { key: '5_2', label: '5.2 การคิดค้นนวัตกรรมการเจรจาและกระบวนการทำงานแบบใหม่' },
      { key: '5_3', label: '5.3 แผนงานความต่อเนื่องและการพึ่งพาตนเองอย่างยั่งยืน' }
    ]
  }
];

export default function AssessmentPage() {
  const { user, profile } = useAuth();
  const [activeTab, setActiveTab] = useState<'form' | 'admin_settings' | 'admin_grades' | 'admin_reviews'>('form');
  const [loading, setLoading] = useState(true);

  // Settings & Eligibility State
  const [settings, setSettings] = useState<AssessmentSettings>({
    targetYear: '',
    startDate: '',
    endDate: '',
    welcomeMessage: '',
    regulationLink: ''
  });
  const [isOpen, setIsOpen] = useState(false);
  const [isEligible, setIsEligible] = useState(false);
  const [userGrade, setUserGrade] = useState<any>(null);
  const [targetYearInt, setTargetYearInt] = useState(0);

  // Self-Assessment Form State
  const [criteriaData, setCriteriaData] = useState<Record<string, { score: number; desc: string; file_url: string }>>({});
  const [totalScore, setTotalScore] = useState(0);
  const [assessmentStatus, setAssessmentStatus] = useState<string>('Draft');
  const [expandedGroups, setExpandedGroups] = useState<Record<number, boolean>>({ 0: true });
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);

  // Admin Config State
  const [userOptions, setUserOptions] = useState<any[]>([]);
  const [selectedCenterId, setSelectedCenterId] = useState('');
  const [centerGradeInput, setCenterGradeInput] = useState({ year: '', grade: 'A', score: 85 });
  const [gradesList, setGradesList] = useState<any[]>([]);
  const [allAssessments, setAllAssessments] = useState<any[]>([]);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [selectedReview, setSelectedReview] = useState<any>(null);

  useEffect(() => {
    if (user && profile) {
      loadInitialData();
    }
  }, [user, profile]);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      // 1. Fetch settings
      const { data: settingsData, error: settingsError } = await supabase
        .from('award_settings')
        .select('*')
        .eq('id', 1)
        .single();

      if (settingsError) throw settingsError;

      const currentSettings: AssessmentSettings = {
        targetYear: settingsData.target_year,
        startDate: settingsData.start_date || '',
        endDate: settingsData.end_date || '',
        welcomeMessage: settingsData.welcome_message || '',
        regulationLink: settingsData.regulation_link || ''
      };
      setSettings(currentSettings);

      const targetYr = parseInt(currentSettings.targetYear) || 0;
      setTargetYearInt(targetYr);

      // Determine if open
      const now = new Date();
      let open = false;
      if (currentSettings.startDate && currentSettings.endDate) {
        const start = new Date(currentSettings.startDate + 'T00:00:00');
        const end = new Date(currentSettings.endDate + 'T23:59:59');
        if (now >= start && now <= end) {
          open = true;
        }
      }
      setIsOpen(open);

      // 2. Fetch User Grade (Previous Year)
      const prevYearBE = String(targetYr - 1);
      const { data: gradeData } = await supabase
        .from('center_grades')
        .select('*')
        .eq('user_id', user?.id)
        .eq('year', prevYearBE)
        .maybeSingle();

      setUserGrade(gradeData);
      
      // Eligibility criteria: Grade contains A or score >= 81
      if (gradeData) {
        const gradeStr = String(gradeData.grade).toUpperCase();
        const scoreVal = parseFloat(gradeData.score) || 0;
        if (gradeStr.includes('A') || scoreVal >= 81) {
          setIsEligible(true);
        }
      }

      // 3. Fetch Assessment Draft/Submitted if exists
      const { data: assessment } = await supabase
        .from('self_assessments')
        .select('*')
        .eq('user_id', user?.id)
        .eq('year', currentSettings.targetYear)
        .maybeSingle();

      if (assessment) {
        setCriteriaData(assessment.criteria || {});
        setTotalScore(assessment.total_score || 0);
        setAssessmentStatus(assessment.status);
      } else {
        // Initialize criteria values
        const initial: any = {};
        CRITERIA_GROUPS.forEach(g => {
          g.items.forEach(i => {
            initial[i.key] = { score: 1, desc: '', file_url: '' };
          });
        });
        setCriteriaData(initial);
      }

      // 4. Admin setup if role === 'admin'
      if (profile?.role === 'admin') {
        const { data: users } = await supabase
          .from('profiles')
          .select('id, name, province')
          .eq('role', 'user');
        setUserOptions(users || []);

        // Load grades list
        const { data: grades } = await supabase
          .from('center_grades')
          .select('*, profiles(name, province)')
          .order('year', { ascending: false });
        setGradesList(grades || []);

        // Load all submitted self-assessments
        const { data: assessments } = await supabase
          .from('self_assessments')
          .select('*, profiles(name, province)')
          .order('updated_at', { ascending: false });
        setAllAssessments(assessments || []);

        // Update year form defaults
        setCenterGradeInput(prev => ({ ...prev, year: String(currentYearBE - 1) }));
      }

    } catch (e: any) {
      console.error(e);
      Swal.fire('Error', 'ไม่สามารถดึงข้อมูลระบบประเมินตนเองได้: ' + e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (key: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingKey(key);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `award_${key}_${Date.now()}.${fileExt}`;
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

      setCriteriaData(prev => {
        const updated = { ...prev };
        updated[key] = { ...updated[key], file_url: publicUrl };
        return updated;
      });

      Swal.fire({
        icon: 'success',
        title: 'อัปโหลดหลักฐานสำเร็จ',
        timer: 1000,
        showConfirmButton: false
      });

    } catch (err: any) {
      console.error(err);
      Swal.fire('Failed', 'ไม่สามารถอัปโหลดไฟล์หลักฐานได้: ' + err.message, 'error');
    } finally {
      setUploadingKey(null);
    }
  };

  const toggleGroup = (index: number) => {
    setExpandedGroups(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  const calculateTotal = (data: Record<string, any>) => {
    let sum = 0;
    Object.values(data).forEach((item: any) => {
      sum += parseInt(item.score) || 0;
    });
    setTotalScore(sum);
    return sum;
  };

  const handleScoreChange = (key: string, val: number) => {
    setCriteriaData(prev => {
      const updated = { ...prev };
      updated[key] = { ...updated[key], score: val };
      calculateTotal(updated);
      return updated;
    });
  };

  const handleDescChange = (key: string, val: string) => {
    setCriteriaData(prev => {
      const updated = { ...prev };
      updated[key] = { ...updated[key], desc: val };
      return updated;
    });
  };

  const handleSaveAssessment = async (submit = false) => {
    setLoading(true);
    try {
      const status = submit ? 'Submitted' : 'Draft';
      
      const payload = {
        user_id: user?.id,
        year: settings.targetYear,
        total_score: totalScore,
        status: status,
        criteria: criteriaData,
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('self_assessments')
        .upsert(payload, { onConflict: 'user_id,year' });

      if (error) throw error;

      Swal.fire({
        icon: 'success',
        title: submit ? 'ส่งแบบประเมินตนเองสำเร็จ' : 'บันทึกร่างข้อมูลสำเร็จ',
        text: submit ? 'ข้อมูลถูกจัดส่งไปยังผู้ดูแลระบบเรียบร้อยแล้ว' : 'คุณสามารถกลับมาแก้ไขรายละเอียดต่อได้ตลอดเวลา',
        confirmButtonText: 'ตกลง',
        confirmButtonColor: '#4f46e5'
      });

      setAssessmentStatus(status);

    } catch (e: any) {
      console.error(e);
      Swal.fire('Error', 'ไม่สามารถบันทึกข้อมูลแบบประเมินได้: ' + e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase
        .from('award_settings')
        .update({
          target_year: settings.targetYear,
          start_date: settings.startDate,
          end_date: settings.endDate,
          welcome_message: settings.welcomeMessage,
          regulation_link: settings.regulationLink,
          updated_at: new Date().toISOString()
        })
        .eq('id', 1);

      if (error) throw error;

      Swal.fire('สำเร็จ', 'บันทึกการตั้งค่าระบบองค์กรต้นแบบสำเร็จ', 'success');
      loadInitialData();

    } catch (e: any) {
      console.error(e);
      Swal.fire('Error', 'ไม่สามารถบันทึกการตั้งค่าได้: ' + e.message, 'error');
      setLoading(false);
    }
  };

  const handleSaveGrade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCenterId) {
      Swal.fire('เตือน', 'กรุณาเลือกศูนย์ที่ต้องการบันทึกเกรด', 'warning');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('center_grades')
        .upsert({
          user_id: selectedCenterId,
          year: centerGradeInput.year,
          grade: centerGradeInput.grade,
          score: centerGradeInput.score,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id,year' });

      if (error) throw error;

      Swal.fire('สำเร็จ', 'บันทึกประวัติเกรดและการประเมินเรียบร้อย', 'success');
      loadInitialData();

    } catch (e: any) {
      console.error(e);
      Swal.fire('Error', 'เกิดข้อผิดพลาดในการบันทึกเกรด: ' + e.message, 'error');
      setLoading(false);
    }
  };

  const currentYearBE = new Date().getFullYear() + 543;

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Award className="h-6 w-6 text-indigo-400" />
            <span>ระบบประเมินศูนย์ต้นแบบ (อกตบ.)</span>
          </h1>
          <p className="text-xs text-slate-400 font-light mt-1">
            {profile?.role === 'admin' ? 'แผงควบคุมแอดมินและการจัดการสิทธิ์ตรวจประเมิน' : 'กรอกการประเมินตนเองประจำปีเพื่อขอรับรองมาตรฐาน'}
          </p>
        </div>

        {profile?.role === 'admin' && (
          <div className="flex bg-slate-900 border border-slate-800 p-1 rounded-xl text-xs">
            <button
              onClick={() => setActiveTab('form')}
              className={`px-3 py-1.5 rounded-lg cursor-pointer transition-colors ${activeTab === 'form' ? 'bg-indigo-600 text-white font-medium' : 'text-slate-400 hover:text-white'}`}
            >
              ดูหน้ากรอก
            </button>
            <button
              onClick={() => setActiveTab('admin_settings')}
              className={`px-3 py-1.5 rounded-lg cursor-pointer transition-colors ${activeTab === 'admin_settings' ? 'bg-indigo-600 text-white font-medium' : 'text-slate-400 hover:text-white'}`}
            >
              ตั้งค่าปี
            </button>
            <button
              onClick={() => setActiveTab('admin_grades')}
              className={`px-3 py-1.5 rounded-lg cursor-pointer transition-colors ${activeTab === 'admin_grades' ? 'bg-indigo-600 text-white font-medium' : 'text-slate-400 hover:text-white'}`}
            >
              จัดการเกรด
            </button>
            <button
              onClick={() => setActiveTab('admin_reviews')}
              className={`px-3 py-1.5 rounded-lg cursor-pointer transition-colors ${activeTab === 'admin_reviews' ? 'bg-indigo-600 text-white font-medium' : 'text-slate-400 hover:text-white'}`}
            >
              ตรวจประเมิน ({allAssessments.length})
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="py-32 flex flex-col items-center justify-center text-slate-400">
          <Loader2 className="animate-spin h-10 w-10 text-indigo-500 mb-4" />
          <span>กำลังประมวลผลข้อมูลระบบการประเมิน...</span>
        </div>
      ) : activeTab === 'form' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column: Eligibility and Welcome Info */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-slate-900 border border-slate-800/80 p-6 rounded-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none" />
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Calendar className="h-4.5 w-4.5 text-indigo-400" />
                <span>รอบปีการประเมิน {settings.targetYear}</span>
              </h3>
              
              <div className="mt-6 p-4 bg-slate-950/40 rounded-xl border border-slate-800/50 space-y-3 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">ปีเป้าหมายประเมิน:</span>
                  <span className="text-white font-semibold">{settings.targetYear}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">ช่วงประเมิน:</span>
                  <span className="text-white font-semibold">
                    {settings.startDate ? new Date(settings.startDate).toLocaleDateString('th-TH') : '-'} ถึง {settings.endDate ? new Date(settings.endDate).toLocaleDateString('th-TH') : '-'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">สถานะช่วงเวลา:</span>
                  <span className={`px-2 py-0.5 rounded font-medium ${isOpen ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}`}>
                    {isOpen ? 'เปิดให้ส่งประเมิน' : 'ปิดระบบการส่ง'}
                  </span>
                </div>
              </div>

              {settings.welcomeMessage && (
                <div className="mt-6 p-4 bg-indigo-500/5 rounded-xl border border-indigo-500/10 text-xs text-indigo-300 font-light">
                  <p className="leading-5">{settings.welcomeMessage}</p>
                </div>
              )}

              {settings.regulationLink && (
                <a
                  href={settings.regulationLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-6 w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-950/40 hover:bg-indigo-500/10 text-indigo-400 font-medium rounded-xl text-xs border border-slate-800 hover:border-indigo-500/20 transition-all cursor-pointer"
                >
                  <Download className="h-4 w-4" />
                  <span>ดาวน์โหลดเกณฑ์การประเมิน (PDF)</span>
                </a>
              )}
            </div>

            {/* Eligibility Card */}
            <div className="bg-slate-900 border border-slate-800/80 p-6 rounded-2xl">
              <h3 className="text-sm font-semibold text-white mb-4">สถานะสิทธิ์ขอประเมินองค์กรต้นแบบ</h3>
              
              {userGrade ? (
                <div className="space-y-4 text-xs">
                  <div className="p-4 bg-slate-950/40 rounded-xl border border-slate-800/50 space-y-2">
                    <div className="flex justify-between">
                      <span className="text-slate-500">ประเมินของปี พ.ศ.:</span>
                      <span className="text-white font-semibold">{userGrade.year}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">เกรดที่ได้:</span>
                      <span className="text-indigo-400 font-bold">{userGrade.grade}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">คะแนนประเมินหลัก:</span>
                      <span className="text-white font-semibold">{userGrade.score} / 100</span>
                    </div>
                  </div>

                  {isEligible ? (
                    <div className="flex items-start gap-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-4 rounded-xl">
                      <CheckCircle className="h-5 w-5 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-semibold block">มีสิทธิ์ยื่นประเมินตนเอง</span>
                        <span className="text-[10px] text-emerald-500/80 mt-1 block">เกณฑ์การประกวด: เกรดปีที่ผ่านมาอยู่ในระดับ A หรือมีคะแนนตั้งแต่ 81 คะแนนขึ้นไป</span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 p-4 rounded-xl">
                      <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-semibold block">ไม่มีสิทธิ์ยื่นขอรับรอง</span>
                        <span className="text-[10px] text-rose-500/80 mt-1 block">เกรดของคุณไม่ตรงตามเกณฑ์ของปีประเมินหลัก (ต้องเป็นเกรด A หรือมีคะแนนอย่างน้อย 81 คะแนน)</span>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-start gap-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 p-4 rounded-xl text-xs">
                  <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold block">ไม่พบข้อมูลเกรดของปี {settings.targetYear ? parseInt(settings.targetYear) - 1 : '-'}</span>
                    <span className="text-[10px] text-rose-500/80 mt-1 block font-light">คุณยังไม่มีข้อมูลประวัติประเมินผลปีที่แล้ว หรือ แอดมินยังไม่ได้ลงประวัติเกรดให้แก่ศูนย์ของคุณในคลังประวัติ</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Self Assessment Questionnaire */}
          <div className="lg:col-span-2 space-y-6">
            {isEligible && isOpen ? (
              <div className="bg-slate-900 border border-slate-800/80 rounded-2xl overflow-hidden p-6 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
                  <div>
                    <h3 className="text-md font-bold text-white">แบบฟอร์มตรวจสอบประเมินตนเอง 16 ข้อ</h3>
                    <p className="text-[10px] text-slate-500 font-light mt-0.5">กรุณาให้คะแนน แนบข้อความอธิบายความสำเร็จ และอัปโหลดไฟล์หลักฐานประจักษ์</p>
                  </div>
                  
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 font-light block">สถานะ:</span>
                    <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded ${assessmentStatus === 'Submitted' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'}`}>
                      {assessmentStatus === 'Submitted' ? 'ส่งแบบประเมินแล้ว' : 'แบบร่าง (Draft)'}
                    </span>
                  </div>
                </div>

                {/* Criteria Groups */}
                <div className="space-y-4">
                  {CRITERIA_GROUPS.map((group, groupIdx) => {
                    const isExpanded = !!expandedGroups[groupIdx];
                    return (
                      <div key={groupIdx} className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/20">
                        {/* Group Header Toggle */}
                        <button
                          type="button"
                          onClick={() => toggleGroup(groupIdx)}
                          className="w-full flex items-center justify-between px-4 py-3.5 bg-slate-950/40 text-slate-200 font-semibold text-xs border-b border-slate-800/60"
                        >
                          <span>{group.title}</span>
                          {isExpanded ? <ChevronUp className="h-4 w-4 text-slate-500" /> : <ChevronDown className="h-4 w-4 text-slate-500" />}
                        </button>

                        {/* Group Items */}
                        {isExpanded && (
                          <div className="p-4 space-y-6 divide-y divide-slate-800/60">
                            {group.items.map((item, itemIdx) => {
                              const key = item.key;
                              const value = criteriaData[key] || { score: 1, desc: '', file_url: '' };
                              const isUploading = uploadingKey === key;
                              
                              return (
                                <div key={key} className={`space-y-4 ${itemIdx > 0 ? 'pt-6' : ''}`}>
                                  <div>
                                    <h4 className="text-xs font-semibold text-slate-200">{item.label}</h4>
                                  </div>

                                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
                                    <div className="md:col-span-1 space-y-1">
                                      <label className="text-[10px] text-slate-500 font-medium">ระดับคะแนนประเมิน (1-5)</label>
                                      <select
                                        disabled={assessmentStatus === 'Submitted'}
                                        value={value.score}
                                        onChange={(e) => handleScoreChange(key, parseInt(e.target.value))}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-white focus:outline-none focus:border-indigo-500 text-xs cursor-pointer"
                                      >
                                        <option value={1}>1 - เริ่มต้นแผนงาน</option>
                                        <option value={2}>2 - มีแนวปฏิบัติ</option>
                                        <option value={3}>3 - ดำเนินงานสม่ำเสมอ</option>
                                        <option value={4}>4 - มีผลลัพธ์ประจักษ์</option>
                                        <option value={5}>5 - ต้นแบบและขยายผล</option>
                                      </select>
                                    </div>

                                    <div className="md:col-span-3 space-y-1">
                                      <label className="text-[10px] text-slate-500 font-medium">สรุปผลงาน/อธิบายวิธีการดำเนินงาน</label>
                                      <input
                                        disabled={assessmentStatus === 'Submitted'}
                                        type="text"
                                        placeholder="ระบุข้อความอธิบายการดำเนินงานคร่าวๆ ประกอบระดับคะแนน"
                                        value={value.desc}
                                        onChange={(e) => handleDescChange(key, e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-white placeholder-slate-700 focus:outline-none focus:border-indigo-500 text-xs"
                                      />
                                    </div>
                                  </div>

                                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-950/60 p-3 rounded-xl border border-slate-800/40">
                                    <div className="text-[10px] text-slate-400">
                                      {value.file_url ? (
                                        <a href={value.file_url} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline inline-flex items-center gap-1.5">
                                          <Download className="h-3 w-3" />
                                          <span>ดาวน์โหลดหลักฐานแนบ</span>
                                        </a>
                                      ) : (
                                        <span className="text-slate-600">ยังไม่มีหลักฐานแนบ</span>
                                      )}
                                    </div>

                                    {assessmentStatus !== 'Submitted' && (
                                      <div>
                                        <input
                                          type="file"
                                          id={`file-${key}`}
                                          className="hidden"
                                          onChange={(e) => handleFileUpload(key, e)}
                                          disabled={isUploading}
                                        />
                                        <label
                                          htmlFor={`file-${key}`}
                                          className="cursor-pointer inline-flex items-center gap-1.5 bg-slate-900 border border-slate-800 text-[10px] text-slate-300 font-semibold px-2.5 py-1.5 rounded-lg hover:text-white transition-all hover:bg-slate-800"
                                        >
                                          {isUploading ? (
                                            <>
                                              <Loader2 className="animate-spin h-3 w-3" />
                                              <span>กำลังอัปโหลด...</span>
                                            </>
                                          ) : (
                                            <>
                                              <Upload className="h-3.5 w-3.5" />
                                              <span>อัปโหลดหลักฐาน</span>
                                            </>
                                          )}
                                        </label>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Score Summary & Submit Actions */}
                <div className="p-6 bg-slate-950/60 border border-slate-800 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div>
                    <span className="text-xs text-slate-400">คะแนนประเมินตนเองสะสม:</span>
                    <h3 className="text-xl font-bold text-white mt-1">
                      {totalScore} <span className="text-xs text-slate-500 font-normal">/ 80 คะแนนเต็ม</span>
                    </h3>
                  </div>

                  {assessmentStatus !== 'Submitted' && (
                    <div className="flex gap-3 w-full sm:w-auto">
                      <button
                        onClick={() => handleSaveAssessment(false)}
                        className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 font-semibold rounded-xl text-xs transition-colors cursor-pointer"
                      >
                        <Save className="h-4 w-4" />
                        <span>บันทึกร่าง</span>
                      </button>
                      <button
                        onClick={() => {
                          Swal.fire({
                            title: 'ยืนยันการส่งแบบประเมินตนเอง?',
                            text: 'เมื่อกดส่งแล้ว คุณจะไม่สามารถกลับมาแก้ไขคะแนนได้อีก ข้อมูลจะถูกจัดส่งไปยังแอดมินเพื่อการตัดสิน',
                            icon: 'info',
                            showCancelButton: true,
                            confirmButtonColor: '#4f46e5',
                            cancelButtonColor: '#475569',
                            confirmButtonText: 'ตกลง, ยืนยันส่ง',
                            cancelButtonText: 'กลับไปแก้ไข'
                          }).then((result) => {
                            if (result.isConfirmed) {
                              handleSaveAssessment(true);
                            }
                          });
                        }}
                        className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer shadow-lg shadow-indigo-600/15"
                      >
                        <Send className="h-4 w-4" />
                        <span>ส่งแบบประเมิน</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-slate-900 border border-slate-800/80 p-8 rounded-2xl flex flex-col items-center justify-center text-center">
                <AlertTriangle className="h-12 w-12 text-rose-500 mb-4 animate-bounce" />
                <h3 className="text-md font-bold text-white">ไม่เปิดให้ดำเนินการประเมินตนเอง</h3>
                <p className="text-xs text-slate-400 mt-2 max-w-sm font-light">
                  คุณไม่มีสิทธิ์ในการยื่นประเมินตนเองหรือระบบอยู่นอกเวลาการเปีดรับประเมินประกวดศูนย์ต้นแบบในปี พ.ศ. {settings.targetYear} นี้
                </p>
              </div>
            )}
          </div>
        </div>
      ) : activeTab === 'admin_settings' ? (
        <div className="bg-slate-900 border border-slate-800/80 p-6 rounded-2xl max-w-xl">
          <h3 className="text-sm font-semibold text-white mb-6 flex items-center gap-2">
            <Settings className="h-4.5 w-4.5 text-indigo-400" />
            <span>ตั้งค่าช่วงประเมินและปีประเมินหลัก</span>
          </h3>

          <form onSubmit={handleSaveSettings} className="space-y-5 text-xs text-slate-300">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-slate-400 font-medium">ปีประเมินเป้าหมาย (พ.ศ.)</label>
                <input
                  type="text"
                  required
                  value={settings.targetYear}
                  onChange={(e) => setSettings(prev => ({ ...prev, targetYear: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-white focus:outline-none focus:border-indigo-500 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-slate-400 font-medium">ลิงก์คู่มือ/ระเบียบการประเมิน (PDF)</label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={settings.regulationLink}
                  onChange={(e) => setSettings(prev => ({ ...prev, regulationLink: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-white focus:outline-none focus:border-indigo-500 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-slate-400 font-medium">วันที่เปิดรับสมัคร</label>
                <input
                  type="date"
                  required
                  value={settings.startDate}
                  onChange={(e) => setSettings(prev => ({ ...prev, startDate: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-white focus:outline-none focus:border-indigo-500 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-slate-400 font-medium">วันที่ปิดระบบ</label>
                <input
                  type="date"
                  required
                  value={settings.endDate}
                  onChange={(e) => setSettings(prev => ({ ...prev, endDate: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-white focus:outline-none focus:border-indigo-500 text-xs"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-slate-400 font-medium">ข้อความต้อนรับระบบประเมิน</label>
              <textarea
                rows={3}
                required
                value={settings.welcomeMessage}
                onChange={(e) => setSettings(prev => ({ ...prev, welcomeMessage: e.target.value }))}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-white focus:outline-none focus:border-indigo-500 text-xs"
              />
            </div>

            <button
              type="submit"
              className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-xs cursor-pointer transition-colors shadow-lg shadow-indigo-600/10"
            >
              <Save className="h-4 w-4" />
              <span>บันทึกการตั้งค่า</span>
            </button>
          </form>
        </div>
      ) : activeTab === 'admin_grades' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Form to Add Grades */}
          <div className="lg:col-span-1 bg-slate-900 border border-slate-800/80 p-6 rounded-2xl h-fit">
            <h3 className="text-sm font-semibold text-white mb-6 flex items-center gap-2">
              <UserCheck className="h-4.5 w-4.5 text-indigo-400" />
              <span>บันทึกประวัติเกรดการประเมินศูนย์</span>
            </h3>

            <form onSubmit={handleSaveGrade} className="space-y-4 text-xs text-slate-300">
              <div className="space-y-1.5">
                <label className="text-slate-400 font-medium">เลือกศูนย์เป้าหมาย</label>
                <select
                  value={selectedCenterId}
                  onChange={(e) => setSelectedCenterId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-white focus:outline-none focus:border-indigo-500 text-xs cursor-pointer"
                >
                  <option value="">-- กรุณาเลือกศูนย์ --</option>
                  {userOptions.map(u => (
                    <option key={u.id} value={u.id}>{u.name} (จ.{u.province})</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-slate-400 font-medium">ปีประเมินหลัก (พ.ศ.)</label>
                <input
                  type="text"
                  required
                  placeholder="เช่น 2568"
                  value={centerGradeInput.year}
                  onChange={(e) => setCenterGradeInput(prev => ({ ...prev, year: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-white focus:outline-none focus:border-indigo-500 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-slate-400 font-medium">เกรดที่ได้</label>
                  <select
                    value={centerGradeInput.grade}
                    onChange={(e) => setCenterGradeInput(prev => ({ ...prev, grade: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-white focus:outline-none focus:border-indigo-500 text-xs cursor-pointer"
                  >
                    <option value="A">Grade A (ระดับสูงสุด)</option>
                    <option value="B">Grade B (ระดับดี)</option>
                    <option value="C">Grade C (ระดับพอใช้)</option>
                    <option value="D">Grade D (ผ่านระดับเริ่มต้น)</option>
                    <option value="F">Grade F (ไม่ผ่านเกณฑ์)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-slate-400 font-medium">คะแนนดิบ (0-100)</label>
                  <input
                    type="number"
                    required
                    min={0}
                    max={100}
                    value={centerGradeInput.score}
                    onChange={(e) => setCenterGradeInput(prev => ({ ...prev, score: parseInt(e.target.value) || 0 }))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-white focus:outline-none focus:border-indigo-500 text-xs"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-xs cursor-pointer transition-colors shadow-lg shadow-indigo-600/10"
              >
                <Save className="h-4 w-4" />
                <span>บันทึกเกรด</span>
              </button>
            </form>
          </div>

          {/* Grades list table */}
          <div className="lg:col-span-2 bg-slate-900 border border-slate-800/80 rounded-2xl overflow-hidden p-6 space-y-4">
            <h3 className="text-sm font-semibold text-white">ตารางประวัติผลประเมินย้อนหลังทั้งหมด</h3>
            
            <div className="overflow-x-auto text-xs">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-950 border-b border-slate-800 text-slate-400 font-medium">
                    <th className="p-3">จังหวัด</th>
                    <th className="p-3">ศูนย์ไกล่เกลี่ยฯ</th>
                    <th className="p-3 text-center">ปี พ.ศ.</th>
                    <th className="p-3 text-center">เกรด</th>
                    <th className="p-3 text-center">คะแนนดิบ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {gradesList.map((g) => (
                    <tr key={g.id} className="hover:bg-slate-800/20">
                      <td className="p-3 font-semibold text-indigo-400">{g.profiles?.province || '-'}</td>
                      <td className="p-3 truncate max-w-[200px]">{g.profiles?.name || '-'}</td>
                      <td className="p-3 text-center">{g.year}</td>
                      <td className="p-3 text-center"><span className="px-2 py-0.5 rounded font-bold text-white bg-slate-800">{g.grade}</span></td>
                      <td className="p-3 text-center">{g.score}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* admin_reviews: Tapping submitted assessments */
        <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-6 space-y-6">
          <h3 className="text-sm font-semibold text-white">รายการประเมินตนเองที่ศูนย์ไกล่เกลี่ยส่งเข้ามา</h3>

          <div className="overflow-x-auto text-xs">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-950 border-b border-slate-800 text-slate-400 font-medium">
                  <th className="p-3">จังหวัด</th>
                  <th className="p-3">ศูนย์ไกล่เกลี่ยฯ</th>
                  <th className="p-3 text-center">ปีประกวด</th>
                  <th className="p-3 text-center">คะแนนประเมินตนเอง</th>
                  <th className="p-3 text-center">สถานะ</th>
                  <th className="p-3 text-right">ดำเนินการตรวจ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {allAssessments.length > 0 ? (
                  allAssessments.map((a) => (
                    <tr key={a.id} className="hover:bg-slate-800/20">
                      <td className="p-3 font-semibold text-indigo-400">{a.profiles?.province}</td>
                      <td className="p-3">{a.profiles?.name}</td>
                      <td className="p-3 text-center">{a.year}</td>
                      <td className="p-3 text-center font-bold text-white">{a.total_score} คะแนน</td>
                      <td className="p-3 text-center">
                        <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${a.status === 'Submitted' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'}`}>
                          {a.status === 'Submitted' ? 'ส่งแล้ว' : 'แบบร่าง'}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => {
                            setSelectedReview(a);
                            setReviewModalOpen(true);
                          }}
                          className="px-3 py-1.5 bg-slate-800 hover:bg-indigo-600 text-slate-300 hover:text-white rounded-lg transition-all cursor-pointer font-semibold"
                        >
                          ตรวจดูคะแนน
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-slate-500 font-light">ยังไม่มีศูนย์ไกล่เกลี่ยฯ ใดส่งแบบประเมินเข้าระบบ</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Details Modal review */}
          {reviewModalOpen && selectedReview && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
              <div className="w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
                <div className="flex h-20 items-center justify-between px-6 border-b border-slate-800 bg-slate-950/20 shrink-0">
                  <div>
                    <h3 className="font-bold text-white text-sm">การประเมินตนเอง: {selectedReview.profiles?.name}</h3>
                    <p className="text-[10px] text-slate-400 mt-1">จังหวัด: {selectedReview.profiles?.province} | ปีประกวด: {selectedReview.year}</p>
                  </div>
                  <button onClick={() => setReviewModalOpen(false)} className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer">
                    ปิดหน้าต่าง
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs text-slate-300">
                  <div className="bg-slate-950/40 border border-slate-800 p-4 rounded-xl flex justify-between items-center">
                    <span className="text-slate-400">คะแนนรวมสะสมประเมินตนเอง:</span>
                    <span className="text-md font-extrabold text-indigo-400">{selectedReview.total_score} / 80 คะแนน</span>
                  </div>

                  <div className="space-y-4">
                    {CRITERIA_GROUPS.map((group, gIdx) => (
                      <div key={gIdx} className="space-y-3">
                        <h4 className="font-bold text-slate-400 border-b border-slate-800 pb-2">{group.title}</h4>
                        
                        <div className="space-y-4 pl-3">
                          {group.items.map((item) => {
                            const val = selectedReview.criteria?.[item.key] || { score: 0, desc: '', file_url: '' };
                            return (
                              <div key={item.key} className="space-y-2 border-l-2 border-slate-800 pl-4 py-1">
                                <div className="flex justify-between font-semibold">
                                  <span className="text-slate-200">{item.label}</span>
                                  <span className="text-indigo-400 bg-slate-950 px-2 py-0.5 rounded">คะแนน: {val.score}</span>
                                </div>
                                <p className="text-slate-400 font-light italic leading-5">คำอธิบาย: {val.desc || '(ไม่มีคำอธิบายเพิ่มเติม)'}</p>
                                {val.file_url ? (
                                  <a href={val.file_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-indigo-400 hover:underline">
                                    <Download className="h-3 w-3" />
                                    <span>หลักฐานเชิงประจักษ์แนบ</span>
                                  </a>
                                ) : (
                                  <span className="text-slate-600 italic">ไม่มีไฟล์หลักฐานแนบ</span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
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
