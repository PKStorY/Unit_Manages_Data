import { NextResponse } from 'next/server';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

// Define Thai labels for confirmation popup titles
const CATEGORY_TITLES: Record<string, string> = {
  meetings: 'การประชุมคณะทำงาน',
  plans: 'แผนการดำเนินงาน',
  activities: 'การจัดกิจกรรม',
  trainings: 'การอบรมและพัฒนาความรู้',
  budgets: 'การเบิกจ่ายงบประมาณ',
  ems_reports: 'รายงานข้อพิพาทไกล่เกลี่ย พ.ร.บ. 2562',
  other_laws_reports: 'รายงานข้อพิพาทกฎหมายอื่นๆ',
  zero_reports: 'รายงานไม่มีผลการดำเนินงาน',
};

// Target page paths for redirect
const CATEGORY_PATHS: Record<string, string> = {
  meetings: '/dashboard/meetings',
  plans: '/dashboard/plans',
  activities: '/dashboard/activities',
  trainings: '/dashboard/trainings',
  budgets: '/dashboard/budgets',
  ems_reports: '/dashboard/ems_reports',
  other_laws_reports: '/dashboard/other_laws_reports',
  zero_reports: '/dashboard/zero_reports',
};

// Define schemas for all modules
const SCHEMAS: Record<string, { properties: Record<string, any>; required: string[] }> = {
  meetings: {
    properties: {
      meeting_name: { type: 'string', description: 'ชื่อการประชุมประจำคณะทำงาน' },
      meeting_date: { type: 'string', description: 'วันที่ประชุม รูปแบบ YYYY-MM-DD' },
      location: { type: 'string', description: 'สถานที่ประชุม' },
      summary: { type: 'string', description: 'สรุปประเด็นหลักและมติที่ประชุม' },
      recorder_name: { type: 'string', description: 'ชื่อผู้จดรายงานการประชุม หรือผู้พิมพ์บันทึกการประชุม' },
      reporter_phone: { type: 'string', description: 'เบอร์โทรศัพท์ติดต่อของผู้จดรายงานการประชุม' },
      reporter_name: { type: 'string', description: 'ชื่อผู้รายงานหลัก หรือผู้มีอำนาจลงนามรับรองรายงานการประชุม (เช่น ประธานคณะทำงาน)' },
      reporter_position: { 
        type: 'string', 
        description: 'ตำแหน่งผู้มีอำนาจลงนาม ต้องเลือกค่าจาก: ประธานคณะทำงาน, รองประธานคณะทำงาน เท่านั้น' 
      },
      source_info: { type: 'string', description: 'ชื่อผู้ประสานงานจัดงานประชุม หรือผู้ติดต่อหลักที่ดูแลการเชิญประชุม' },
      source_contact: { type: 'string', description: 'เบอร์โทรศัพท์ติดต่อของผู้ประสานงานจัดงานประชุม' },
      invitation_text: { type: 'string', description: 'เนื้อหาหนังสือส่งเชิญเข้าร่วมประชุม' },
    },
    required: ['meeting_name', 'meeting_date'],
  },
  plans: {
    properties: {
      title: { type: 'string', description: 'ชื่อแผนงาน หรือชื่อโครงการหลัก' },
      year: { type: 'string', description: 'ปีงบประมาณ พ.ศ. ของแผนงาน เช่น 2569' },
      project_description: { type: 'string', description: 'รายละเอียด หรือวัตถุประสงค์โครงการ' },
      reporter_name: { type: 'string', description: 'ชื่อเต็มของผู้บันทึกรายงาน/ผู้รายงานข้อมูลแผนงานนี้ลงระบบ (เช่น บันทึกโดย นาย..., รายงานโดย นาย...)' },
      reporter_phone: { type: 'string', description: 'เบอร์โทรศัพท์ติดต่อของผู้บันทึกรายงาน/ผู้รายงานข้อมูลลงระบบ' },
      source_info: { type: 'string', description: 'ชื่อผู้ประสานงานหลัก หรือผู้รับผิดชอบหลักของโครงการที่ระบุในเนื้อหาข้อความ (เช่น ผู้ประสานงานโครงการคือ นาย... หรือ ติดต่อประสานงาน นาย...)' },
      source_contact: { type: 'string', description: 'เบอร์โทรศัพท์ติดต่อของผู้ประสานงานโครงการ หรือเบอร์โทรติดต่อผู้รับผิดชอบโครงการที่ระบุในเนื้อหาข้อความ' },
      activities: {
        type: 'array',
        description: 'รายการกิจกรรมย่อยทั้งหมดภายใต้แผนงานโครงการนี้',
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
    },
    required: ['title', 'year'],
  },
  activities: {
    properties: {
      activity_name: { type: 'string', description: 'ชื่อกิจกรรม' },
      activity_date: { type: 'string', description: 'วันที่จัดกิจกรรม รูปแบบ YYYY-MM-DD' },
      location: { type: 'string', description: 'สถานที่จัดกิจกรรม' },
      summary: { type: 'string', description: 'ผลการดำเนินกิจกรรม/สรุปการทำกิจกรรม' },
      reporter_name: { type: 'string', description: 'ชื่อผู้บันทึกรายงาน/ผู้ส่งรายงานผล (เช่น บันทึกโดย นาย...)' },
      reporter_phone: { type: 'string', description: 'เบอร์โทรศัพท์ติดต่อของผู้บันทึกรายงาน/ผู้ส่งรายงานผล' },
      source_info: { type: 'string', description: 'ชื่อผู้ประสานงานกิจกรรม หรือผู้ติดต่อหลักของกิจกรรมที่ระบุในเนื้อหา' },
      source_contact: { type: 'string', description: 'เบอร์โทรติดต่อประสานงานกิจกรรม' },
    },
    required: ['activity_name', 'activity_date'],
  },
  trainings: {
    properties: {
      course_name: { type: 'string', description: 'ชื่อหลักสูตรอบรม' },
      training_date: { type: 'string', description: 'วันที่จัดอบรม รูปแบบ YYYY-MM-DD' },
      unit_training: { type: 'string', description: 'หน่วยงานผู้จัด' },
      location: { type: 'string', description: 'สถานที่จัดอบรม' },
      summary: { type: 'string', description: 'ผลสรุปการอบรม/สิ่งที่ได้เรียนรู้' },
      reporter_name: { type: 'string', description: 'ชื่อผู้บันทึกรายงานอบรม/ผู้ส่งรายงาน (เช่น บันทึกโดย นาย...)' },
      reporter_phone: { type: 'string', description: 'เบอร์โทรศัพท์ติดต่อของผู้บันทึกรายงาน' },
      source_info: { type: 'string', description: 'ชื่อผู้ประสานงานหลัก หรือผู้ดูแลเรื่องการฝึกอบรม' },
      source_contact: { type: 'string', description: 'เบอร์โทรติดต่อผู้ประสานงานฝึกอบรม' },
    },
    required: ['course_name', 'training_date'],
  },
  budgets: {
    properties: {
      project_name: { type: 'string', description: 'ชื่อโครงการ/รายการเบิกจ่าย' },
      approval_date: { type: 'string', description: 'วันที่อนุมัติเบิกจ่าย รูปแบบ YYYY-MM-DD' },
      budget_amount: { type: 'number', description: 'จำนวนงบประมาณได้รับอนุมัติ (ตัวเลขไม่มีจุลภาคคั่น)' },
      end_date: { type: 'string', description: 'วันที่เสร็จสิ้นโครงการ รูปแบบ YYYY-MM-DD' },
      refund_amount: { type: 'number', description: 'จำนวนเงินงบประมาณส่งคืน (ตัวเลขไม่มีจุลภาคคั่น)' },
      summary: { type: 'string', description: 'สรุปการเบิกจ่ายและการทำงาน' },
      reporter_name: { type: 'string', description: 'ชื่อผู้บันทึกรายงาน/ผู้ส่งข้อมูลการเบิกจ่าย (เช่น บันทึกโดย นาย...)' },
      reporter_phone: { type: 'string', description: 'เบอร์โทรศัพท์ติดต่อของผู้บันทึกรายงาน' },
      source_info: { type: 'string', description: 'ชื่อผู้รับผิดชอบโครงการที่เบิกจ่าย หรือผู้ติดต่อเรื่องการเงิน/ผู้ประสานงานโครงการ' },
      source_contact: { type: 'string', description: 'เบอร์โทรศัพท์ติดต่อผู้ประสานงานการเงิน/ผู้รับผิดชอบโครงการ' },
    },
    required: ['project_name', 'approval_date', 'budget_amount'],
  },
  ems_reports: {
    properties: {
      case_no: { type: 'string', description: 'เลขคำร้อง (เช่น กก.01/2569)' },
      start_date_mediation: { type: 'string', description: 'วันที่รับคำร้อง รูปแบบ YYYY-MM-DD' },
      case_type: { 
        type: 'string', 
        description: 'ประเภทข้อพิพาท ต้องเลือกจาก: ทางแพ่ง, ทางอาญา เท่านั้น' 
      },
      civil_dispute_type: { 
        type: 'string', 
        description: 'ประเภทข้อพิพาททางแพ่ง (กู้ยืม, ละเมิด, เช่าทรัพย์, มรดก ฯลฯ) เลือกที่ใกล้เคียงจากตัวเลือกการชำระหนี้, ความรับผิดเพื่อละเมิด, ยืม/กู้ยืมประมวลกฎหมายแพ่งและพาณิชย์, เช่าซื้อ, เช่าทรัพย์, ซื้อขาย, มรดก เป็นต้น' 
      },
      criminal_dispute_type: { 
        type: 'string', 
        description: 'ประเภทข้อพิพาททางอาญา ลหุโทษ เช่น ทำร้ายร่างกายไม่เกิดอันตราย, ดูหมิ่นซึ่งหน้า, ทำให้เสียทรัพย์, บุกรุก' 
      },
      value_in_dispute: { type: 'number', description: 'จำนวนทุนทรัพย์ไกล่เกลี่ย (บาท) ตัวเลขไม่มีจุลภาคคั่น ใส่ 0 หากไม่มีทุนทรัพย์' },
      case_final: { 
        type: 'string', 
        description: 'ผลการไกล่เกลี่ย ต้องเลือกจาก: จำหน่าย, ยุติ, ตกลงกันไม่ได้, ตกลงกันได้ เท่านั้น' 
      },
      summary: { type: 'string', description: 'สรุปสาระสำคัญข้อเท็จจริงของการไกล่เกลี่ยคดีความ' },
      end_date_mediation: { type: 'string', description: 'วันที่ไกล่เกลี่ยสำเร็จ รูปแบบ YYYY-MM-DD' },
      reporter_name: { type: 'string', description: 'ชื่อผู้รายงาน/ผู้บันทึกคดีไกล่เกลี่ย (เช่น บันทึกโดย นาย... หรือ ผู้รายงาน นาย...)' },
      reporter_phone: { type: 'string', description: 'เบอร์โทรศัพท์ติดต่อของผู้บันทึกรายงาน' },
    },
    required: ['case_no', 'start_date_mediation', 'case_type', 'case_final', 'reporter_name'],
  },
  other_laws_reports: {
    properties: {
      report_date: { type: 'string', description: 'วันที่บันทึกรายงาน รูปแบบ YYYY-MM-DD' },
      dispute_type: { type: 'string', description: 'ประเภทข้อพิพาทกฎหมายอื่น (เช่น ปัญหากฎหมายครอบครัว, ที่ดินทำกิน)' },
      details: { type: 'string', description: 'รายละเอียดปัญหา/ข้อพิพาท' },
      action_type: { 
        type: 'string', 
        description: 'การดำเนินการเบื้องต้น ต้องเลือกจาก: ให้ข้อแนะนำ, ประสานส่งต่อ เท่านั้น' 
      },
      action_detail: { type: 'string', description: 'รายละเอียดคำแนะนำ หรือ หน่วยงานปลายทางที่ประสานส่งต่อ' },
      reporter_name: { type: 'string', description: 'ชื่อผู้บันทึกรายงานข้อพิพาทกฎหมายอื่นๆ (เช่น บันทึกโดย นาย...)' },
      reporter_phone: { type: 'string', description: 'เบอร์โทรศัพท์ติดต่อของผู้บันทึกรายงาน' },
      source_info: { type: 'string', description: 'ชื่อผู้ประสานงาน หรือผู้ดูแลกรณีส่งต่อ/ให้คำปรึกษา' },
      source_contact: { type: 'string', description: 'เบอร์ติดต่อผู้ประสานงานส่งต่อ' },
    },
    required: ['report_date', 'action_type', 'reporter_name'],
  },
  zero_reports: {
    properties: {
      month: { 
        type: 'string', 
        description: 'รายงานรอบเดือน เลือกจากตัวเลข: 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12 เท่านั้น' 
      },
      year: { type: 'string', description: 'ปี พ.ศ. (เช่น 2569)' },
      reporter_name: { type: 'string', description: 'ชื่อผู้ประสานงานหลักผู้รายงานรายงานความว่างเปล่านี้ (เช่น รายงานโดย นาย...)' },
      reporter_phone: { type: 'string', description: 'เบอร์โทรศัพท์ติดต่อผู้ประสานงานหลักผู้รายงาน' },
    },
    required: ['month', 'year', 'reporter_name'],
  }
};

export async function POST(request: Request) {
  try {
    if (!GEMINI_API_KEY) {
      return NextResponse.json(
        { error: 'ระบบเชื่อมต่อ AI ยังไม่ได้กำหนด API Key (GEMINI_API_KEY) กรุณาตรวจสอบไฟล์ .env.local' },
        { status: 500 }
      );
    }

    const { story } = await request.json() as { story: string };

    if (!story || !story.trim()) {
      return NextResponse.json({ error: 'กรุณาระบุคำอธิบายหรือเนื้อเรื่อง' }, { status: 400 });
    }

    // ==========================================
    // ขั้นตอนที่ 1: การจำแนกประเภท (Classification)
    // ==========================================
    const classificationPrompt = `คุณเป็นระบบจำแนกหัวข้อรายงานภาษาไทยอัจฉริยะ ทำหน้าที่ตรวจสอบคำพูดเล่าเรื่อง (Voice Dictation) หรือพิมพ์รายงานของผู้ใช้ และระบุว่าเรื่องเล่านี้สอดคล้องกับหมวดหมู่รายงานใดใน 8 หมวดหมู่นี้มากที่สุด:

1. "meetings" (การประชุมคณะทำงาน): หากพูดถึง การเชิญประชุม, จัดประชุมคณะทำงาน, มีวาระการประชุม, แต่งตั้งประธาน/เลขานุการประชุม, มติที่ประชุม
2. "plans" (แผนการดำเนินงาน/โครงการ): หากพูดถึง แผนงาน, โครงการประจำปี, ไทม์ไลน์รายปี, การทำโครงการย่อยตลอดปี, งบประมาณโครงการหลัก
3. "activities" (การจัดกิจกรรม): หากพูดถึง กิจกรรมลงพื้นที่, จัดกิจกรรมทำแผ่นพับเผยแพร่กฎหมาย, ลงเวทีชุมชน, กิจกรรมส่งเสริมสิทธิมนุษยชน
4. "trainings" (การอบรมและพัฒนาความรู้): หากพูดถึง การจัดฝึกอบรม, สัมมนาพัฒนาศักยภาพผู้ไกล่เกลี่ย, หลักสูตรฝึกอบรม, ใบประกาศ/เกียรติบัตรอบรม
5. "budgets" (การเบิกจ่ายงบประมาณ): หากพูดถึง ขอเบิกเงินงบประมาณ, อนุมัติเบิกจ่ายงบโครงการ, ได้รับจัดสรรงบประมาณสะสม, ส่งคืนเงินงบประมาณ
6. "ems_reports" (รายงานข้อพิพาทไกล่เกลี่ย พ.ร.บ. 2562): หากพูดถึง คดีไกล่เกลี่ยตาม พ.ร.บ. ไกล่เกลี่ย 2562, ข้อพิพาทไกล่เกลี่ย, ตกลงกันได้/ไม่ได้, เลขคำร้องคดีไกล่เกลี่ย, ทุนทรัพย์ไกล่เกลี่ยคดีความ
7. "other_laws_reports" (รายงานข้อพิพาทกฎหมายอื่นๆ): หากพูดถึง ข้อพิพาทกฎหมายทั่วไปของชาวบ้าน เช่น ข้อพิพาทมรดกครอบครัว, ปัญหากระทบกระทั่ง, การให้คำแนะนำข้อกฎหมายชุมชนเบื้องต้น, ส่งต่อหน่วยงานอื่น
8. "zero_reports" (รายงานไม่มีผลการดำเนินงาน): หากพูดถึง การรายงานว่าในรอบเดือนนี้ไม่มีผลการปฏิบัติงานใดๆ เลย, เดือนนี้ไม่มีกิจกรรม/ประชุม/ไกล่เกลี่ย, รายงานศูนย์ว่างเปล่า, Zero Report

เนื้อความของผู้ใช้:
"${story.trim()}"

กรุณาประเมินและเลือกหมวดหมู่ที่เหมาะสมที่สุดเพียงหนึ่งเดียวเท่านั้น`;

    const classificationPayload = {
      contents: [{
        parts: [{ text: classificationPrompt }]
      }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'object',
          properties: {
            category: {
              type: 'string',
              enum: ['meetings', 'plans', 'activities', 'trainings', 'budgets', 'ems_reports', 'other_laws_reports', 'zero_reports'],
              description: 'หมวดหมู่ที่ตรวจพบ'
            }
          },
          required: ['category']
        }
      }
    };

    const classificationResponse = await fetch(GEMINI_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(classificationPayload)
    });

    if (!classificationResponse.ok) {
      const errorData = await classificationResponse.json().catch(() => ({}));
      console.error('Classification request failed:', errorData);
      return NextResponse.json(
        { error: `ไม่สามารถจำแนกหมวดหมู่ได้: ${errorData.error?.message || classificationResponse.statusText}` },
        { status: classificationResponse.status }
      );
    }

    const classData = await classificationResponse.json();
    const classText = classData.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!classText) {
      return NextResponse.json({ error: 'ไม่ได้รับการระบุหมวดหมู่จาก AI' }, { status: 500 });
    }

    const { category } = JSON.parse(classText) as { category: string };

    if (!category || !SCHEMAS[category]) {
      return NextResponse.json({ error: `ไม่พบ Schema สำหรับหมวดหมู่ที่จัดประเภทได้ (${category})` }, { status: 500 });
    }

    // ==========================================
    // ขั้นตอนที่ 2: สกัดรายละเอียดตาม Schema (Extraction)
    // ==========================================
    const categoryTitle = CATEGORY_TITLES[category];
    const categoryPath = CATEGORY_PATHS[category];
    const schemaInfo = SCHEMAS[category];

    // Build fields summary for system instruction
    const fieldsText = Object.keys(schemaInfo.properties)
      .map(key => {
        const prop = schemaInfo.properties[key];
        return `- ${key} (${prop.description})`;
      })
      .join('\n');

    const extractionPrompt = `คุณเป็นระบบดึงข้อมูลภาษาไทยอัจฉริยะ ทำหน้าที่วิเคราะห์คำพูดเล่าเรื่องของผู้ใช้ และดึงข้อมูลฟิลด์ต่าง ๆ ให้สอดคล้องกับหมวดหมู่ "${categoryTitle}" (${category})

ข้อความเล่าเรื่องของผู้ใช้:
"${story.trim()}"

รายละเอียดฟิลด์ที่ต้องสกัดและนำไปใส่ใน JSON:
${fieldsText}

ข้อตกลงพิเศษในการวิเคราะห์และจัดรูปแบบข้อมูล:
- ตัวเลขจำนวนเงินหรือมูลค่าใดๆ ให้แปลงเป็นตัวเลขอารบิกที่ไม่มีลูกน้ำหรือคอมม่า (เช่น 50,000 -> 50000)
- วันที่ ให้แปลงปี พ.ศ. ให้อยู่ในรูปแบบสากล ค.ศ. YYYY-MM-DD เสมอ เช่น 12 มีนาคม 2569 -> 2026-03-12
- สำหรับหมวด plans (แผนการดำเนินงาน) กิจกรรมย่อย (activities) แต่ละรายการจะต้องมีชื่อ วันเริ่มต้น วันสิ้นสุด และงบประมาณย่อย หากระบุวันที่คร่าวๆ ให้แปลงเป็น YYYY-MM-DD
- หากไม่มีเบาะแสใด ๆ ในเรื่องเล่าสำหรับฟิลด์นั้น ๆ ไม่ต้องใส่คีย์ของฟิลด์นั้นมาในผลลัพธ์ JSON (ให้ละเว้นคีย์นั้นไปเลย)`;

    const extractionPayload = {
      contents: [{
        parts: [{ text: extractionPrompt }]
      }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'object',
          properties: schemaInfo.properties,
          required: schemaInfo.required
        }
      }
    };

    const extractionResponse = await fetch(GEMINI_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(extractionPayload)
    });

    if (!extractionResponse.ok) {
      const errorData = await extractionResponse.json().catch(() => ({}));
      console.error('Extraction request failed:', errorData);
      return NextResponse.json(
        { error: `ไม่สามารถแยกฟิลด์รายงานได้: ${errorData.error?.message || extractionResponse.statusText}` },
        { status: extractionResponse.status }
      );
    }

    const extractData = await extractionResponse.json();
    const extractText = extractData.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!extractText) {
      return NextResponse.json({ error: 'ไม่ได้รับข้อมูลรายละเอียดจาก AI' }, { status: 500 });
    }

    const parsedData = JSON.parse(extractText);

    return NextResponse.json({
      category,
      categoryTitle,
      categoryPath,
      data: parsedData
    });

  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error('API route classify-and-parse crashed:', err);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการประมวลผล: ' + errMsg }, { status: 500 });
  }
}
