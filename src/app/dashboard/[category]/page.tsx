'use client';

import React, { useState, useEffect, use, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { 
  Plus, Edit, Trash2, Search, ArrowLeft, Upload, FileText, CheckCircle, 
  AlertCircle, Download, Loader2, ChevronLeft, ChevronRight, X, Mic, MicOff, Sparkles
} from 'lucide-react';
import Swal from 'sweetalert2';
import Link from 'next/link';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';

interface CategoryConfig {
  title: string;
  table: string;
  idField: string;
  fields: {
    name: string;
    label: string;
    type: 'text' | 'number' | 'date' | 'select' | 'textarea' | 'file' | 'radio';
    placeholder?: string;
    options?: { value: string; label: string }[];
    required?: boolean;
    conditional?: { field: string; showIf: string };
    pattern?: string;
    title?: string;
    hideLabel?: boolean;
  }[];
  columns: { key: string; label: string; format?: (val: any) => string }[];
}

export default function CategoryPage({ params }: { params: Promise<{ category: string }> }) {
  const resolvedParams = use(params);
  const { category } = resolvedParams;
  const { user, profile } = useAuth();

  const [items, setItems] = useState<any[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // File upload state
  const [uploading, setUploading] = useState(false);
  const [uploadedFileUrl, setUploadedFileUrl] = useState<string>('');
  const [uploadedFileName, setUploadedFileName] = useState<string>('');

  // Form state
  const [formData, setFormData] = useState<any>({});

  // AI Voice & Text integration states
  const [aiStoryText, setAiStoryText] = useState('');
  const [aiParsing, setAiParsing] = useState(false);
  const [highlightFields, setHighlightFields] = useState<Record<string, boolean>>({});

  // Field Speech Recognition state
  const [activeVoiceField, setActiveVoiceField] = useState<string | null>(null);
  const activeVoiceFieldRef = useRef<string | null>(null);

  // Hook for global dictation (Large mic button)
  const {
    isListening,
    startListening,
    stopListening
  } = useSpeechRecognition({
    onResult: (text, isFinal) => {
      if (isFinal) {
        setAiStoryText(prev => (prev ? prev + ' ' + text : text));
      }
    }
  });

  // Hook for single field dictation (Small mic buttons)
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

  const handleAIParsing = async () => {
    if (!aiStoryText || !aiStoryText.trim()) {
      Swal.fire('เตือน', 'กรุณากรอกหรือพูดเล่ารายละเอียดก่อนกดประมวลผล', 'warning');
      return;
    }

    setAiParsing(true);
    try {
      const res = await fetch('/api/ai/parse-report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          story: aiStoryText,
          fieldsSchema: activeConfig.fields
        })
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || 'เกิดข้อผิดพลาดในการประมวลผลของ AI');
      }

      const parsedData = result.data;
      if (parsedData) {
        const newFormData = { ...formData };
        const fieldsFilled: Record<string, boolean> = {};

        Object.keys(parsedData).forEach(key => {
          if (parsedData[key] !== undefined && parsedData[key] !== '') {
            newFormData[key] = parsedData[key];
            fieldsFilled[key] = true;
          }
        });

        setFormData(newFormData);
        setHighlightFields(fieldsFilled);
        setAiStoryText('');

        Swal.fire({
          icon: 'success',
          title: 'ถอดข้อมูลลงฟอร์มสำเร็จ',
          text: 'กรุณาตรวจสอบความถูกต้องและแก้ไขจุดที่ไฮไลท์หากจำเป็น',
          timer: 2000,
          showConfirmButton: false
        });

        setTimeout(() => {
          setHighlightFields({});
        }, 6000);
      }

    } catch (err: any) {
      console.error(err);
      Swal.fire('เกิดข้อผิดพลาด', err.message, 'error');
    } finally {
      setAiParsing(false);
    }
  };

  const pageSize = 10;


  // Configuration mapping for all core modules
  const configs: Record<string, CategoryConfig> = {
    meetings: {
      title: 'การประชุมคณะทำงาน',
      table: 'meetings',
      idField: 'id',
      fields: [
        { name: 'meeting_name', label: 'ชื่อการประชุม', type: 'text', required: true, placeholder: 'เช่น ประชุมคณะทำงานประจำเดือนมิถุนายน' },
        { name: 'meeting_date', label: 'วันที่ประชุม', type: 'date', required: true },
        { name: 'location', label: 'สถานที่ประชุม', type: 'text', placeholder: 'เช่น ห้องประชุมจังหวัด หรือ ระบบออนไลน์ Zoom' },
        { name: 'summary', label: 'สรุปการประชุม', type: 'textarea', placeholder: 'สรุปประเด็นหลักและมติที่ประชุม' },
        { name: 'file_link', label: 'เอกสารแนบ (รายงาน/รูปภาพ)', type: 'file' },
        { name: 'reporter_name', label: 'ชื่อผู้บันทึก', type: 'text', required: true },
        { name: 'reporter_phone', label: 'เบอร์ติดต่อผู้บันทึก', type: 'text' },
        { name: 'source_info', label: 'ชื่อผู้ประสานงาน', type: 'text' },
        { name: 'source_contact', label: 'เบอร์ติดต่อผู้ประสานงาน', type: 'text' },
      ],
      columns: [
        { key: 'meeting_name', label: 'ชื่อการประชุม' },
        { key: 'meeting_date', label: 'วันที่ประชุม', format: (val) => new Date(val).toLocaleDateString('th-TH') },
        { key: 'location', label: 'สถานที่' },
        { key: 'reporter_name', label: 'ผู้บันทึก' },
      ]
    },
    plans: {
      title: 'แผนการดำเนินงาน',
      table: 'plans',
      idField: 'id',
      fields: [
        { name: 'title', label: 'ชื่อแผนงาน/โครงการ', type: 'text', required: true, placeholder: 'เช่น โครงการเสริมสร้างความรู้ด้านการไกล่เกลี่ย' },
        { name: 'year', label: 'ปีงบประมาณ (พ.ศ.)', type: 'text', required: true, placeholder: 'เช่น 2569' },
        { name: 'description', label: 'รายละเอียดแผนงาน', type: 'textarea' },
        { name: 'file_link', label: 'เอกสารแนบโครงการ', type: 'file' },
        { name: 'reporter_name', label: 'ชื่อผู้บันทึก', type: 'text', required: true },
        { name: 'reporter_phone', label: 'เบอร์ติดต่อผู้บันทึก', type: 'text' },
        { name: 'source_info', label: 'ชื่อผู้ประสานงาน', type: 'text' },
        { name: 'source_contact', label: 'เบอร์ติดต่อผู้ประสานงาน', type: 'text' },
      ],
      columns: [
        { key: 'title', label: 'ชื่อแผนงาน/โครงการ' },
        { key: 'year', label: 'ปี พ.ศ.' },
        { key: 'reporter_name', label: 'ผู้บันทึก' },
      ]
    },
    activities: {
      title: 'การจัดกิจกรรม',
      table: 'activities',
      idField: 'id',
      fields: [
        { name: 'activity_name', label: 'ชื่อกิจกรรม', type: 'text', required: true, placeholder: 'เช่น กิจกรรมเผยแพร่กฎหมายชุมชน' },
        { name: 'activity_date', label: 'วันที่จัดกิจกรรม', type: 'date', required: true },
        { name: 'location', label: 'สถานที่จัดกิจกรรม', type: 'text' },
        { name: 'summary', label: 'ผลการดำเนินกิจกรรม', type: 'textarea' },
        { name: 'file_link', label: 'รูปภาพ/เอกสารแนบ', type: 'file' },
        { name: 'reporter_name', label: 'ชื่อผู้บันทึก', type: 'text', required: true },
        { name: 'reporter_phone', label: 'เบอร์ติดต่อผู้บันทึก', type: 'text' },
        { name: 'source_info', label: 'ชื่อผู้ประสานงาน', type: 'text' },
        { name: 'source_contact', label: 'เบอร์ติดต่อผู้ประสานงาน', type: 'text' },
      ],
      columns: [
        { key: 'activity_name', label: 'ชื่อกิจกรรม' },
        { key: 'activity_date', label: 'วันที่จัด', format: (val) => new Date(val).toLocaleDateString('th-TH') },
        { key: 'location', label: 'สถานที่' },
        { key: 'reporter_name', label: 'ผู้บันทึก' },
      ]
    },
    trainings: {
      title: 'การอบรมและพัฒนาความรู้',
      table: 'trainings',
      idField: 'id',
      fields: [
        { name: 'course_name', label: 'ชื่อหลักสูตรอบรม', type: 'text', required: true, placeholder: 'เช่น หลักสูตรการเจรจาไกล่เกลี่ยขั้นสูง' },
        { name: 'training_date', label: 'วันที่จัดอบรม', type: 'date', required: true },
        { name: 'unit_training', label: 'หน่วยงานผู้จัด', type: 'text', placeholder: 'เช่น กรมคุ้มครองสิทธิและเสรีภาพ' },
        { name: 'location', label: 'สถานที่จัดอบรม', type: 'text' },
        { name: 'summary', label: 'ผลสรุปการอบรม', type: 'textarea' },
        { name: 'file_link', label: 'ใบเกียรติบัตร/เอกสารแนบ', type: 'file' },
        { name: 'reporter_name', label: 'ชื่อผู้บันทึก', type: 'text', required: true },
        { name: 'reporter_phone', label: 'เบอร์ติดต่อผู้บันทึก', type: 'text' },
        { name: 'source_info', label: 'ชื่อผู้ประสานงาน', type: 'text' },
        { name: 'source_contact', label: 'เบอร์ติดต่อผู้ประสานงาน', type: 'text' },
      ],
      columns: [
        { key: 'course_name', label: 'ชื่อหลักสูตร' },
        { key: 'training_date', label: 'วันที่จัด', format: (val) => new Date(val).toLocaleDateString('th-TH') },
        { key: 'unit_training', label: 'หน่วยงานผู้จัด' },
        { key: 'reporter_name', label: 'ผู้บันทึก' },
      ]
    },
    budgets: {
      title: 'การเบิกจ่ายงบประมาณ',
      table: 'budgets',
      idField: 'id',
      fields: [
        { name: 'project_name', label: 'ชื่อโครงการ/รายการเบิกจ่าย', type: 'text', required: true, placeholder: 'เช่น งบดำเนินงานประจำไตรมาสที่ 2' },
        { name: 'approval_date', label: 'วันที่อนุมัติเบิกจ่าย', type: 'date', required: true },
        { name: 'budget_amount', label: 'จำนวนงบประมาณได้รับอนุมัติ (บาท)', type: 'number', required: true },
        { name: 'end_date', label: 'วันที่เสร็จสิ้นโครงการ', type: 'date' },
        { name: 'refund_amount', label: 'จำนวนเงินงบประมาณส่งคืน (บาท)', type: 'number' },
        { name: 'summary', label: 'สรุปการเบิกจ่ายและการทำงาน', type: 'textarea' },
        { name: 'file_link', label: 'เอกสารเบิกจ่ายแนบ', type: 'file' },
        { name: 'reporter_name', label: 'ชื่อผู้บันทึก', type: 'text', required: true },
        { name: 'reporter_phone', label: 'เบอร์ติดต่อผู้บันทึก', type: 'text' },
        { name: 'source_info', label: 'ชื่อผู้ประสานงาน', type: 'text' },
        { name: 'source_contact', label: 'เบอร์ติดต่อผู้ประสานงาน', type: 'text' },
      ],
      columns: [
        { key: 'project_name', label: 'โครงการ' },
        { key: 'approval_date', label: 'วันที่อนุมัติ', format: (val) => new Date(val).toLocaleDateString('th-TH') },
        { key: 'budget_amount', label: 'งบประมาณได้รับ', format: (val) => `${parseFloat(val).toLocaleString()} บาท` },
        { key: 'reporter_name', label: 'ผู้บันทึก' },
      ]
    },
    ems_reports: {
      title: 'รายงานข้อพิพาทไกล่เกลี่ย พ.ร.บ. 2562',
      table: 'ems_reports',
      idField: 'id',
      fields: [
        { name: 'case_no', label: 'เลขคำร้อง', type: 'text', required: true, placeholder: 'เช่น กก.01/2569' },
        { name: 'start_date_mediation', label: 'วันที่รับคำร้อง', type: 'date', required: true },
        { 
          name: 'case_type', 
          label: 'ข้อพิพาท', 
          type: 'radio', 
          required: true, 
          hideLabel: true,
          options: [
            { value: 'ทางแพ่ง', label: 'ข้อพิพาททางแพ่ง' },
            { value: 'ทางอาญา', label: 'ข้อพิพาททางอาญา' }
          ] 
        },
        { 
          name: 'civil_dispute_type', 
          label: 'ประเภทข้อพิพาททางแพ่ง', 
          type: 'select', 
          required: true, 
          conditional: { field: 'case_type', showIf: 'ทางแพ่ง' },
          options: [
            { value: 'การชำระหนี้', label: 'การชำระหนี้' },
            { value: 'การใช้สิทธิเรียกร้องของลูกหนี้', label: 'การใช้สิทธิเรียกร้องของลูกหนี้' },
            { value: 'การหมั้น', label: 'การหมั้น' },
            { value: 'ขายตามตัวอย่าง ขายตามคำพรรณนา ขายเผื่อชอบ', label: 'ขายตามตัวอย่าง ขายตามคำพรรณนา ขายเผื่อชอบ' },
            { value: 'ขายทอดตลาด', label: 'ขายทอดตลาด' },
            { value: 'ขายฝาก', label: 'ขายฝาก' },
            { value: 'ความรับผิดเพื่อละเมิด', label: 'ความรับผิดเพื่อละเมิด' },
            { value: 'ค่าสินไหมทดแทนเพื่อละเมิด', label: 'ค่าสินไหมทดแทนเพื่อละเมิด' },
            { value: 'ค้ำประกัน', label: 'ค้ำประกัน' },
            { value: 'จัดการงานนอกสั่ง', label: 'จัดการงานนอกสั่ง' },
            { value: 'จ้างทำของ', label: 'จ้างทำของ' },
            { value: 'จ้างแรงงาน', label: 'จ้างแรงงาน' },
            { value: 'จำนอง', label: 'จำนอง' },
            { value: 'จำนำ', label: 'จำนำ' },
            { value: 'เช็ค', label: 'เช็ค' },
            { value: 'เช่าซื้อ', label: 'เช่าซื้อ' },
            { value: 'เช่าทรัพย์', label: 'เช่าทรัพย์' },
            { value: 'ซื้อขาย', label: 'ซื้อขาย' },
            { value: 'ตั๋วเงิน', label: 'ตั๋วเงิน' },
            { value: 'ตัวแทน', label: 'ตัวแทน' },
            { value: 'นายหน้า', label: 'นายหน้า' },
            { value: 'นิติบุคคล', label: 'นิติบุคคล' },
            { value: 'บริษัทจำกัด', label: 'บริษัทจำกัด' },
            { value: 'บัญชีเดินสะพัด', label: 'บัญชีเดินสะพัด' },
            { value: 'บุริมสิทธิ', label: 'บุริมสิทธิ' },
            { value: 'ประกันภัย', label: 'ประกันภัย' },
            { value: 'ปลดหนี้', label: 'ปลดหนี้' },
            { value: 'แปลงหนี้ใหม่', label: 'แปลงหนี้ใหม่' },
            { value: 'ฝากทรัพย์', label: 'ฝากทรัพย์' },
            { value: 'พินัยกรรม', label: 'พินัยกรรม' },
            { value: 'เพิกถอนการฉ้อฉล', label: 'เพิกถอนการฉ้อฉล' },
            { value: 'มรดก', label: 'มรดก' },
            { value: 'มัดจำและกำหนดเบี้ยปรับ', label: 'มัดจำและกำหนดเบี้ยปรับ' },
            { value: 'มูลนิธิ', label: 'มูลนิธิ' },
            { value: 'ยืม/กู้ยืมประมวลกฎหมายแพ่งและพาณิชย์', label: 'ยืม/กู้ยืมประมวลกฎหมายแพ่งและพาณิชย์' },
            { value: 'รับขน', label: 'รับขน' },
            { value: 'รับขนของ', label: 'รับขนของ' },
            { value: 'รับคนโดยสาร', label: 'รับคนโดยสาร' },
            { value: 'รับช่วงสิทธิ', label: 'รับช่วงสิทธิ' },
            { value: 'ละเมิด', label: 'ละเมิด' },
            { value: 'ลาภมิควรได้', label: 'ลาภมิควรได้' },
            { value: 'แลกเปลี่ยน', label: 'แลกเปลี่ยน' },
            { value: 'สมาคม', label: 'สมาคม' },
            { value: 'สัญญา', label: 'สัญญา' },
            { value: 'สิทธิยึดหน่วง', label: 'สิทธิยึดหน่วง' },
            { value: 'หนี้', label: 'หนี้' },
            { value: 'หนี้เกลื่อนกลืนกัน', label: 'หนี้เกลื่อนกลืนกัน' },
            { value: 'หักกลบลบหนี้', label: 'หักกลบลบหนี้' },
            { value: 'ห้างหุ้นส่วนสามัญ', label: 'ห้างหุ้นส่วนสามัญ' },
            { value: 'ให้', label: 'ให้' },
            { value: 'โอนสิทธิเรียกร้อง', label: 'โอนสิทธิเรียกร้อง' }
          ]
        },
        { name: 'value_in_dispute', label: 'จำนวนทุนทรัพย์', type: 'number', placeholder: 'ใส่ 0 หากไม่มีทุนทรัพย์' },
        { 
          name: 'case_final', 
          label: 'ผลการไกล่เกลี่ย', 
          type: 'radio', 
          required: true, 
          hideLabel: true,
          options: [
            { value: 'จำหน่าย', label: 'จำหน่าย' },
            { value: 'ยุติ', label: 'ยุติ' },
            { value: 'ตกลงกันไม่ได้', label: 'ตกลงกันไม่ได้' },
            { value: 'ตกลงกันได้', label: 'ตกลงกันได้' }
          ] 
        },
        { name: 'summary', label: 'สรุปสาระสำคัญ', type: 'textarea', placeholder: 'สรุปสาระสำคัญของการไกล่เกลี่ย' },
        { name: 'reporter_name', label: 'ชื่อผู้รายงาน/ผู้บันทึก', type: 'text', required: true },
        { 
          name: 'reporter_phone', 
          label: 'เบอร์โทรศัพท์ผู้บันทึก', 
          type: 'text', 
          required: true, 
          placeholder: 'เช่น 0812345678',
          pattern: '^0[0-9]{8,9}$',
          title: 'กรุณากรอกเบอร์โทรศัพท์ให้ถูกต้อง (เช่น 0812345678)' 
        },
        { name: 'file_link', label: 'แนบไฟล์เอกสาร (PDF)', type: 'file' }
      ],
      columns: [
        { key: 'case_no', label: 'เลขคำร้อง' },
        { key: 'case_type', label: 'ข้อพิพาท' },
        { key: 'value_in_dispute', label: 'ทุนทรัพย์', format: (val) => val ? `${parseFloat(val).toLocaleString()} บาท` : '0 บาท' },
        { key: 'case_final', label: 'ผลการไกล่เกลี่ย' },
        { key: 'reporter_name', label: 'ผู้รายงาน' },
      ]
    },
    other_laws_reports: {
      title: 'รายงานข้อพิพาทกฎหมายอื่นๆ',
      table: 'other_laws_reports',
      idField: 'id',
      fields: [
        { name: 'report_date', label: 'วันที่บันทึกรายงาน', type: 'date', required: true },
        { name: 'dispute_type', label: 'ประเภทข้อพิพาท (กฎหมายอื่น)', type: 'text', placeholder: 'เช่น กฎหมายครอบครัว, ที่ทำกินในชุมชน' },
        { name: 'details', label: 'รายละเอียดปัญหา/ข้อพิพาท', type: 'textarea' },
        { name: 'action_type', label: 'การดำเนินการเบื้องต้น', type: 'select', required: true, options: [
          { value: 'ให้ข้อแนะนำ', label: 'ให้คำแนะนำทางกฎหมายเบื้องต้น' },
          { value: 'ประสานส่งต่อ', label: 'ประสานส่งต่อหน่วยงานภายนอก' }
        ]},
        { name: 'action_detail', label: 'รายละเอียดคำแนะนำ / หน่วยงานส่งต่อ', type: 'text', placeholder: 'ระบุรายละเอียดคำแนะนำ หรือ หน่วยงานปลายทาง' },
        { name: 'file_link', label: 'รูปภาพ/เอกสารแนบ', type: 'file' },
        { name: 'reporter_name', label: 'ชื่อผู้บันทึก', type: 'text', required: true },
        { name: 'reporter_phone', label: 'เบอร์ติดต่อผู้บันทึก', type: 'text' },
        { name: 'source_info', label: 'ชื่อผู้ประสานงาน', type: 'text' },
        { name: 'source_contact', label: 'เบอร์ติดต่อผู้ประสานงาน', type: 'text' },
      ],
      columns: [
        { key: 'dispute_type', label: 'ข้อพิพาท' },
        { key: 'report_date', label: 'วันที่บันทึก', format: (val) => new Date(val).toLocaleDateString('th-TH') },
        { key: 'action_type', label: 'การดำเนินการ' },
        { key: 'reporter_name', label: 'ผู้บันทึก' },
      ]
    },
    zero_reports: {
      title: 'รายงานไม่มีผลการดำเนินงาน',
      table: 'zero_reports',
      idField: 'id',
      fields: [
        { name: 'month', label: 'รายงานของรอบเดือน', type: 'select', required: true, options: [
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
        ]},
        { name: 'year', label: 'ปี พ.ศ.', type: 'text', required: true, placeholder: 'เช่น 2569' },
        { name: 'reporter_name', label: 'ชื่อผู้รายงานตัวจริง', type: 'text', required: true },
        { name: 'reporter_position', label: 'ตำแหน่งในศูนย์ไกล่เกลี่ย', type: 'select', required: true, options: [
          { value: 'ประธานคณะทำงาน', label: 'ประธานคณะทำงาน' },
          { value: 'รองประธานคณะทำงาน', label: 'รองประธานคณะทำงาน' },
          { value: 'เหรัญญิกและคณะทำงาน', label: 'เหรัญญิกและคณะทำงาน' },
          { value: 'เลขานุการและคณะทำงาน', label: 'เลขานุการและคณะทำงาน' },
          { value: 'คณะทำงาน', label: 'คณะทำงาน' }
        ]},
        { name: 'reporter_phone', label: 'เบอร์โทรศัพท์ติดต่อ', type: 'text', required: true },
      ],
      columns: [
        { key: 'month', label: 'รอบเดือน', format: (val) => ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'][parseInt(val) - 1] },
        { key: 'year', label: 'ปี พ.ศ.' },
        { key: 'reporter_name', label: 'ชื่อผู้รายงาน' },
        { key: 'reporter_position', label: 'ตำแหน่ง' }
      ]
    }
  };

  const activeConfig = configs[category];

  useEffect(() => {
    if (activeConfig && user && profile) {
      fetchData();
    }
  }, [category, currentPage, searchTerm, user, profile]);

  if (!activeConfig) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="mx-auto h-12 w-12 text-red-500 mb-4" />
        <h2 className="text-lg font-bold text-white">เกิดข้อผิดพลาดในการโหลดหน้าเว็บ</h2>
        <p className="text-slate-400 mt-2">ไม่พบหมวดหมู่รายงาน "{category}" ในระบบ</p>
        <Link href="/dashboard" className="inline-flex items-center gap-2 mt-6 px-4 py-2 bg-slate-800 text-white rounded-xl text-xs hover:bg-slate-700">
          <ArrowLeft className="h-4 w-4" />
          <span>กลับสู่หน้าหลัก</span>
        </Link>
      </div>
    );
  }

  const fetchData = async () => {
    setLoading(true);
    try {
      const role = profile?.role || 'user';
      const myProvince = profile?.province;
      
      let query = supabase
        .from(activeConfig.table)
        .select('*, profiles!inner(*)', { count: 'exact' });

      // Apply province filter for subadmins, own data filter for normal users
      if (role === 'subadmin' && myProvince) {
        query = query.eq('profiles.province', myProvince);
      } else if (role === 'user') {
        query = query.eq('user_id', user?.id);
      }

      // Soft delete filter
      query = query.eq('status', 'Active');

      // Search term filter
      if (searchTerm) {
        // Simple search in major text fields or owner's name
        if (category === 'meetings') {
          query = query.ilike('meeting_name', `%${searchTerm}%`);
        } else if (category === 'plans') {
          query = query.ilike('title', `%${searchTerm}%`);
        } else if (category === 'activities') {
          query = query.ilike('activity_name', `%${searchTerm}%`);
        } else if (category === 'trainings') {
          query = query.ilike('course_name', `%${searchTerm}%`);
        } else if (category === 'budgets') {
          query = query.ilike('project_name', `%${searchTerm}%`);
        } else if (category === 'ems_reports') {
          query = query.ilike('case_no', `%${searchTerm}%`);
        } else if (category === 'other_laws_reports') {
          query = query.ilike('dispute_type', `%${searchTerm}%`);
        } else if (category === 'zero_reports') {
          query = query.ilike('reporter_name', `%${searchTerm}%`);
        }
      }

      // Pagination calculation
      const from = (currentPage - 1) * pageSize;
      const to = from + pageSize - 1;

      // Sort by created_at or timestamp descending
      query = query.order('created_at', { ascending: false }).range(from, to);

      const { data, count, error } = await query;

      if (error) {
        throw error;
      }

      setItems(data || []);
      setTotalItems(count || 0);
      setTotalPages(Math.ceil((count || 0) / pageSize));

    } catch (e: any) {
      console.error('Error fetching data:', e);
      Swal.fire('Error', 'ไม่สามารถเชื่อมต่อดึงข้อมูลได้: ' + e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      // 1. Generate unique file name
      const fileExt = file.name.split('.').pop();
      const fileName = `${category}_${Date.now()}.${fileExt}`;
      const filePath = `${user?.id}/${fileName}`;

      // 2. Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from('documents')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (error) {
        throw error;
      }

      // 3. Get Public URL
      const { data: { publicUrl } } = supabase.storage
        .from('documents')
        .getPublicUrl(filePath);

      setUploadedFileUrl(publicUrl);
      setUploadedFileName(file.name);
      setFormData((prev: any) => ({ ...prev, file_link: publicUrl }));

      Swal.fire({
        icon: 'success',
        title: 'อัปโหลดไฟล์สำเร็จ',
        timer: 1000,
        showConfirmButton: false
      });

    } catch (err: any) {
      console.error('Storage upload error:', err);
      Swal.fire('Upload Failed', 'ไม่สามารถอัปโหลดไฟล์ได้: ' + err.message, 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleMultipleFilesUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      const newUrls: string[] = [];
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        // 1. Generate unique file name
        const fileExt = file.name.split('.').pop();
        const fileName = `${category}_${Date.now()}_${i}.${fileExt}`;
        const filePath = `${user?.id}/${fileName}`;

        // 2. Upload to Supabase Storage
        const { error } = await supabase.storage
          .from('documents')
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: true
          });

        if (error) throw error;

        // 3. Get Public URL
        const { data: { publicUrl } } = supabase.storage
          .from('documents')
          .getPublicUrl(filePath);

        newUrls.push(publicUrl);
      }

      // Append to existing file_links
      const currentLinks = formData.file_link ? formData.file_link.split(',') : [];
      const updatedLinks = [...currentLinks, ...newUrls].filter(Boolean).join(',');

      setFormData((prev: any) => ({ ...prev, file_link: updatedLinks }));

      Swal.fire({
        icon: 'success',
        title: `อัปโหลดสำเร็จ ${files.length} ไฟล์`,
        timer: 1500,
        showConfirmButton: false
      });

    } catch (err: any) {
      console.error('Storage upload error:', err);
      Swal.fire('Upload Failed', 'ไม่สามารถอัปโหลดไฟล์ได้บางไฟล์: ' + err.message, 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteUploadedFile = (urlToDelete: string) => {
    const currentLinks = formData.file_link ? formData.file_link.split(',') : [];
    const updatedLinks = currentLinks.filter((url: string) => url !== urlToDelete).join(',');
    setFormData((prev: any) => ({ ...prev, file_link: updatedLinks }));
  };

  const handleOpenAddModal = () => {
    setEditingId(null);
    setUploadedFileUrl('');
    setUploadedFileName('');
    
    // Set default values (e.g. reporter_name from profile)
    const initialForm: any = {
      reporter_name: profile?.name || '',
      reporter_phone: profile?.phone || '',
    };
    
    activeConfig.fields.forEach(field => {
      if (field.type === 'select' && field.options) {
        initialForm[field.name] = field.options[0].value;
      }
    });

    if (category === 'ems_reports') {
      initialForm.case_type = 'ทางแพ่ง';
      initialForm.civil_dispute_type = 'การชำระหนี้';
    }

    setFormData(initialForm);
    setModalOpen(true);
  };

  const handleOpenEditModal = (item: any) => {
    setEditingId(item.id);
    
    let initialForm = { ...item };
    if (category === 'ems_reports' && item.case_type) {
      if (item.case_type.startsWith('ทางแพ่ง (')) {
        const civilType = item.case_type.replace('ทางแพ่ง (', '').replace(')', '');
        initialForm.case_type = 'ทางแพ่ง';
        initialForm.civil_dispute_type = civilType;
      } else if (item.case_type.startsWith('ทางแพ่ง')) {
        initialForm.case_type = 'ทางแพ่ง';
        initialForm.civil_dispute_type = 'การชำระหนี้';
      } else {
        initialForm.case_type = item.case_type;
        initialForm.civil_dispute_type = '';
      }
    }
    setFormData(initialForm);
    
    if (item.file_link) {
      setUploadedFileUrl(item.file_link);
      const urlParts = item.file_link.split('/');
      setUploadedFileName(urlParts[urlParts.length - 1] || 'เอกสารแนบเดิม');
    } else {
      setUploadedFileUrl('');
      setUploadedFileName('');
    }

    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const payload = {
        ...formData,
        user_id: editingId ? formData.user_id : user?.id,
        status: 'Active'
      };

      // Clean joined profiles fields from payload
      delete payload.profiles;

      if (category === 'ems_reports') {
        // Combine case_type and civil_dispute_type into case_type column
        if (payload.case_type === 'ทางแพ่ง') {
          payload.case_type = `ทางแพ่ง (${payload.civil_dispute_type || 'การชำระหนี้'})`;
        }
        // Remove civil_dispute_type so it doesn't cause Supabase error
        delete payload.civil_dispute_type;
      }

      let responseError = null;

      if (editingId) {
        // Update record
        const { error } = await supabase
          .from(activeConfig.table)
          .update(payload)
          .eq('id', editingId);
        responseError = error;
      } else {
        // Insert record
        const { error } = await supabase
          .from(activeConfig.table)
          .insert([payload]);
        responseError = error;
      }

      if (responseError) throw responseError;

      Swal.fire({
        icon: 'success',
        title: editingId ? 'บันทึกการแก้ไขสำเร็จ' : 'เพิ่มข้อมูลสำเร็จ',
        timer: 1500,
        showConfirmButton: false
      });

      setModalOpen(false);
      fetchData();

    } catch (err: any) {
      console.error(err);
      Swal.fire('Error', 'เกิดข้อผิดพลาดในการบันทึก: ' + err.message, 'error');
      setLoading(false);
    }
  };

  const handleDelete = (id: string) => {
    Swal.fire({
      title: 'ต้องการลบข้อมูลนี้หรือไม่?',
      text: 'ข้อมูลที่ถูกลบจะไม่แสดงผลในระบบ แต่อาจกู้คืนได้โดยผู้ดูแลระบบ',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#f43f5e',
      cancelButtonColor: '#475569',
      confirmButtonText: 'ใช่, ต้องการลบ',
      cancelButtonText: 'ยกเลิก'
    }).then(async (result) => {
      if (result.isConfirmed) {
        setLoading(true);
        try {
          // Soft delete
          const { error } = await supabase
            .from(activeConfig.table)
            .update({ status: 'Deleted' })
            .eq('id', id);

          if (error) throw error;

          Swal.fire('Deleted!', 'ลบข้อมูลสำเร็จ', 'success');
          fetchData();
        } catch (err: any) {
          console.error(err);
          Swal.fire('Error', 'เกิดข้อผิดพลาดในการลบ: ' + err.message, 'error');
          setLoading(false);
        }
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Link href="/dashboard" className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <span>ข้อมูลโมดูล: {activeConfig.title}</span>
          </h1>
          <p className="text-xs text-slate-400 font-light mt-1 pl-9">จัดการประวัติการรายงาน และบันทึกข้อมูลประจำศูนย์ไกล่เกลี่ย</p>
        </div>

        <button
          onClick={handleOpenAddModal}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold cursor-pointer transition-colors shadow-lg shadow-indigo-600/10 hover:shadow-indigo-600/20"
        >
          <Plus className="h-4 w-4" />
          <span>บันทึกข้อมูลเพิ่ม</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-slate-900 border border-slate-800/80 p-4 rounded-2xl flex flex-col sm:flex-row items-center gap-4">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-500" />
          <input
            type="text"
            placeholder="ค้นหาประวัติ..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full bg-slate-950/60 border border-slate-800 rounded-xl py-2 pl-10 pr-4 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-all"
          />
        </div>
        
        <div className="text-xs text-slate-400 shrink-0 font-medium">
          ผลลัพธ์การสืบค้น: <span className="text-white font-bold">{totalItems}</span> รายการ
        </div>
      </div>

      {/* Main Table view */}
      <div className="bg-slate-900 border border-slate-800/80 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="py-24 flex flex-col items-center justify-center text-slate-400">
            <Loader2 className="animate-spin h-8 w-8 text-indigo-500 mb-3" />
            <span className="text-xs">กำลังสแกนหาข้อมูล...</span>
          </div>
        ) : items.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-950 border-b border-slate-800 text-slate-400 font-medium">
                  {profile?.role !== 'user' && <th className="p-4">จังหวัด</th>}
                  {activeConfig.columns.map(col => (
                    <th key={col.key} className="p-4">{col.label}</th>
                  ))}
                  <th className="p-4 text-center">ดาวน์โหลดไฟล์</th>
                  <th className="p-4 text-right">ดำเนินการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-800/20 text-slate-200 transition-colors">
                    {profile?.role !== 'user' && (
                      <td className="p-4 text-indigo-400 font-semibold">{item.profiles?.province || 'ส่วนกลาง'}</td>
                    )}
                    {activeConfig.columns.map(col => (
                      <td key={col.key} className="p-4">
                        {col.format ? col.format(item[col.key]) : item[col.key] || '-'}
                      </td>
                    ))}
                    <td className="p-4 text-center">
                      {item.file_link ? (
                        <div className="flex flex-col gap-1 items-center">
                          {item.file_link.split(',').map((link: string, idx: number) => {
                            const fileName = link.split('/').pop() || `เอกสาร ${idx + 1}`;
                            const cleanName = fileName.includes('_') ? fileName.split('_').slice(1).join('_') : fileName;
                            return (
                              <a
                                key={idx}
                                href={link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-slate-800 hover:bg-indigo-500/10 text-indigo-400 hover:text-indigo-300 rounded border border-slate-700 hover:border-indigo-500/20 transition-all font-medium text-[10px] max-w-[120px] truncate"
                                title={cleanName}
                              >
                                <Download className="h-2.5 w-2.5 shrink-0" />
                                <span className="truncate">{cleanName}</span>
                              </a>
                            );
                          })}
                        </div>
                      ) : (
                        <span className="text-slate-600 text-[10px] font-light">ไม่มีไฟล์</span>
                      )}
                    </td>
                    <td className="p-4 text-right space-x-2">
                      <button
                        onClick={() => handleOpenEditModal(item)}
                        className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
                        title="แก้ไข"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(item.id)}
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

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between p-4 border-t border-slate-800 bg-slate-950/20">
                <span className="text-[11px] text-slate-400 font-light">หน้า {currentPage} จาก {totalPages}</span>
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
          <div className="py-24 flex flex-col items-center justify-center text-slate-500 text-xs">
            <FileText className="h-10 w-10 mb-2 text-slate-600" />
            <span>ไม่พบประวัติการรายงานบันทึกในระบบในขณะนี้</span>
          </div>
        )}
      </div>

      {/* Sliding Slide-over/Modal Panel to Add/Edit */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-slate-900 border-l border-slate-800 h-full flex flex-col shadow-2xl animate-slideIn">
            {/* Modal Header */}
            <div className="flex h-20 items-center justify-between px-6 border-b border-slate-800/80 bg-slate-950/20">
              <div>
                <h3 className="font-semibold text-white text-sm">
                  {editingId ? 'แก้ไขประวัติรายงาน' : `บันทึกข้อมูล ${activeConfig.title}`}
                </h3>
                <p className="text-[10px] text-slate-400 mt-1 font-light">ป้อนรายละเอียดให้ครบถ้วนเพื่อจัดทำฐานข้อมูลสรุป</p>
              </div>
              <button 
                onClick={() => setModalOpen(false)}
                className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Form Content */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5 text-xs text-slate-300">
              
              {/* AI Auto-fill helper box */}
              {activeConfig.fields && activeConfig.fields.length > 0 && (
                <div className="bg-gradient-to-br from-slate-900 to-indigo-950/40 border border-indigo-500/20 rounded-2xl p-4 space-y-3 relative overflow-hidden shadow-lg shadow-indigo-950/5">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-xl pointer-events-none" />
                  
                  <div className="space-y-3">
                    <div className="flex flex-col items-center justify-center p-4 bg-slate-950/40 rounded-xl border border-slate-800/80 space-y-2 relative overflow-hidden">
                      {isListening ? (
                        <button
                          type="button"
                          onClick={stopListening}
                          className="w-14 h-14 bg-rose-500 hover:bg-rose-600 text-white rounded-full flex items-center justify-center cursor-pointer transition-all shadow-lg shadow-rose-500/30 relative"
                          title="หยุดบันทึกเสียง"
                        >
                          <span className="absolute inset-0 rounded-full bg-rose-500/30 animate-ping" />
                          <Mic className="h-6 w-6 animate-pulse" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={startListening}
                          className="w-14 h-14 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full flex items-center justify-center cursor-pointer transition-all shadow-lg shadow-indigo-600/30 hover:scale-105"
                          title="เริ่มพูดบรรยายรายละเอียด"
                        >
                          <Mic className="h-6 w-6" />
                        </button>
                      )}
                      
                      <span className="text-[9px] font-semibold text-slate-405">
                        {isListening ? "🔴 กำลังฟังเสียงพูดของคุณ..." : "🎤 กดเพื่อพูดเล่าเรื่อง (อ่านสคริป) ทั้งหมด"}
                      </span>

                      <textarea
                        rows={5}
                        placeholder="ข้อความที่ถอดความได้ จะปรากฏตรงนี้ และคุณสามารถพิมพ์แก้ไขเพิ่มเติมได้..."
                        value={aiStoryText}
                        onChange={(e) => setAiStoryText(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800/80 rounded-xl py-2 px-3 text-[10px] text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-all resize-y min-h-[120px] mt-1"
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
              )}

              {activeConfig.fields.map(field => {
                // Render conditional logic if available
                if (field.conditional && formData[field.conditional.field] !== field.conditional.showIf) {
                  return null;
                }

                return (
                  <div key={field.name} className="space-y-1.5">
                    {!field.hideLabel && (
                      <label className="block text-slate-400 font-medium">
                        {field.label} {field.required && <span className="text-red-500">*</span>}
                      </label>
                    )}

                    {field.type === 'text' && (
                      <div className="relative flex items-center">
                        <input
                          type="text"
                          placeholder={field.placeholder}
                          value={formData[field.name] || ''}
                          onChange={(e) => setFormData((prev: any) => ({ ...prev, [field.name]: e.target.value }))}
                          pattern={field.pattern}
                          title={field.title}
                          className={`w-full bg-slate-950 border rounded-xl py-2 px-3 pr-9 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-all text-xs ${
                            highlightFields[field.name] 
                              ? 'border-indigo-500/80 bg-indigo-500/5 ring-1 ring-indigo-500/30 animate-pulse' 
                              : activeVoiceField === field.name
                                ? 'border-rose-500 bg-rose-500/5 ring-1 ring-rose-500/30'
                                : 'border-slate-800'
                          }`}
                          required={field.required}
                        />
                        <button
                          type="button"
                          onClick={() => toggleFieldVoice(field.name)}
                          className={`absolute right-2.5 p-1 rounded-md transition-all cursor-pointer ${
                            activeVoiceField === field.name
                              ? 'text-rose-400 bg-rose-500/10 animate-pulse'
                              : 'text-slate-500 hover:text-slate-300'
                          }`}
                          title="พูดเพื่อป้อนข้อมูล"
                        >
                          {activeVoiceField === field.name ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    )}

                    {field.type === 'number' && (
                      <div className="relative flex items-center">
                        <input
                          type="number"
                          placeholder={field.placeholder}
                          value={formData[field.name] || ''}
                          onChange={(e) => setFormData((prev: any) => ({ ...prev, [field.name]: e.target.value }))}
                          className={`w-full bg-slate-950 border rounded-xl py-2 px-3 pr-9 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-all text-xs ${
                            highlightFields[field.name] 
                              ? 'border-indigo-500/80 bg-indigo-500/5 ring-1 ring-indigo-500/30 animate-pulse' 
                              : activeVoiceField === field.name
                                ? 'border-rose-500 bg-rose-500/5 ring-1 ring-rose-500/30'
                                : 'border-slate-800'
                          }`}
                          required={field.required}
                        />
                        <button
                          type="button"
                          onClick={() => toggleFieldVoice(field.name)}
                          className={`absolute right-2.5 p-1 rounded-md transition-all cursor-pointer ${
                            activeVoiceField === field.name
                              ? 'text-rose-400 bg-rose-500/10 animate-pulse'
                              : 'text-slate-500 hover:text-slate-300'
                          }`}
                          title="พูดเพื่อป้อนข้อมูล"
                        >
                          {activeVoiceField === field.name ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    )}

                    {field.type === 'date' && (
                      <input
                        type="date"
                        value={formData[field.name] || ''}
                        onChange={(e) => setFormData((prev: any) => ({ ...prev, [field.name]: e.target.value }))}
                        className={`w-full bg-slate-950 border rounded-xl py-2 px-3 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-all text-xs ${
                          highlightFields[field.name] 
                            ? 'border-indigo-500/80 bg-indigo-500/5 ring-1 ring-indigo-500/30 animate-pulse' 
                            : 'border-slate-800'
                        }`}
                        required={field.required}
                      />
                    )}

                    {field.type === 'textarea' && (
                      <div className="relative flex items-start">
                        <textarea
                          rows={4}
                          placeholder={field.placeholder}
                          value={formData[field.name] || ''}
                          onChange={(e) => setFormData((prev: any) => ({ ...prev, [field.name]: e.target.value }))}
                          className={`w-full bg-slate-950 border rounded-xl py-2 px-3 pr-9 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-all text-xs ${
                            highlightFields[field.name] 
                              ? 'border-indigo-500/80 bg-indigo-500/5 ring-1 ring-indigo-500/30 animate-pulse' 
                              : activeVoiceField === field.name
                                ? 'border-rose-500 bg-rose-500/5 ring-1 ring-rose-500/30'
                                : 'border-slate-800'
                          }`}
                          required={field.required}
                        />
                        <button
                          type="button"
                          onClick={() => toggleFieldVoice(field.name)}
                          className={`absolute right-2.5 top-2.5 p-1 rounded-md transition-all cursor-pointer ${
                            activeVoiceField === field.name
                              ? 'text-rose-400 bg-rose-500/10 animate-pulse'
                              : 'text-slate-500 hover:text-slate-300'
                          }`}
                          title="พูดเพื่อป้อนข้อมูล"
                        >
                          {activeVoiceField === field.name ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    )}

                    {field.type === 'radio' && field.options && (
                      <div className="flex flex-wrap gap-4 items-center py-1">
                        {field.options.map(opt => (
                          <label key={opt.value} className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer hover:text-white select-none">
                            <input
                              type="radio"
                              name={field.name}
                              value={opt.value}
                              checked={formData[field.name] === opt.value}
                              onChange={() => setFormData((prev: any) => ({ ...prev, [field.name]: opt.value }))}
                              className="w-4 h-4 border border-slate-800 rounded-full text-indigo-600 bg-slate-950 focus:ring-indigo-500 focus:ring-offset-slate-950 focus:outline-none transition-all cursor-pointer accent-indigo-500"
                              required={field.required}
                            />
                            <span>{opt.label}</span>
                          </label>
                        ))}
                      </div>
                    )}

                    {field.type === 'select' && field.options && (
                      <select
                        value={formData[field.name] || ''}
                        onChange={(e) => setFormData((prev: any) => ({ ...prev, [field.name]: e.target.value }))}
                        className={`w-full bg-slate-950 border rounded-xl py-2 px-3 text-white focus:outline-none focus:border-indigo-500 transition-all text-xs cursor-pointer ${
                          highlightFields[field.name] 
                            ? 'border-indigo-500/80 bg-indigo-500/5 ring-1 ring-indigo-500/30 animate-pulse' 
                            : 'border-slate-800'
                        }`}
                        required={field.required}
                      >
                        {field.options.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    )}

                    {field.type === 'file' && (
                      <div className="bg-slate-950 border border-dashed border-slate-800 rounded-xl p-4 flex flex-col items-center">
                        <Upload className="h-6 w-6 text-slate-500 mb-2" />
                        
                        {category === 'ems_reports' ? (
                          <div className="w-full space-y-3">
                            {formData.file_link ? (
                              <div className="space-y-2">
                                {formData.file_link.split(',').map((link: string, idx: number) => {
                                  const fileName = link.split('/').pop() || `ไฟล์ ${idx + 1}`;
                                  const cleanName = fileName.includes('_') ? fileName.split('_').slice(1).join('_') : fileName;
                                  return (
                                    <div key={idx} className="flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 p-2 rounded-lg w-full justify-between text-[10px]">
                                      <span className="truncate max-w-[220px]" title={cleanName}>{cleanName}</span>
                                      <div className="flex gap-2.5 shrink-0">
                                        <a href={link} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">ดูไฟล์</a>
                                        <button
                                          type="button"
                                          onClick={() => handleDeleteUploadedFile(link)}
                                          className="text-rose-400 hover:text-rose-300 transition-colors"
                                        >
                                          ลบ
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : null}

                            <div className="flex flex-col items-center pt-2">
                              <input
                                type="file"
                                id="file-upload-multi"
                                className="hidden"
                                multiple
                                accept=".pdf"
                                onChange={handleMultipleFilesUpload}
                                disabled={uploading}
                              />
                              <label
                                htmlFor="file-upload-multi"
                                className="cursor-pointer bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[10px] text-slate-300 font-semibold px-3 py-1.5 rounded-lg hover:text-white transition-colors"
                              >
                                {uploading ? 'กำลังอัปโหลด...' : 'เลือกไฟล์ PDF เพิ่ม (อัปโหลดได้หลายไฟล์)'}
                              </label>
                              <span className="text-[10px] text-slate-600 mt-1.5 font-light">รองรับเฉพาะไฟล์ PDF เท่านั้น</span>
                            </div>
                          </div>
                        ) : (
                          uploadedFileUrl ? (
                            <div className="flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 p-2.5 rounded-lg w-full max-w-xs justify-between">
                              <span className="truncate max-w-[180px] text-[10px]">{uploadedFileName}</span>
                              <button
                                type="button"
                                onClick={() => {
                                  setUploadedFileUrl('');
                                  setUploadedFileName('');
                                  setFormData((prev: any) => ({ ...prev, file_link: '' }));
                                }}
                                className="text-indigo-400 hover:text-red-400 transition-colors"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center">
                              <input
                                type="file"
                                id="file-upload"
                                className="hidden"
                                onChange={handleFileUpload}
                                disabled={uploading}
                              />
                              <label
                                htmlFor="file-upload"
                                className="cursor-pointer bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[10px] text-slate-300 font-semibold px-3 py-1.5 rounded-lg hover:text-white transition-colors"
                              >
                                {uploading ? 'กำลังอัปโหลด...' : 'เลือกไฟล์อัปโหลด'}
                              </label>
                              <span className="text-[10px] text-slate-600 mt-1.5 font-light">ขนาดจำกัด 10MB (ไฟล์ PDF หรือ รูปภาพ)</span>
                            </div>
                          )
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Modal Actions */}
              <div className="pt-6 border-t border-slate-800/60 flex justify-end gap-3 bg-slate-900/80 sticky bottom-0">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl font-medium cursor-pointer transition-colors"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl font-semibold cursor-pointer transition-colors flex items-center gap-2"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="animate-spin h-4 w-4" />
                      <span>อัปโหลดไฟล์ค้างไว้...</span>
                    </>
                  ) : (
                    <span>บันทึกส่งข้อมูล</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
