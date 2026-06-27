import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export async function POST(request: Request) {
  try {
    // 1. ตรวจสอบว่ามีการติดตั้งคีย์แอดมิน (Service Role Key) หรือไม่
    if (!serviceRoleKey) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Missing SUPABASE_SERVICE_ROLE_KEY',
          message: 'กรุณาตั้งค่า SUPABASE_SERVICE_ROLE_KEY ในไฟล์ .env.local (หรือ Environment Variables ของโฮสติ้ง) เพื่อใช้งานระบบล็อกอิน Bypass' 
        },
        { status: 500 }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const bypassEmail = 'admin.bypass@ksr.go.th';
    const bypassPassword = 'BypassAdmin@2026!';
    let userId = null;

    // 2. ค้นหาผู้ใช้จากระบบ Auth ของ Supabase
    const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (listError) {
      console.error('Error listing auth users:', listError);
      return NextResponse.json(
        { success: false, error: listError.message, message: 'เกิดข้อผิดพลาดในการตรวจสอบบัญชีผู้ใช้งานผ่าน Admin SDK' },
        { status: 500 }
      );
    }

    const existingAuthUser = users.find(u => u.email === bypassEmail);

    if (existingAuthUser) {
      userId = existingAuthUser.id;
      // อัปเดตรหัสผ่านให้เป็นรหัสเริ่มต้น และตั้งค่าคอนเฟิร์มอีเมล
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
        userId,
        {
          password: bypassPassword,
          email_confirm: true
        }
      );
      if (updateError) {
        console.error('Error updating bypass user:', updateError);
      }
    } else {
      // สร้างบัญชีผู้ใช้ใหม่
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: bypassEmail,
        password: bypassPassword,
        email_confirm: true,
        user_metadata: { 
          role: 'admin', 
          name: 'ผู้ดูแลระบบ (Bypass)' 
        }
      });

      if (createError) {
        console.error('Error creating bypass user:', createError);
        return NextResponse.json(
          { success: false, error: createError.message, message: 'ไม่สามารถสร้างผู้ใช้งานระดับแอดมินสำหรับการ Bypass ได้' },
          { status: 500 }
        );
      }

      if (newUser && newUser.user) {
        userId = newUser.user.id;
      }
    }

    if (!userId) {
      return NextResponse.json(
        { success: false, message: 'ไม่สามารถระบุ ID ผู้ใช้ระดับแอดมินได้' },
        { status: 500 }
      );
    }

    // 3. ทำการตรวจสอบ/สร้าง โปรไฟล์ (profiles) สำหรับบัญชีนี้
    const { error: profileError } = await supabaseAdmin.from('profiles').upsert({
      id: userId,
      email: bypassEmail,
      role: 'admin',
      status: 'เปิด',
      name: 'ผู้ดูแลระบบ (Bypass)',
      unit_code: 'ADMIN_BYPASS',
      province: 'ส่วนกลาง',
      district: null,
      subdistrict: null,
      phone: '0000000000',
      updated_at: new Date().toISOString()
    });

    if (profileError) {
      console.error('Error creating/updating bypass profile:', profileError);
      return NextResponse.json(
        { 
          success: false, 
          error: profileError.message, 
          message: 'สร้างบัญชี Auth สำเร็จ แต่เกิดข้อผิดพลาดในการลงทะเบียนระดับสิทธิ์ผู้ใช้งาน (Profiles)' 
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      email: bypassEmail,
      password: bypassPassword
    });

  } catch (err: any) {
    console.error('Bypass handler crash:', err);
    return NextResponse.json(
      { success: false, error: err.message, message: 'เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์หลังบ้าน' },
      { status: 500 }
    );
  }
}
