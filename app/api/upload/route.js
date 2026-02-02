// app/api/upload/route.js
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(request) {
  try {
    console.log("ورسل گرفت ")
    const formData = await request.formData();
    const file = formData.get('file');
    const fileName = formData.get('fileName');
    const workspaceId = formData.get('workspaceId'); // این را اضافه کردیم

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // ۱. آپلود فایل
    const { error: uploadError } = await supabaseAdmin.storage
      .from('finance_docs')
      .upload(fileName, buffer, { contentType: file.type, upsert: true });

    if (uploadError) throw uploadError;

    // ۲. گرفتن URL
    const { data: { publicUrl } } = supabaseAdmin.storage
      .from('finance_docs')
      .getPublicUrl(fileName);

    // ۳. ثبت در دیتابیس (بسیار مهم: این کار در سرور انجام می‌شود نه مرورگر)
    const { error: dbError } = await supabaseAdmin.from("payment_requests").insert({
      workspace_id: workspaceId,
      receipt_image_url: publicUrl,
      supplier_name: fileName.split('_')[2] || "فایل جدید",
      status: "uploaded",
      payment_date: new Date().toISOString().split("T")[0],
      type: "withdrawal"
    });

    if (dbError) throw dbError;

    return NextResponse.json({ success: true, url: publicUrl });

  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}