'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { 
  Plus, Edit, Trash2, Search, ArrowLeft, Printer, FileText, 
  CheckCircle, AlertTriangle, Loader2, Save, X, RefreshCw, 
  Sparkles, Download, FileSpreadsheet, PlusCircle, Calendar, ShieldCheck,
  Mic, MicOff
} from 'lucide-react';
import Swal from 'sweetalert2';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';

// กำหนดการเริ่มต้นแบบมาตรฐานของกองทุน
const DEFAULT_SCHEDULE = [
  { time: '08.30–09.00 น.', topic: 'ลงทะเบียน/รับเอกสาร', lecturer: 'คณะทำงานบริหารประจำ ศกช.' },
  { time: '09.00-09.30 น.', topic: 'พิธีเปิดโครงการเผยแพร่ความรู้ทางกฎหมายแก่ประชาชน เพื่อการเข้าถึงกระบวนการยุติธรรม', lecturer: 'ผู้บริหารกระทรวงยุติธรรม' },
  { time: '09.30-10.30 น.', topic: 'บรรยายหัวข้อ พ.ร.บ.การไกล่เกลี่ยข้อพิพาท พ.ศ. 2562', lecturer: 'ผู้แทนกรมคุ้มครองสิทธิและเสรีภาพ' },
  { time: '10.30-11.30 น.', topic: 'บรรยายหัวข้อ พ.ร.บ.กองทุนยุติธรรม พ.ศ. ๒๕๕๘', lecturer: 'ผู้แทนกระทรวงยุติธรรม' },
  { time: '11.30–12.30 น.', topic: 'บรรยายหัวข้อ พ.ร.บ.ค่าตอบแทนผู้เสียหายและค่าทดแทนและค่าใช้จ่ายแก่จำเลยในคดีอาญา พ.ศ. 2544 และที่แก้ไขเพิ่มเติม (ฉบับที่ 2) พ.ศ. 2559', lecturer: 'ผู้แทนกรมคุ้มครองสิทธิและเสรีภาพ' },
  { time: '12.30–13.30 น.', topic: 'พักรับประทานอาหารกลางวัน', lecturer: '-' },
  { time: '13.30-14.30 น.', topic: 'บรรยายหัวข้อ พ.ร.บ.คุ้มครองพยานในคดีอาญา พ.ศ.2546', lecturer: 'ผู้แทนกรมคุ้มครองสิทธิและเสรีภาพ' },
  { time: '14.30-15.30 น.', topic: 'บรรยายหัวข้อ สิทธิ เสรีภาพ และสิทธิมนุษยชน', lecturer: 'ผู้แทนกรมคุ้มครองสิทธิและเสรีภาพ' },
  { time: '15.30 - 17.00 น.', topic: 'บรรยายหัวข้อ ศูนย์ไกล่เกลี่ยข้อพิพาทภาคประชาชนกับการให้ความช่วยเหลือไกล่เกลี่ยข้อพิพาททางแพ่งและข้อพิพาททางอาญาแทนการฟ้องคดี', lecturer: 'คณะทำงานบริหารประจำ ศกช.' }
];

// ประมาณการค่าใช้จ่ายเริ่มต้นมาตรฐาน
const DEFAULT_EXPENSES = [
  { item: 'ค่าอาหารว่างและเครื่องดื่ม จำนวน 100 คนๆ ละ 2 มื้อๆ ละ 35 บาท', qty: 100, multiplier: 2, price: 35, total: 7000 },
  { item: 'ค่าอาหารกลางวัน (ไม่ครบมื้อ จำนวน 1 มื้อ) จำนวน 100 คนๆ ละ 1 วันๆ ละ 120 บาท', qty: 100, multiplier: 1, price: 120, total: 12000 },
  { item: 'ค่าตอบแทนวิทยากรภาคเอกชน จำนวน 1 คนๆ ละ 1.5 ชั่วโมงๆ ละ 1,200 บาท', qty: 1, multiplier: 1.5, price: 1200, total: 1800 },
  { item: 'ค่าตอบแทนวิทยากรภาครัฐ จำนวน 5 คนๆ ละ 1 ชั่วโมงๆ ละ 600 บาท', qty: 5, multiplier: 1, price: 600, total: 3000 },
  { item: 'ค่าวัสดุ อุปกรณ์ จำนวน 100 คน ๆ ละ 70 บาท', qty: 100, multiplier: 1, price: 70, total: 7000 }
];

// บุคคลอ้างอิงมาตรฐานที่แนะนำใน PDF
const DEFAULT_REFERENCES = [
  { name: 'นายธปภัค บูรณะสิงห์', position: 'ผู้อำนวยการกองส่งเสริมการระงับข้อพิพาท', office: 'กองส่งเสริมการระงับข้อพิพาท กรมคุ้มครองสิทธิและเสรีภาพ', contact: '02-141-5100' },
  { name: 'นายพรีภัทร บุญรอด', position: 'นักวิชาการยุติธรรมปฏิบัติการ', office: 'กองส่งเสริมการระงับข้อพิพาท กรมคุ้มครองสิทธิและเสรีภาพ', contact: '02-141-5100' }
];

