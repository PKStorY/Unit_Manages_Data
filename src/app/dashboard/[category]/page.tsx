'use client';

import React, { useState, useEffect, use } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { 
  Plus, Edit, Trash2, Search, ArrowLeft, Upload, FileText, CheckCircle, 
  AlertCircle, Download, Loader2, ChevronLeft, ChevronRight, X
} from 'lucide-react';
import Swal from 'sweetalert2';
import Link from 'next/link';

interface CategoryConfig {
  title: string;
  table: string;
  idField: string;
  fields: {
    name: string;
    label: string;
    type: 'text' | 'number' | 'date' | 'select' | 'textarea' | 'file';
    placeholder?: string;
    options?: { value: string; label: string }[];
    required?: boolean;
    conditional?: { field: string; showIf: string };
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
        { name: 'case_no', label: 'เลขที่คำร้อง/คดีไกล่เกลี่ย', type: 'text', required: true, placeholder: 'เช่น กก.01/2569' },
        { name: 'start_date_mediation', label: 'วันที่เริ่มไกล่เกลี่ย', type: 'date', required: true },
        { name: 'case_type', label: 'ประเภทคดี/ข้อพิพาท', type: 'select', required: true, options: [
          { value: 'แพ่ง (กู้ยืมเงิน)', label: 'แพ่ง (กู้ยืมเงิน)' },
          { value: 'แพ่ง (ที่ดิน/มรดก)', label: 'แพ่ง (ที่ดิน/มรดก)' },
          { value: 'อาญา (ลักทรัพย์)', label: 'อาญา (ลักทรัพย์)' },
          { value: 'อาญา (ทำร้ายร่างกาย)', label: 'อาญา (ทำร้ายร่างกาย)' },
          { value: 'ครอบครัว/มรดก', label: 'ครอบครัว/มรดก' },
          { value: 'อื่นๆ', label: 'อื่นๆ' },
        ]},
        { name: 'case_status', label: 'สถานะขั้นตอนคดี', type: 'text', placeholder: 'เช่น อยู่ระหว่างไกล่เกลี่ย หรือ เสร็จสิ้นการไกล่เกลี่ย' },
        { name: 'value_in_dispute', label: 'ทุนทรัพย์ข้อพิพาท (บาท)', type: 'number', placeholder: 'ใส่ 0 หากไม่มีทุนทรัพย์' },
        { name: 'end_date_mediation', label: 'วันที่สิ้นสุดการไกล่เกลี่ย', type: 'date' },
        { name: 'case_final', label: 'ผลสรุปการไกล่เกลี่ย', type: 'select', required: true, options: [
          { value: 'ตกลงกันได้', label: 'ตกลงกันได้ (ทำบันทึกข้อตกลง)' },
          { value: 'ตกลงกันไม่ได้', label: 'ตกลงกันไม่ได้ (ยุติเรื่อง)' },
          { value: 'อื่นๆ/ถอนคำร้อง', label: 'อื่นๆ/ถอนคำร้อง' }
        ]},
        { name: 'summary', label: 'ข้อสรุปการพิจารณาคดี', type: 'textarea' },
        { name: 'file_link', label: 'ไฟล์เอกสารบันทึกข้อตกลงแนบ', type: 'file' },
        { name: 'reporter_name', label: 'ชื่อผู้บันทึก', type: 'text', required: true },
        { name: 'reporter_phone', label: 'เบอร์ติดต่อผู้บันทึก', type: 'text' },
        { name: 'source_info', label: 'ชื่อผู้ประสานงาน', type: 'text' },
        { name: 'source_contact', label: 'เบอร์ติดต่อผู้ประสานงาน', type: 'text' },
      ],
      columns: [
        { key: 'case_no', label: 'เลขคดี' },
        { key: 'case_type', label: 'ประเภทคดี' },
        { key: 'value_in_dispute', label: 'ทุนทรัพย์', format: (val) => `${parseFloat(val).toLocaleString()} บาท` },
        { key: 'case_final', label: 'ผลการไกล่เกลี่ย' },
        { key: 'reporter_name', label: 'ผู้บันทึก' },
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
        { name: 'reporter_position', label: 'ตำแหน่งในศูนย์ไกล่เกลี่ย', type: 'text', required: true, placeholder: 'เช่น ประธานศูนย์ฯ หรือ เลขานุการ' },
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

    setFormData(initialForm);
    setModalOpen(true);
  };

  const handleOpenEditModal = (item: any) => {
    setEditingId(item.id);
    setFormData(item);
    
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
                        <a
                          href={item.file_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-800 hover:bg-indigo-500/10 text-indigo-400 hover:text-indigo-300 rounded border border-slate-700 hover:border-indigo-500/20 transition-all font-medium text-[10px]"
                        >
                          <Download className="h-3 w-3" />
                          <span>ดูเอกสาร</span>
                        </a>
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
              {activeConfig.fields.map(field => {
                // Render conditional logic if available
                if (field.conditional && formData[field.conditional.field] !== field.conditional.showIf) {
                  return null;
                }

                return (
                  <div key={field.name} className="space-y-1.5">
                    <label className="block text-slate-400 font-medium">
                      {field.label} {field.required && <span className="text-red-500">*</span>}
                    </label>

                    {field.type === 'text' && (
                      <input
                        type="text"
                        placeholder={field.placeholder}
                        value={formData[field.name] || ''}
                        onChange={(e) => setFormData((prev: any) => ({ ...prev, [field.name]: e.target.value }))}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-all text-xs"
                        required={field.required}
                      />
                    )}

                    {field.type === 'number' && (
                      <input
                        type="number"
                        placeholder={field.placeholder}
                        value={formData[field.name] || ''}
                        onChange={(e) => setFormData((prev: any) => ({ ...prev, [field.name]: e.target.value }))}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-all text-xs"
                        required={field.required}
                      />
                    )}

                    {field.type === 'date' && (
                      <input
                        type="date"
                        value={formData[field.name] || ''}
                        onChange={(e) => setFormData((prev: any) => ({ ...prev, [field.name]: e.target.value }))}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-all text-xs"
                        required={field.required}
                      />
                    )}

                    {field.type === 'textarea' && (
                      <textarea
                        rows={4}
                        placeholder={field.placeholder}
                        value={formData[field.name] || ''}
                        onChange={(e) => setFormData((prev: any) => ({ ...prev, [field.name]: e.target.value }))}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-all text-xs"
                        required={field.required}
                      />
                    )}

                    {field.type === 'select' && field.options && (
                      <select
                        value={formData[field.name] || ''}
                        onChange={(e) => setFormData((prev: any) => ({ ...prev, [field.name]: e.target.value }))}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-white focus:outline-none focus:border-indigo-500 transition-all text-xs cursor-pointer"
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
                        
                        {uploadedFileUrl ? (
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