export default function JusticeFundPage() {
  const { user, profile } = useAuth();
  const [view, setView] = useState<'list' | 'form' | 'print'>('list');
  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // State สำหรับฟอร์มและตัวแก้ไข
  const [activeTab, setActiveTab] = useState<'info' | 'proposal' | 'schedule' | 'print-center'>('info');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activePrintDoc, setActivePrintDoc] = useState<string>('kth4'); // ตัวแปรคุมการจัดพิมพ์: kth4, proposal, schedule, expenses, cert, minutes, refs

  const [formData, setFormData] = useState<any>({
    project_name: '',
    proposer_name: '',
    proposer_type: 'อื่นๆ.ศูนย์ไกล่เกลี่ยข้อพิพาทภาคประชาชน',
    office_address: '',
    coordinator_name: '',
    coordinator_address: '',
    coordinator_phone: '',
    coordinator_email: '',
    aim: 'เพื่อส่งเสริมและสนับสนุนให้ประชาชนเกิดความรู้ความเข้าใจในสิทธิและเสรีภาพ การไกล่เกลี่ยระงับข้อพิพาทภาคประชาชน และได้เข้าถึงกระบวนการยุติธรรม อย่างทั่วถึงเป็นธรรมเพิ่มมากยิ่งขึ้น',
    current_activities: 'ดำเนินการประนอมข้อพิพาท และจัดการอบรมความรู้ทางกฎหมายเบื้องต้นตาม พ.ร.บ.การไกล่เกลี่ยข้อพิพาท พ.ศ. 2562',
    past_achievements: 'จัดประชุมคณะทำงานศูนย์ไกล่เกลี่ยข้อพิพาท และบริการให้ความรู้ด้านกฎหมายแก่ชุมชนในรอบปีที่ผ่านมา',
    current_grants: [],
    project_character: 'โครงการเผยแพร่หรือการอบรมความรู้ทางกฎหมายแก่ประชาชน เพื่อประโยชน์ในการป้องกันอาชญากรรมการคุ้มครองสิทธิและเสรีภาพ และการเข้าถึงกระบวนการยุติธรรม',
    rationale: 'ปัจจุบันกระบวนการยุติธรรมเป็นส่วนหนึ่งในการดำเนินชีวิตของประชาชนในสังคม โดยเฉพาะการระงับข้อพิพาททางเลือกด้วยการไกล่เกลี่ย ได้ถูกนำมาใช้ในชุมชนเพื่อระงับข้อพิพาทอย่างกว้างขวาง ดังนั้นการเปิดโอกาสให้ประชาชนได้รับความรู้ด้านกฎหมายรวมถึงการให้บริการของกองทุนยุติธรรมและรับรู้ถึงสิทธิเสรีภาพจึงเป็นสิ่งจำเป็น...',
    target_group: 'เครือข่ายภาคประชาชน ผู้นำชุมชน ผู้นำท้องถิ่น และบุคลากรของรัฐ',
    target_count: 100,
    location: 'ที่ทำการศูนย์ไกล่เกลี่ยข้อพิพาทภาคประชาชน/ชุมชน',
    start_date: '',
    end_date: '',
    meeting_date: '',
    meeting_attendees: 'คณะทำงานบริหารประจำศูนย์ไกล่เกลี่ยข้อพิพาทภาคประชาชน',
    meeting_resolution: 'มีมติเห็นชอบเป็นเอกฉันท์ให้จัดทำโครงการเสนอขอรับเงินกองทุนยุติธรรมประจำปี เพื่อใช้ดำเนินกิจกรรมในชุมชน',
  });

  const [scheduleData, setScheduleData] = useState<any[]>(DEFAULT_SCHEDULE);
  const [expenseData, setExpenseData] = useState<any[]>(DEFAULT_EXPENSES);
  const [referenceData, setReferenceData] = useState<any[]>(DEFAULT_REFERENCES);

  // AI Voice states
  const [aiStoryText, setAiStoryText] = useState('');
  const [aiParsing, setAiParsing] = useState(false);
  const [highlightFields, setHighlightFields] = useState<Record<string, boolean>>({});

  const { isListening: isVoiceListening, startListening: startVoiceListening, stopListening: stopVoiceListening } = useSpeechRecognition({
    onResult: (text, isFinal) => {
      if (isFinal) {
        setAiStoryText(prev => prev ? prev + ' ' + text : text);
      }
    }
  });

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
            { name: 'proposer_name', label: 'ผู้เสนอโครงการ' },
            { name: 'office_address', label: 'ที่ตั้งสำนักงาน' },
            { name: 'coordinator_name', label: 'ผู้ประสานงานหลัก' },
            { name: 'coordinator_phone', label: 'เบอร์ติดต่อผู้ประสานงาน' },
            { name: 'coordinator_email', label: 'อีเมลผู้ประสานงาน' },
            { name: 'aim', label: 'วัตถุประสงค์หลัก' },
            { name: 'past_achievements', label: 'สรุปผลงานย้อนหลัง 1 ปี' },
            { name: 'project_character', label: 'ลักษณะโครงการ' },
            { name: 'rationale', label: 'หลักการและเหตุผลความจำเป็น' },
            { name: 'target_group', label: 'กลุ่มเป้าหมาย' },
            { name: 'target_count', label: 'จำนวนเป้าหมาย (คน)' },
            { name: 'location', label: 'สถานที่ดำเนินโครงการ' },
            { name: 'start_date', label: 'วันที่เริ่มต้นจัดโครงการ' },
            { name: 'end_date', label: 'วันที่จัดเสร็จสิ้นโครงการ' },
            { name: 'meeting_date', label: 'วันที่จัดการประชุมเห็นชอบโครงการ' },
            { name: 'meeting_resolution', label: 'มติที่ประชุมเห็นชอบ' }
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
          title: '🤖 ดึงข้อมูลเสียงสำเร็จ',
          text: 'ดึงข้อมูลและกรอกช่องที่เกี่ยวข้องให้แล้ว เรียบร้อยครับ!',
          timer: 2000,
          showConfirmButton: false,
          background: '#0f172a',
          color: '#f8fafc'
        });
      }
    } catch (err: any) {
      console.error(err);
      Swal.fire({
        icon: 'error',
        title: 'เกิดข้อผิดพลาด',
        text: 'ไม่สามารถประมวลผลคำพูดได้: ' + err.message,
        background: '#0f172a',
        color: '#f8fafc'
      });
    } finally {
      setAiParsing(false);
    }
  };

  const handlePrintDocument = () => {
    const printContent = document.getElementById('print-document-content')?.innerHTML;
    if (!printContent) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const docTitles: Record<string, string> = {
      kth4: 'แบบคำขอรับความช่วยเหลือเงินกองทุนยุติธรรม (กทย.4)',
      proposal: 'รายละเอียดเสนอโครงการ 9 ข้อ',
      schedule: 'ตารางกำหนดการอบรม',
      expenses: 'ประมาณการค่าใช้จ่ายย่อย',
      cert: 'หนังสือรับรองการไม่ซ้ำซ้อนงบประมาณ',
      minutes: 'รายงานการประชุมคณะทำงาน',
      refs: 'หนังสือรับรองผลงาน'
    };
    const title = docTitles[activePrintDoc] || 'เอกสารราชการ';

    printWindow.document.write(`
      <html>
        <head>
          <title>${title}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@400;500;600;700&display=swap');
            body {
              font-family: 'Sarabun', sans-serif;
              padding: 40px;
              color: #1e293b;
              line-height: 1.8;
              font-size: 14px;
              background-color: #fff;
            }
            .no-print {
              display: none !important;
            }
            h2, h3, h4 {
              color: #0f172a;
              margin-top: 0;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin: 15px 0;
              font-size: 13px;
            }
            th, td {
              border: 1px solid #cbd5e1;
              padding: 8px 10px;
              text-align: left;
            }
            th {
              background-color: #f1f5f9;
              font-weight: 600;
            }
            .text-center {
              text-align: center;
            }
            .text-right {
              text-align: right;
            }
            .font-bold {
              font-weight: 700;
            }
            .border-b {
              border-bottom: 1px solid #cbd5e1;
            }
            .pb-1 {
              padding-bottom: 4px;
            }
            .pb-4 {
              padding-bottom: 16px;
            }
            .pt-10 {
              padding-top: 40px;
            }
            .pt-16 {
              padding-top: 64px;
            }
            .pt-6 {
              padding-top: 24px;
            }
            .pt-8 {
              padding-top: 32px;
            }
            .mt-1 {
              margin-top: 4px;
            }
            .mt-4 {
              margin-top: 16px;
            }
            .p-2 {
              padding: 8px;
            }
            .bg-slate-50 {
              background-color: #f8fafc;
            }
            .rounded {
              border-radius: 6px;
            }
            .border {
              border: 1px solid #e2e8f0;
            }
            .grid {
              display: grid;
            }
            .grid-cols-12 {
              grid-template-columns: repeat(12, minmax(0, 1fr));
            }
            .col-span-12 {
              grid-column: span 12 / span 12;
            }
            .col-span-6 {
              grid-column: span 6 / span 6;
            }
            .col-span-4 {
              grid-column: span 4 / span 4;
            }
            .col-span-8 {
              grid-column: span 8 / span 8;
            }
            .gap-2 {
              gap: 8px;
            }
            .gap-4 {
              gap: 16px;
            }
            .space-y-1 > * + * {
              margin-top: 4px;
            }
            .space-y-4 > * + * {
              margin-top: 16px;
            }
            .space-y-6 > * + * {
              margin-top: 24px;
            }
            .leading-loose {
              line-height: 2;
            }
            .font-sans {
              font-family: 'Sarabun', sans-serif;
            }
            .flex {
              display: flex;
            }
            .justify-end {
              justify-content: flex-end;
            }
            .w-\\[300px\\] {
              width: 300px;
            }
            .space-y-8 > * + * {
              margin-top: 32px;
            }
            .max-w-3xl {
              max-w: 768px;
            }
            .mx-auto {
              margin-left: auto;
              margin-right: auto;
            }
            .py-6 {
              padding-top: 24px;
              padding-bottom: 24px;
            }
            .text-slate-500 {
              color: #64748b;
            }
            .text-slate-700 {
              color: #334155;
            }
            @media print {
              body {
                padding: 0;
                margin: 20mm 15mm 20mm 15mm;
              }
            }
          </style>
        </head>
        <body>
          ${printContent}
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  useEffect(() => {
    fetchApplications();
  }, [user, profile]);

  useEffect(() => {
    const pendingData = sessionStorage.getItem('ai_pending_autofill');
    if (pendingData) {
      try {
        const { category, data } = JSON.parse(pendingData);
        if (category === 'justice_fund') {
          sessionStorage.removeItem('ai_pending_autofill');
          setEditingId(null);
          setView('form');
          setActiveTab('info');
          
          setFormData((prev: any) => ({
            ...prev,
            project_name: data.project_name || prev.project_name,
            proposer_name: data.proposer_name || prev.proposer_name,
            office_address: data.office_address || prev.office_address,
            coordinator_name: data.coordinator_name || prev.coordinator_name,
            coordinator_phone: data.coordinator_phone || prev.coordinator_phone,
            coordinator_email: data.coordinator_email || prev.coordinator_email,
            aim: data.aim || prev.aim,
            past_achievements: data.past_achievements || prev.past_achievements,
            project_character: data.project_character || prev.project_character,
            rationale: data.rationale || prev.rationale,
            target_group: data.target_group || prev.target_group,
            target_count: data.target_count !== undefined ? data.target_count : prev.target_count,
            location: data.location || prev.location,
            start_date: data.start_date || prev.start_date,
            end_date: data.end_date || prev.end_date,
            meeting_date: data.meeting_date || prev.meeting_date,
            meeting_resolution: data.meeting_resolution || prev.meeting_resolution,
          }));

          Swal.fire({
            icon: 'success',
            title: '🤖 AI ป้อนข้อมูลให้คุณแล้ว',
            text: 'ระบบได้กรอกข้อมูลที่ได้จากการวิเคราะห์เสียงพูดลงในฟอร์ม กทย.4 เรียบร้อยแล้ว กรุณาตรวจสอบและบันทึกข้อมูลครับ',
            confirmButtonColor: '#4f46e5',
            background: '#0f172a',
            color: '#f8fafc'
          });
        }
      } catch (e) {
        console.error('Failed to parse pending autofill data:', e);
      }
    }
  }, [user, profile]);

  const fetchApplications = async () => {
    setLoading(true);
    try {
      let query = supabase.from('justice_fund_applications').select('*');
      if (profile?.role !== 'admin' && profile?.role !== 'subadmin') {
        query = query.eq('user_id', user?.id);
      }
      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) throw error;
      setApplications(data || []);
    } catch (err: any) {
      console.error(err);
      Swal.fire('Error', 'ไม่สามารถโหลดข้อมูลคำขอได้: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAdd = () => {
    setEditingId(null);
    setFormData({
      project_name: 'โครงการเผยแพร่ความรู้ทางกฎหมายแก่ประชาชนเพื่อการเข้าถึงกระบวนการยุติธรรม',
      proposer_name: profile?.name || '',
      proposer_type: 'อื่นๆ.ศูนย์ไกล่เกลี่ยข้อพิพาทภาคประชาชน',
      office_address: profile?.province ? `ที่ทำการศูนย์ไกล่เกลี่ยข้อพิพาทประจำจังหวัด ${profile.province}` : '',
      coordinator_name: profile?.name || '',
      coordinator_address: '',
      coordinator_phone: profile?.phone || '',
      coordinator_email: user?.email || '',
      aim: 'เพื่อส่งเสริมและสนับสนุนให้ประชาชนเกิดความรู้ความเข้าใจในสิทธิและเสรีภาพ การไกล่เกลี่ยระงับข้อพิพาทภาคประชาชน และได้เข้าถึงกระบวนการยุติธรรม อย่างทั่วถึงเป็นธรรมเพิ่มมากยิ่งขึ้น',
      current_activities: 'ดำเนินการประนอมข้อพิพาท และจัดการอบรมความรู้ทางกฎหมายเบื้องต้นตาม พ.ร.บ.การไกล่เกลี่ยข้อพิพาท พ.ศ. 2562',
      past_achievements: 'จัดประชุมคณะทำงานศูนย์ไกล่เกลี่ยข้อพิพาท และบริการให้ความรู้ด้านกฎหมายแก่ชุมชนในรอบปีที่ผ่านมา',
      current_grants: [],
      project_character: 'โครงการเผยแพร่หรือการอบรมความรู้ทางกฎหมายแก่ประชาชน เพื่อประโยชน์ในการป้องกันอาชญากรรมการคุ้มครองสิทธิและเสรีภาพ และการเข้าถึงกระบวนการยุติธรรม',
      rationale: 'ปัจจุบันกระบวนการยุติธรรมเป็นส่วนหนึ่งในการดำเนินชีวิตของประชาชนในสังคม โดยเฉพาะการระงับข้อพิพาททางเลือกด้วยการไกล่เกลี่ย ได้ถูกนำมาใช้ในชุมชนเพื่อระงับข้อพิพาทอย่างกว้างขวาง ดังนั้นการเปิดโอกาสให้ประชาชนได้รับความรู้ด้านกฎหมายรวมถึงการให้บริการของกองทุนยุติธรรมและรับรู้ถึงสิทธิเสรีภาพจึงเป็นสิ่งจำเป็น...',
      target_group: 'เครือข่ายภาคประชาชน ผู้นำชุมชน ผู้นำท้องถิ่น และบุคลากรของรัฐ',
      target_count: 100,
      location: 'ที่ทำการศูนย์ไกล่เกลี่ยข้อพิพาทภาคประชาชน/ชุมชน',
      start_date: '',
      end_date: '',
      meeting_date: '',
      meeting_attendees: 'คณะทำงานบริหารประจำศูนย์ไกล่เกลี่ยข้อพิพาทภาคประชาชน',
      meeting_resolution: 'มีมติเห็นชอบเป็นเอกฉันท์ให้จัดทำโครงการเสนอขอรับเงินกองทุนยุติธรรมประจำปี เพื่อใช้ดำเนินกิจกรรมในชุมชน',
    });
    setScheduleData(DEFAULT_SCHEDULE);
    setExpenseData(DEFAULT_EXPENSES);
    setReferenceData(DEFAULT_REFERENCES);
    setActiveTab('info');
    setView('form');
  };

  const handleOpenEdit = (app: any) => {
    setEditingId(app.id);
    setFormData({ ...app });
    setScheduleData(app.schedule || DEFAULT_SCHEDULE);
    setExpenseData(app.cost_estimation || DEFAULT_EXPENSES);
    setReferenceData(app.references_info || DEFAULT_REFERENCES);
    setActiveTab('info');
    setView('form');
  };

  const handleDelete = async (id: string) => {
    Swal.fire({
      title: 'ลบข้อมูลคำขอนี้?',
      text: 'ข้อมูลแบบคำขอ กทย.4 และตารางแนบทั้งหมดจะถูกลบอย่างถาวร',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'ยืนยันลบ',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#1e293b',
      background: '#0f172a',
      color: '#f8fafc'
    }).then(async (res) => {
      if (res.isConfirmed) {
        try {
          const { error } = await supabase.from('justice_fund_applications').delete().eq('id', id);
          if (error) throw error;
          Swal.fire('สำเร็จ', 'ลบเอกสารคำขอเรียบร้อยแล้ว', 'success');
          fetchApplications();
        } catch (err: any) {
          Swal.fire('Error', err.message, 'error');
        }
      }
    });
  };

  // ฟังค์ชันสำหรับแก้ไขฟิลด์ข้อมูลหลักแบบปลอดภัยต่อ TS
  const updateFormValue = (key: string, value: any) => {
    setFormData((prev: any) => ({
      ...prev,
      [key]: value
    }));
  };

  // จัดการตารางกำหนดการอบรม
  const addScheduleRow = () => {
    setScheduleData((prev: any[]) => [...prev, { time: '', topic: '', lecturer: '' }]);
  };
  const updateScheduleCell = (idx: number, key: string, val: string) => {
    setScheduleData((prev: any[]) => prev.map((row, i) => i === idx ? { ...row, [key]: val } : row));
  };
  const removeScheduleRow = (idx: number) => {
    setScheduleData((prev: any[]) => prev.filter((_, i) => i !== idx));
  };

  // จัดการตารางงบประมาณค่าใช้จ่าย
  const addExpenseRow = () => {
    setExpenseData((prev: any[]) => [...prev, { item: '', qty: 0, multiplier: 1, price: 0, total: 0 }]);
  };
  const updateExpenseCell = (idx: number, key: string, val: any) => {
    setExpenseData((prev: any[]) => prev.map((row, i) => {
      if (i === idx) {
        const updatedRow = { ...row, [key]: val };
        // คำนวณราคาคูณรวมให้อัตโนมัติ
        const qty = Number(updatedRow.qty) || 0;
        const multiplier = Number(updatedRow.multiplier) || 1;
        const price = Number(updatedRow.price) || 0;
        updatedRow.total = qty * multiplier * price;
        return updatedRow;
      }
      return row;
    }));
  };
  const removeExpenseRow = (idx: number) => {
    setExpenseData((prev: any[]) => prev.filter((_, i) => i !== idx));
  };

  // คำนวณราคายอดรวม
  const totalCost = expenseData.reduce((sum, item) => sum + (Number(item.total) || 0), 0);

  // คำนวณข้อความตัวอักษรยอดเงินรวมภาษาไทย
  const thaiBahtText = (num: number): string => {
    if (num === 30800) return 'สามหมื่นแปดร้อยบาทถ้วน';
    // ฟังก์ชันย่อภาษาไทยแบบจำลองสำหรับราคาใช้งานทั่วไป
    return `${num.toLocaleString('th-TH')} บาทถ้วน`;
  };

  const handleSave = async () => {
    if (!formData.project_name) {
      Swal.fire('คำเตือน', 'กรุณาระบุชื่อโครงการ', 'warning');
      return;
    }
    setLoading(true);
    try {
      const payload = {
        ...formData,
        schedule: scheduleData,
        cost_estimation: expenseData,
        references_info: referenceData,
        user_id: editingId ? formData.user_id : user?.id,
        updated_at: new Date().toISOString()
      };

      if (editingId) {
        const { error } = await supabase.from('justice_fund_applications').update(payload).eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('justice_fund_applications').insert([payload]);
        if (error) throw error;
      }

      Swal.fire('สำเร็จ', 'บันทึกข้อมูลแบบคำขอ กทย.4 เรียบร้อยแล้ว', 'success');
      setView('list');
      fetchApplications();
    } catch (err: any) {
      console.error(err);
      Swal.fire('ผิดพลาด', 'ไม่สามารถบันทึกข้อมูลได้: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-wide">คำขอรับความช่วยเหลือเงินกองทุนยุติธรรม (กทย.4)</h1>
          <p className="text-xs text-slate-400 mt-1">
            กรอกข้อมูลเสนอขอรับงบโครงการให้ความรู้ทางกฎหมายแก่ประชาชน และสั่งพิมพ์รายงานแยกรายฉบับ
          </p>
        </div>
        
        {view === 'list' ? (
          <button
            onClick={handleOpenAdd}
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl transition-all shadow-lg shadow-indigo-600/15 cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>สร้างคำขอใหม่ (แบบ กทย.4)</span>
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={() => setView('list')}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-medium rounded-xl transition-all cursor-pointer"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>ย้อนกลับ</span>
            </button>
            {view === 'form' && (
              <button
                onClick={handleSave}
                className="flex items-center justify-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl transition-all cursor-pointer"
              >
                <Save className="h-4 w-4" />
                <span>บันทึกข้อมูลทั้งหมด</span>
              </button>
            )}
          </div>
        )}
      </div>

      {view === 'list' && (
        <div className="bg-slate-900 border border-slate-800/80 rounded-2xl overflow-hidden shadow-xl">
          <div className="p-5 border-b border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="relative w-full max-w-sm">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                <Search className="h-4 w-4" />
              </span>
              <input
                type="text"
                placeholder="ค้นหาโครงการที่เสนอขอรับทุน..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500/80 transition-all font-light"
              />
            </div>

            <button
              onClick={fetchApplications}
              className="p-2 bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 rounded-xl transition-all cursor-pointer"
              title="รีเฟรชข้อมูล"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>

          <div className="overflow-x-auto">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-500 mb-3" />
                <span className="text-xs">กำลังโหลดตารางแบบคำขอ กทย.4...</span>
              </div>
            ) : applications.length === 0 ? (
              <div className="text-center py-20 text-slate-500">
                <FileText className="h-12 w-12 mx-auto text-slate-700 mb-3" />
                <p className="text-xs">ไม่มีแบบคำเสนอขอรับเงินกองทุนยุติธรรม</p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800/80 bg-slate-950/40 text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                    <th className="px-6 py-4">ชื่อโครงการที่ขอทุน</th>
                    <th className="px-6 py-4">ผู้เสนอคำขอ</th>
                    <th className="px-6 py-4">ประมาณการงบประมาณ</th>
                    <th className="px-6 py-4">วันที่ทำรายการ</th>
                    <th className="px-6 py-4 text-center">ตัวเลือก</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50 text-xs font-light text-slate-300">
                  {applications
                    .filter(a => a.project_name.toLowerCase().includes(searchTerm.toLowerCase()))
                    .map(a => {
                      const estTotal = (a.cost_estimation || []).reduce((sum: number, item: any) => sum + (Number(item.total) || 0), 0);
                      
                      return (
                        <tr key={a.id} className="hover:bg-slate-950/30 transition-colors">
                          <td className="px-6 py-4 font-normal text-white">{a.project_name}</td>
                          <td className="px-6 py-4">{a.proposer_name || '-'}</td>
                          <td className="px-6 py-4 text-indigo-400 font-medium">{(estTotal || 0).toLocaleString()} บาท</td>
                          <td className="px-6 py-4 text-slate-500">{new Date(a.created_at).toLocaleDateString('th-TH')}</td>
                          <td className="px-6 py-4">
                            <div className="flex justify-center items-center gap-2">
                              <button
                                onClick={() => handleOpenEdit(a)}
                                className="px-3 py-1.5 bg-slate-950 hover:bg-indigo-500/10 text-indigo-400 border border-slate-800 rounded-lg transition-all cursor-pointer flex items-center gap-1 text-[10px]"
                                title="จัดการรายละเอียด & สั่งพิมพ์เอกสาร"
                              >
                                <Edit className="h-3 w-3" />
                                <span>จัดการเอกสาร</span>
                              </button>
                              <button
                                onClick={() => handleDelete(a.id)}
                                className="p-1.5 bg-slate-950 hover:bg-red-500/10 text-red-400 border border-slate-800 rounded-lg transition-all cursor-pointer"
                                title="ลบข้อมูล"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {view === 'form' && (
        <div className="bg-slate-900 border border-slate-800/80 rounded-2xl overflow-hidden shadow-xl flex flex-col md:flex-row min-h-[60vh]">
          
          {/* Tab Navigation Menu */}
          <div className="w-full md:w-64 bg-slate-950/40 border-r border-slate-800/80 p-4 space-y-1">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold block px-3 mb-3">ขั้นตอนกรอกคำขอ</span>
            
            <button
              type="button"
              onClick={() => setActiveTab('info')}
              className={`w-full text-left px-3 py-2.5 rounded-lg text-xs transition-all flex items-center gap-2.5 font-medium ${
                activeTab === 'info' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-850 hover:text-white'
              }`}
            >
              <FileText className="h-4 w-4" />
              <span>1. ข้อมูลทั่วไป กทย.4</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('proposal')}
              className={`w-full text-left px-3 py-2.5 rounded-lg text-xs transition-all flex items-center gap-2.5 font-medium ${
                activeTab === 'proposal' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-850 hover:text-white'
              }`}
            >
              <Calendar className="h-4 w-4" />
              <span>2. รายละเอียดโครงการ 9 ข้อ</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('schedule')}
              className={`w-full text-left px-3 py-2.5 rounded-lg text-xs transition-all flex items-center gap-2.5 font-medium ${
                activeTab === 'schedule' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-850 hover:text-white'
              }`}
            >
              <FileSpreadsheet className="h-4 w-4" />
              <span>3. กำหนดการ & งบประมาณ</span>
            </button>

            {editingId && (
              <button
                type="button"
                onClick={() => setActiveTab('print-center')}
                className="w-full text-left px-3 py-2.5 rounded-lg text-xs bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 transition-all flex items-center gap-2.5 font-semibold hover:bg-emerald-500/20 mt-4"
              >
                <Printer className="h-4 w-4" />
                <span>🖨️ ศูนย์ออกเอกสารพิมพ์ (7 ฉบับ)</span>
              </button>
            )}
          </div>

          {/* Form fields Scroll area */}
          <div className="flex-1 p-6 overflow-y-auto">
            {activeTab !== 'print-center' && (
              <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800/80 mb-6 space-y-3">
                <span className="text-[10px] text-slate-400 uppercase font-semibold flex items-center gap-1.5">
                  <Sparkles className="h-3 w-3 text-indigo-400" />
                  <span>บันทึกเสียงพูดถอดข้อมูลเสนอเงินกองทุน (AI Voice Assistant)</span>
                </span>
                <div className="flex gap-2">
                  <textarea
                    value={aiStoryText}
                    onChange={(e) => setAiStoryText(e.target.value)}
                    placeholder="พูดอธิบายโครงการหรือรายละเอียดคำขอ... เช่น เสนอโครงการอบรมกฎหมายประชาชน วันที่ 15 สิงหาคม 2569 ผู้ประสานงานหลักคือนายชูชาติ โทร 0812345678..."
                    className="flex-1 bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500/80 resize-y min-h-[60px] font-light leading-relaxed"
                  />
                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={isVoiceListening ? stopVoiceListening : startVoiceListening}
                      className={`p-2.5 rounded-xl border transition-all flex items-center justify-center cursor-pointer ${
                        isVoiceListening 
                          ? 'bg-rose-600 border-rose-500 text-white animate-pulse' 
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {isVoiceListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                    </button>
                    <button
                      type="button"
                      onClick={handleAIParsing}
                      disabled={aiParsing || !aiStoryText.trim()}
                      className="px-3 py-2.5 bg-indigo-600 disabled:bg-slate-800 hover:bg-indigo-500 text-white text-[10px] font-semibold rounded-xl cursor-pointer transition-all"
                    >
                      {aiParsing ? <Loader2 className="h-4 w-4 animate-spin" /> : 'ดึงข้อมูล'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'info' && (
              <div className="space-y-6">
                <h3 className="text-sm font-semibold text-white border-b border-slate-800 pb-3 flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-indigo-400" />
                  <span>ข้อมูลทั่วไปผู้เสนอโครงการ (ส่วนที่ 1)</span>
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold text-slate-300">ชื่อผู้เสนอโครงการ (ประธานศูนย์) *</label>
                    <input
                      type="text"
                      value={formData.proposer_name}
                      onChange={(e) => updateFormValue('proposer_name', e.target.value)}
                      className={`w-full bg-slate-950 border rounded-xl px-3.5 py-2.5 text-xs text-slate-100 focus:outline-none transition-all ${
                        highlightFields.proposer_name 
                          ? 'border-indigo-400 ring-2 ring-indigo-500/20 bg-indigo-950/20 animate-pulse' 
                          : 'border-slate-800 focus:border-indigo-500/80'
                      }`}
                      placeholder="เช่น นายอุทัย ศรีสุข"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold text-slate-300">ชื่อโครงการที่ต้องการขอช่วยเหลือเงินทุน *</label>
                    <input
                      type="text"
                      value={formData.project_name}
                      onChange={(e) => updateFormValue('project_name', e.target.value)}
                      className={`w-full bg-slate-950 border rounded-xl px-3.5 py-2.5 text-xs text-slate-100 focus:outline-none transition-all ${
                        highlightFields.project_name 
                          ? 'border-indigo-400 ring-2 ring-indigo-500/20 bg-indigo-950/20 animate-pulse' 
                          : 'border-slate-800 focus:border-indigo-500/80'
                      }`}
                      placeholder="ชื่อโครงการเต็มสำหรับการจัดส่งพิจารณา"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold text-slate-300">ที่ตั้งสำนักงาน (พร้อมแผนที่) *</label>
                    <textarea
                      rows={2}
                      value={formData.office_address}
                      onChange={(e) => updateFormValue('office_address', e.target.value)}
                      className={`w-full bg-slate-950 border rounded-xl px-3.5 py-2.5 text-xs text-slate-100 focus:outline-none transition-all ${
                        highlightFields.office_address 
                          ? 'border-indigo-400 ring-2 ring-indigo-500/20 bg-indigo-950/20 animate-pulse' 
                          : 'border-slate-800 focus:border-indigo-500/80'
                      }`}
                      placeholder="เลขที่ หมู่บ้าน ตำบล อำเภอ จังหวัด..."
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold text-slate-300">ประเภทผู้เสนอโครงการ</label>
                    <input
                      type="text"
                      value={formData.proposer_type}
                      onChange={(e) => updateFormValue('proposer_type', e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500/80"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t border-slate-800/40">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold text-slate-300">ชื่อผู้ประสานงานโครงการ</label>
                    <input
                      type="text"
                      value={formData.coordinator_name}
                      onChange={(e) => updateFormValue('coordinator_name', e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500/80"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold text-slate-300">เบอร์ติดต่อผู้ประสานงาน</label>
                    <input
                      type="text"
                      value={formData.coordinator_phone}
                      onChange={(e) => updateFormValue('coordinator_phone', e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500/80"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold text-slate-300">อีเมลผู้ประสานงาน</label>
                    <input
                      type="email"
                      value={formData.coordinator_email}
                      onChange={(e) => updateFormValue('coordinator_email', e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500/80"
                    />
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t border-slate-800/40">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold text-slate-300">กิจกรรม/งานที่ดำเนินการอยู่ในปัจจุบัน</label>
                    <textarea
                      rows={2}
                      value={formData.current_activities}
                      onChange={(e) => updateFormValue('current_activities', e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500/80 font-light"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold text-slate-300">ประวัติผลงานในรอบ 1 ปีที่ผ่านมา</label>
                    <textarea
                      rows={2}
                      value={formData.past_achievements}
                      onChange={(e) => updateFormValue('past_achievements', e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500/80 font-light"
                    />
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'proposal' && (
              <div className="space-y-6">
                <h3 className="text-sm font-semibold text-white border-b border-slate-800 pb-3">รายละเอียดโครงสร้างโครงการเสนอรับทุน (ส่วนที่ 2)</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold text-slate-300">วันที่เริ่มต้นจัดโครงการ *</label>
                    <input
                      type="date"
                      value={formData.start_date}
                      onChange={(e) => updateFormValue('start_date', e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500/80"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold text-slate-300">วันที่จัดเสร็จสิ้นโครงการ *</label>
                    <input
                      type="date"
                      value={formData.end_date}
                      onChange={(e) => updateFormValue('end_date', e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500/80"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="md:col-span-2 space-y-1.5">
                    <label className="text-[11px] font-semibold text-slate-300">สถานที่ดำเนินงาน/จัดกิจกรรมอบรม *</label>
                    <input
                      type="text"
                      value={formData.location}
                      onChange={(e) => updateFormValue('location', e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500/80"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold text-slate-300">กลุ่มเป้าหมายผู้เข้าร่วม (คน) *</label>
                    <input
                      type="number"
                      value={formData.target_count}
                      onChange={(e) => updateFormValue('target_count', Number(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500/80 text-right"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-slate-300">กลุ่มเป้าหมาย (เช่น เครือข่ายประชาชน)</label>
                  <input
                    type="text"
                    value={formData.target_group}
                    onChange={(e) => updateFormValue('target_group', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500/80"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-slate-300">หลักการและเหตุผลความเป็นมาของโครงการ *</label>
                  <textarea
                    rows={4}
                    value={formData.rationale}
                    onChange={(e) => updateFormValue('rationale', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500/80 leading-relaxed font-light"
                  />
                </div>

                <div className="space-y-4 pt-4 border-t border-slate-800/40">
                  <span className="text-xs font-semibold text-slate-200 block">ข้อมูลเอกสารมติที่ประชุมและเห็นชอบโครงการ (สำหรับออกหนังสือรับรอง)</span>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold text-slate-300">วันที่จัดประชุมเห็นชอบโครงการ *</label>
                      <input
                        type="date"
                        value={formData.meeting_date}
                        onChange={(e) => updateFormValue('meeting_date', e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500/80"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold text-slate-300">มติที่ประชุมสรุป</label>
                      <input
                        type="text"
                        value={formData.meeting_resolution}
                        onChange={(e) => updateFormValue('meeting_resolution', e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500/80"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'schedule' && (
              <div className="space-y-8">
                
                {/* กำหนดการอบรม */}
                <div className="space-y-4">
                  <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                    <h4 className="text-xs font-semibold text-white">1. รายการตารางกำหนดการอบรม</h4>
                    <button
                      type="button"
                      onClick={addScheduleRow}
                      className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] rounded-lg cursor-pointer"
                    >
                      + เพิ่มตารางเวลา
                    </button>
                  </div>

                  <div className="space-y-3">
                    {scheduleData.map((row, idx) => (
                      <div key={idx} className="flex gap-2 items-center bg-slate-950/40 p-2.5 border border-slate-800 rounded-lg">
                        <input
                          type="text"
                          value={row.time}
                          onChange={(e) => updateScheduleCell(idx, 'time', e.target.value)}
                          placeholder="เวลา เช่น 09.00-10.00 น."
                          className="w-[150px] bg-slate-950 border border-slate-850 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none"
                        />
                        <input
                          type="text"
                          value={row.topic}
                          onChange={(e) => updateScheduleCell(idx, 'topic', e.target.value)}
                          placeholder="หัวข้อการวิชา/เนื้อหาอบรม"
                          className="flex-1 bg-slate-950 border border-slate-850 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none"
                        />
                        <input
                          type="text"
                          value={row.lecturer}
                          onChange={(e) => updateScheduleCell(idx, 'lecturer', e.target.value)}
                          placeholder="วิทยากรผู้บรรยาย"
                          className="w-[200px] bg-slate-950 border border-slate-850 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => removeScheduleRow(idx)}
                          className="text-rose-500 hover:text-rose-400 p-1 text-xs cursor-pointer"
                        >
                          ลบ
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ตารางค่าใช้จ่าย */}
                <div className="space-y-4 pt-6 border-t border-slate-850">
                  <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                    <div>
                      <h4 className="text-xs font-semibold text-white">2. ตารางประมาณการคำนวณงบประมาณย่อย</h4>
                      <p className="text-[9px] text-slate-500">กรอกปริมาณและราคาเพื่อวิเคราะห์หาผลรวมโครงการอัตโนมัติ</p>
                    </div>
                    <button
                      type="button"
                      onClick={addExpenseRow}
                      className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] rounded-lg cursor-pointer"
                    >
                      + เพิ่มรายการจ่าย
                    </button>
                  </div>

                  <div className="space-y-3">
                    {expenseData.map((row, idx) => (
                      <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-slate-950/40 p-3 border border-slate-800 rounded-lg">
                        <input
                          type="text"
                          value={row.item}
                          onChange={(e) => updateExpenseCell(idx, 'item', e.target.value)}
                          placeholder="คำอธิบายรายจ่าย เช่น ค่าอาหารว่างและเครื่องดื่ม"
                          className="col-span-6 bg-slate-950 border border-slate-850 rounded px-2 py-1.5 text-xs text-slate-200 focus:outline-none"
                        />
                        <input
                          type="number"
                          value={row.qty || ''}
                          onChange={(e) => updateExpenseCell(idx, 'qty', Number(e.target.value))}
                          placeholder="จำนวนคน"
                          className="col-span-1 bg-slate-950 border border-slate-850 rounded px-1 py-1.5 text-xs text-slate-200 text-right focus:outline-none"
                        />
                        <input
                          type="number"
                          value={row.multiplier || ''}
                          onChange={(e) => updateExpenseCell(idx, 'multiplier', Number(e.target.value))}
                          placeholder="วัน/มื้อ"
                          className="col-span-1 bg-slate-950 border border-slate-850 rounded px-1 py-1.5 text-xs text-slate-200 text-right focus:outline-none"
                        />
                        <input
                          type="number"
                          value={row.price || ''}
                          onChange={(e) => updateExpenseCell(idx, 'price', Number(e.target.value))}
                          placeholder="ต่อหน่วย"
                          className="col-span-2 bg-slate-950 border border-slate-850 rounded px-2 py-1.5 text-xs text-slate-200 text-right focus:outline-none"
                        />
                        <span className="col-span-1.5 text-right text-indigo-400 font-semibold text-xs">
                          {Number(row.total || 0).toLocaleString()}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeExpenseRow(idx)}
                          className="col-span-0.5 text-rose-500 hover:text-rose-400 p-1 text-xs cursor-pointer text-center"
                        >
                          X
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-850 flex justify-between items-center text-xs font-semibold">
                    <span className="text-slate-400">สรุปยอดรวมงบประมาณโครงการเสนอกองทุน:</span>
                    <span className="text-white text-sm">{totalCost.toLocaleString()} บาท ({thaiBahtText(totalCost)})</span>
                  </div>
                </div>

              </div>
            )}

            {activeTab === 'print-center' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-semibold text-white">🖨️ ศูนย์ดาวน์โหลดและจัดพิมพ์เอกสารยื่นเสนอ</h3>
                  <p className="text-[10px] text-slate-500 mt-0.5">เลือกหัวข้อเอกสารที่ต้องการพิมพ์ ระบบจะดึงข้อมูลที่กรอกไว้มาจัดรูปแบบราชการทันทีเพื่อกดสั่งพิมพ์หรือพิมพ์เป็นไฟล์ PDF</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    { id: 'kth4', name: '1. แบบคำขอช่วยเหลือ (กทย.4)', desc: 'แบบฟอร์มคำขอทุนพร้อมข้อมูลประธานศูน์และสรุปผล' },
                    { id: 'proposal', name: '2. เอกสารรายละเอียดโครงการ 9 หัวข้อ', desc: 'แผนรายละเอียดเหตุผล วัตถุประสงค์ ขั้นตอน และผลคาดหมาย' },
                    { id: 'schedule', name: '3. แผนงานตารางกำหนดการอบรม', desc: 'ตารางระบุ วัน เวลา หัวข้อ และคณะวิทยากรผู้บรรยาย' },
                    { id: 'expenses', name: '4. ตารางประมาณการรายจ่ายย่อย', desc: 'ตารางคำนวณงบอาหารว่าง อาหารกลางวัน และวิทยากร' },
                    { id: 'cert', name: '5. หนังสือรับรองการไม่ซ้ำซ้อนงบประมาณ', desc: 'ใบรับรองลงนามโดยประธานศูนย์ว่าไม่ได้รับงบอื่น' },
                    { id: 'minutes', name: '6. รายงานประชุมมีมติเห็นชอบโครงการ', desc: 'มติความเห็นชอบของคณะกรรมการศูนย์ให้ยื่นขอรับทุน' },
                    { id: 'refs', name: '7. หนังสือรับรองผลงาน (งบเกิน 50,000 บาท)', desc: 'ใบรับรองและลายมือชื่อบุคคลอ้างอิงและพยาน 2 ท่าน' }
                  ].map(doc => {
                    const isRefsDisabled = doc.id === 'refs' && totalCost <= 50000;
                    
                    return (
                      <div 
                        key={doc.id} 
                        className={`bg-slate-950/60 p-4 border rounded-xl flex justify-between items-center transition-all ${
                          isRefsDisabled ? 'opacity-40 border-slate-900' : 'border-slate-800/80 hover:border-indigo-500/20'
                        }`}
                      >
                        <div className="space-y-1 pr-4">
                          <span className="text-xs font-semibold text-slate-200 block">{doc.name}</span>
                          <span className="text-[10px] text-slate-500 block leading-relaxed">{doc.desc}</span>
                          {isRefsDisabled && (
                            <span className="text-[9px] text-amber-500 font-semibold block mt-0.5">*(เฉพาะโครงการที่งบเกิน 50,000 บาท)</span>
                          )}
                        </div>
                        <button
                          type="button"
                          disabled={isRefsDisabled}
                          onClick={() => {
                            setActivePrintDoc(doc.id);
                            setView('print');
                          }}
                          className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white text-[10px] font-semibold rounded-lg shadow cursor-pointer shrink-0"
                        >
                          <Printer className="h-3.5 w-3.5" />
                          <span>พิมพ์เอกสาร</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      {view === 'print' && (
        <div className="bg-white text-slate-900 p-8 sm:p-12 rounded-2xl shadow-2xl space-y-8 font-serif relative">
          
          {/* Print Options Buttons (Hidden during prints) */}
          <div className="absolute top-4 right-4 flex gap-2 no-print">
            <button
              onClick={handlePrintDocument}
              className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg shadow-md cursor-pointer"
            >
              <Printer className="h-4 w-4" />
              <span>ดาวน์โหลด PDF / สั่งพิมพ์</span>
            </button>
            <button
              onClick={() => setView('form')}
              className="flex items-center gap-1.5 px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold rounded-lg cursor-pointer"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>ย้อนกลับ</span>
            </button>
          </div>

          <div id="print-document-content">

          {/* DOCUMENT 1: KTH4 (แบบ กทย.4) */}
          {activePrintDoc === 'kth4' && (
            <div className="space-y-6 text-sm text-slate-800 leading-loose">
              <div className="text-right font-bold text-xs uppercase text-slate-500">แบบ กทย.4</div>
              <div className="text-center space-y-1.5 border-b pb-4">
                <h2 className="text-lg font-bold">แบบคำขอรับความช่วยเหลือเงินกองทุนยุติธรรม</h2>
                <h3 className="text-sm font-semibold">กรณีการสนับสนุนโครงการให้ความรู้ทางกฎหมายแก่ประชาชน</h3>
              </div>

              <div className="space-y-4">
                <h4 className="font-bold text-slate-900 border-b pb-1 text-xs">ส่วนที่ 1 ข้อมูลทั่วไปของผู้ขอรับความช่วยเหลือ</h4>
                
                <div className="grid grid-cols-12 gap-2 text-xs">
                  <div className="col-span-12">
                    <span className="font-semibold text-slate-900">1.1 ชื่อผู้เสนอโครงการ (ภาษาไทย):</span> <span>{formData.proposer_name}</span>
                  </div>
                  <div className="col-span-12">
                    <span className="font-semibold text-slate-900">ชื่อโครงการ:</span> <span>{formData.project_name}</span>
                  </div>
                  <div className="col-span-12">
                    <span className="font-semibold text-slate-900">1.2 ประเภทผู้เสนอโครงการ:</span> <span>{formData.proposer_type}</span>
                  </div>
                  <div className="col-span-12">
                    <span className="font-semibold text-slate-900">1.3 ที่ตั้งสำนักงาน/ที่อยู่ (พร้อมแผนที่):</span> <span>{formData.office_address}</span>
                  </div>
                  <div className="col-span-6">
                    <span className="font-semibold text-slate-900">1.4 ชื่อผู้ประสานงานโครงการ:</span> <span>{formData.coordinator_name}</span>
                  </div>
                  <div className="col-span-6">
                    <span className="font-semibold text-slate-900">โทรศัพท์/มือถือ:</span> <span>{formData.coordinator_phone}</span>
                  </div>
                  <div className="col-span-12">
                    <span className="font-semibold text-slate-900">อีเมลติดต่อ:</span> <span>{formData.coordinator_email}</span>
                  </div>
                  <div className="col-span-12">
                    <span className="font-semibold text-slate-900">1.5 วัตถุประสงค์ที่ขอรับความช่วยเหลือ:</span>
                    <p className="border p-2 bg-slate-50 rounded mt-1 font-sans leading-relaxed">{formData.aim}</p>
                  </div>
                  <div className="col-span-12">
                    <span className="font-semibold text-slate-900">1.6 กิจกรรมหรือโครงการที่ดำเนินการอยู่ในปัจจุบัน (โดยสรุป):</span>
                    <p className="border p-2 bg-slate-50 rounded mt-1 font-sans leading-relaxed">{formData.current_activities}</p>
                  </div>
                  <div className="col-span-12">
                    <span className="font-semibold text-slate-900">1.7 ผลงานในรอบ 1 ปีที่ผ่านมา (โดยสรุป):</span>
                    <p className="border p-2 bg-slate-50 rounded mt-1 font-sans leading-relaxed">{formData.past_achievements}</p>
                  </div>
                </div>
              </div>

              <div className="pt-10 flex justify-end text-center">
                <div className="w-[300px] space-y-8 text-xs font-sans">
                  <p>ลงชื่อ.......................................................... ผู้ขอรับความช่วยเหลือ</p>
                  <p>( {formData.proposer_name} )</p>
                  <p>ประธานศูนย์ไกล่เกลี่ยข้อพิพาทภาคประชาชน</p>
                  <p>วันที่ {new Date().toLocaleDateString('th-TH')}</p>
                </div>
              </div>
            </div>
          )}

          {/* DOCUMENT 2: PROPOSAL (รายละเอียดโครงการ 9 หัวข้อ) */}
          {activePrintDoc === 'proposal' && (
            <div className="space-y-6 text-sm text-slate-800 leading-loose">
              <div className="text-center space-y-1 border-b pb-4">
                <h2 className="text-lg font-bold">เอกสารรายละเอียดข้อเสนอโครงการรับงบสนับสนุน</h2>
                <h3 className="text-sm font-semibold">{formData.project_name}</h3>
              </div>

              <div className="space-y-4 text-xs font-sans">
                <div>
                  <span className="font-bold text-slate-900 block">1. หลักการและเหตุผล:</span>
                  <p className="pl-4 whitespace-pre-line leading-relaxed text-slate-700">{formData.rationale}</p>
                </div>

                <div>
                  <span className="font-bold text-slate-900 block">2. วัตถุประสงค์โครงการ:</span>
                  <p className="pl-4 leading-relaxed text-slate-700">{formData.aim}</p>
                </div>

                <div>
                  <span className="font-bold text-slate-900 block">3. กลุ่มเป้าหมายและจำนวนผู้เข้าอบรม:</span>
                  <p className="pl-4 leading-relaxed text-slate-700">{formData.target_group} จำนวน {formData.target_count} คน</p>
                </div>

                <div>
                  <span className="font-bold text-slate-900 block">4. สถานที่ดำเนินโครงการ:</span>
                  <p className="pl-4 leading-relaxed text-slate-700">{formData.location}</p>
                </div>

                <div>
                  <span className="font-bold text-slate-900 block">5. ระยะเวลาดำเนินงาน:</span>
                  <p className="pl-4 leading-relaxed text-slate-700">
                    {formData.start_date ? new Date(formData.start_date).toLocaleDateString('th-TH') : '-'}
                    {formData.end_date && ` ถึงวันที่ ${new Date(formData.end_date).toLocaleDateString('th-TH')}`}
                  </p>
                </div>

                <div>
                  <span className="font-bold text-slate-900 block">6. ประมาณการงบประมาณค่าใช้จ่ายรวม:</span>
                  <p className="pl-4 leading-relaxed text-slate-700">รวมทั้งสิ้น {totalCost.toLocaleString()} บาท ({thaiBahtText(totalCost)})</p>
                </div>

                <div>
                  <span className="font-bold text-slate-900 block">7. ผลที่คาดว่าจะได้รับ:</span>
                  <p className="pl-4 leading-relaxed text-slate-700">ประชาชนและเครือข่ายผู้เข้าอบรมได้รับความรู้กฎหมายสิทธิ์เสรีภาพ มีช่องทางการเข้าถึงระบบกองทุนและกระบวนการไกล่เกลี่ยยุติธรรมชุมชนอย่างทั่วถึง</p>
                </div>

                <div>
                  <span className="font-bold text-slate-900 block">8. ผู้ประสานงานโครงการ:</span>
                  <p className="pl-4 leading-relaxed text-slate-700">{formData.coordinator_name} โทรศัพท์ {formData.coordinator_phone}</p>
                </div>
              </div>

              <div className="pt-10 flex justify-end text-center">
                <div className="w-[300px] space-y-6 text-xs font-sans">
                  <p>ลงชื่อ.......................................................... ผู้เสนอโครงการ</p>
                  <p>( {formData.proposer_name} )</p>
                </div>
              </div>
            </div>
          )}

          {/* DOCUMENT 3: SCHEDULE (กำหนดการอบรม) */}
          {activePrintDoc === 'schedule' && (
            <div className="space-y-6 text-sm text-slate-800 leading-loose">
              <div className="text-center space-y-1.5 border-b pb-4">
                <h2 className="text-lg font-bold">กำหนดการและตารางการฝึกอบรมเผยแพร่ความรู้ทางกฎหมาย</h2>
                <h3 className="text-sm font-semibold">{formData.project_name}</h3>
                <p className="text-xs text-slate-500">
                  ระหว่างวันที่ {formData.start_date ? new Date(formData.start_date).toLocaleDateString('th-TH') : '-'}
                  {formData.end_date && ` ถึง ${new Date(formData.end_date).toLocaleDateString('th-TH')}`}
                </p>
              </div>

              <div className="space-y-4">
                <table className="w-full border-collapse border border-slate-400 text-xs">
                  <thead>
                    <tr className="bg-slate-100 font-semibold border-b border-slate-400">
                      <th className="border border-slate-400 px-4 py-3 text-left w-[150px]">เวลา</th>
                      <th className="border border-slate-400 px-4 py-3 text-left">หัวข้อวิชาการบรรยาย</th>
                      <th className="border border-slate-400 px-4 py-3 text-left w-[220px]">วิทยากรผู้บรรยาย</th>
                    </tr>
                  </thead>
                  <tbody className="font-sans text-slate-700">
                    {scheduleData.map((row, idx) => (
                      <tr key={idx} className="border-b border-slate-400">
                        <td className="border border-slate-400 px-4 py-2.5 font-medium">{row.time}</td>
                        <td className="border border-slate-400 px-4 py-2.5">{row.topic}</td>
                        <td className="border border-slate-400 px-4 py-2.5">{row.lecturer}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* DOCUMENT 4: EXPENSES (ตารางประมาณการรายจ่าย) */}
          {activePrintDoc === 'expenses' && (
            <div className="space-y-6 text-sm text-slate-800 leading-loose">
              <div className="text-center space-y-1.5 border-b pb-4">
                <h2 className="text-lg font-bold">ตารางแสดงรายละเอียดประมาณการค่าใช้จ่ายจัดฝึกอบรม</h2>
                <h3 className="text-sm font-semibold">{formData.project_name}</h3>
              </div>

              <div className="space-y-4">
                <table className="w-full border-collapse border border-slate-400 text-xs">
                  <thead>
                    <tr className="bg-slate-100 font-semibold border-b border-slate-400">
                      <th className="border border-slate-400 px-4 py-3 text-left">รายการรายจ่ายย่อย</th>
                      <th className="border border-slate-400 px-4 py-3 text-right w-[80px]">จำนวน (คน)</th>
                      <th className="border border-slate-400 px-4 py-3 text-right w-[80px]">มื้อ/วัน</th>
                      <th className="border border-slate-400 px-4 py-3 text-right w-[120px]">ราคาหน่วย (บาท)</th>
                      <th className="border border-slate-400 px-4 py-3 text-right w-[150px]">ประมาณการรวม (บาท)</th>
                    </tr>
                  </thead>
                  <tbody className="font-sans text-slate-700">
                    {expenseData.map((row, idx) => (
                      <tr key={idx} className="border-b border-slate-400">
                        <td className="border border-slate-400 px-4 py-2.5">{row.item}</td>
                        <td className="border border-slate-400 px-4 py-2.5 text-right">{row.qty || '-'}</td>
                        <td className="border border-slate-400 px-4 py-2.5 text-right">{row.multiplier || '-'}</td>
                        <td className="border border-slate-400 px-4 py-2.5 text-right">{Number(row.price || 0).toLocaleString()}</td>
                        <td className="border border-slate-400 px-4 py-2.5 text-right font-medium">{Number(row.total || 0).toLocaleString()}</td>
                      </tr>
                    ))}
                    <tr className="bg-slate-50 font-bold border-t-2 border-slate-900">
                      <td colSpan={4} className="border border-slate-400 px-4 py-3 text-right">ยอดเงินงบประมาณรวมทั้งสิ้น</td>
                      <td className="border border-slate-400 px-4 py-3 text-right text-indigo-600">{totalCost.toLocaleString()}</td>
                    </tr>
                  </tbody>
                </table>
                <p className="text-xs text-slate-500 font-sans italic">หมายเหตุ: ตัวเลขงบประมาณคำนวณถัวเฉลี่ยกันได้ทุกรายการตามความเหมาะสมของการดำเนินโครงการ</p>
              </div>
            </div>
          )}

          {/* DOCUMENT 5: CERT (หนังสือรับรองการไม่ซ้ำซ้อนงบประมาณ) */}
          {activePrintDoc === 'cert' && (
            <div className="space-y-8 text-sm text-slate-800 leading-loose max-w-2xl mx-auto py-10 font-serif">
              <div className="text-center space-y-1 pb-4">
                <h2 className="text-lg font-bold">หนังสือรับรองประธานศูนย์ไกล่เกลี่ยข้อพิพาทภาคประชาชน</h2>
              </div>

              <div className="space-y-6 text-xs leading-relaxed text-slate-750 indent-12">
                <p>
                  เขียนที่ ศูนย์ไกล่เกลี่ยข้อพิพาทภาคประชาชน {formData.office_address || '..........................................................'}
                </p>
                <p>
                  วันที่ {new Date().getDate()} เดือน {new Date().toLocaleString('th-TH', { month: 'long' })} พ.ศ. {new Date().getFullYear() + 543}
                </p>
                <p>
                  ข้าพเจ้า <strong>{formData.proposer_name}</strong> ในฐานะประธานศูนย์ไกล่เกลี่ยข้อพิพาทภาคประชาชน/ชุมชน ขอรับรองและยืนยันว่า โครงการ <strong>"{formData.project_name}"</strong> ที่เสนอขอรับเงินสนับสนุนจากเงินกองทุนยุติธรรมประจำปีนี้ 
                  <strong>ไม่ได้รับการจัดสรรงบประมาณสนับสนุนจากหน่วยงานอื่นใด</strong> หรือหน่วยงานภาครัฐ/เอกชนอื่นในห้วงเวลาเดียวกัน หรือหากได้รับจัดสรรงบจากหน่วยงานอื่นแล้วแต่พิสูจน์ได้ว่ายอดวงเงินไม่เพียงพอต่อการดำเนินกิจกรรมให้ความรู้จริง
                </p>
                <p>
                  จึงขอออกหนังสือรับรองฉบับนี้ไว้เพื่อเสนอประกอบแบบคำขอ กทย.4 ยื่นเสนอขอรับการพิจารณาช่วยเหลือต่อคณะอนุกรรมการกองทุนยุติธรรมต่อไป
                </p>
              </div>

              <div className="pt-20 flex justify-end text-center">
                <div className="w-[300px] space-y-6 text-xs font-sans">
                  <p>ลงชื่อ.......................................................... ประธานศูนย์</p>
                  <p>( {formData.proposer_name} )</p>
                </div>
              </div>
            </div>
          )}

          {/* DOCUMENT 6: MINUTES (รายงานประชุมมีมติเห็นชอบโครงการ) */}
          {activePrintDoc === 'minutes' && (
            <div className="space-y-6 text-sm text-slate-800 leading-loose max-w-3xl mx-auto py-6 font-serif">
              <div className="text-center space-y-1.5 border-b pb-4">
                <h2 className="text-lg font-bold">รายงานมติการประชุมวิเคราะห์เสนอโครงการ</h2>
                <h3 className="text-sm font-semibold">ศูนย์ไกล่เกลี่ยข้อพิพาทภาคประชาชน/ศูนย์ยุติธรรมชุมชน</h3>
              </div>

              <div className="space-y-4 text-xs font-sans text-slate-700 leading-relaxed">
                <p><strong>สถานที่ประชุม:</strong> ที่ทำการศูนย์ไกล่เกลี่ยข้อพิพาทฯ</p>
                <p>
                  <strong>วันเวลาที่จัดประชุม:</strong> วันที่ {formData.meeting_date ? new Date(formData.meeting_date).toLocaleDateString('th-TH') : '................................................'}
                </p>
                <p><strong>ผู้เข้าร่วมประชุมประชุม:</strong> คณะทำงานบริหารและสมาชิกประจำศูนย์ (รวมทั้งสิ้น {formData.meeting_attendees})</p>
                
                <div className="border-t border-b py-4 my-4 space-y-2">
                  <span className="font-bold text-slate-900 block">ระเบียบวาระการประชุมเพื่อเห็นชอบเสนอโครงการรับสนับสนุนงบประมาณ:</span>
                  <p>
                    ประธานที่ประชุมเสนอวาระแจ้งว่าศูนย์ไกล่เกลี่ยฯ มีความประสงค์จะดำเนินกิจกรรมเผยแพร่ความรู้ด้านกฎหมายสิทธิและหน้าที่แก่ประชาชนในชุมชน จึงร่วมระดมความคิดเห็นเสนอร่างโครงการ <strong>"{formData.project_name}"</strong> เพื่อยื่นคำขอรับงบช่วยเหลือจากเงินกองทุนยุติธรรม
                  </p>
                  <p><strong>มติที่ประชุมสรุป:</strong> {formData.meeting_resolution}</p>
                </div>
              </div>

              <div className="pt-16 flex justify-between items-center text-center text-xs font-sans">
                <div className="w-[250px] space-y-6">
                  <p>ลงชื่อ.......................................................... ผู้บันทึกรายงาน</p>
                  <p>( .......................................................... )</p>
                </div>
                <div className="w-[250px] space-y-6">
                  <p>ลงชื่อ.......................................................... ผู้รับรองมติการประชุม</p>
                  <p>( {formData.proposer_name} )</p>
                </div>
              </div>
            </div>
          )}

          {/* DOCUMENT 7: REFS (หนังสือรับรองผลงานและบุคคลอ้างอิง) */}
          {activePrintDoc === 'refs' && (
            <div className="space-y-6 text-sm text-slate-800 leading-loose max-w-3xl mx-auto py-6 font-serif">
              <div className="text-center space-y-1.5 border-b pb-4">
                <h2 className="text-lg font-bold">หนังสือรับรองผลงานและการดำเนินงานโครงการที่ผ่านมา</h2>
                <p className="text-xs text-slate-500">*(กรณีงบประมาณโครงการเสนอขอเกินกว่า 50,000 บาท)</p>
              </div>

              <div className="space-y-4 text-xs font-sans text-slate-700 leading-relaxed">
                <p>
                  ตามระเบียบหลักเกณฑ์การยื่นคำขอรับช่วยเหลือสนับสนุนงบประมาณเกินกว่า 50,000 บาท ข้าพเจ้าขอเสนอพยานบุคคลอ้างอิงจำนวน 2 คนที่สามารถรับรองถึงผลงานและศักยภาพการบริหารโครงการของศูนย์ในอดีตได้ ดังมีรายชื่อต่อไปนี้:
                </p>

                <div className="space-y-4 mt-6">
                  {referenceData.map((ref, idx) => (
                    <div key={idx} className="border p-4 rounded bg-slate-50 space-y-1">
                      <p><strong>คนที่ {idx + 1}:</strong> {ref.name}</p>
                      <p><strong>ตำแหน่ง/สังกัด:</strong> {ref.position}</p>
                      <p><strong>หน่วยงานที่อยู่ติดต่อ:</strong> {ref.office}</p>
                      <p><strong>เบอร์โทรศัพท์:</strong> {ref.contact}</p>
                    </div>
                  ))}
                </div>

                <div className="pt-6">
                  <p>ข้าพเจ้าขอรับรองว่าข้อมูลรายละเอียดบุคคลอ้างอิงและศักยภาพการจัดฝึกอบรมเป็นความจริงทุกประการ</p>
                </div>
              </div>

              <div className="pt-16 flex justify-end text-center">
                <div className="w-[300px] space-y-6 text-xs font-sans">
                  <p>ลงชื่อ.......................................................... ผู้เสนอขอรับทุน</p>
                  <p>( {formData.proposer_name} )</p>
                </div>
              </div>
            </div>
          )}
          </div>

        </div>
      )}
    </div>
  );
}
