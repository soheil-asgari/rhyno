// scripts/create-enterprise.ts
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
// ⚠️ نکته مهم: اینجا باید از SERVICE_ROLE_KEY استفاده کنید نه کلید معمولی
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function createEnterpriseUser() {
    const email = 'BiDemo2@rhynoai.ir'; // ایمیل مشتری
    const password = 'FreeDemo3@1'; // پسوردی که به مشتری می‌دهید
    const companyName = 'Free Acc';

    // ۱. ساخت یوزر در بخش Auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true // تایید خودکار ایمیل
    });

    if (authError) {
        console.error('Error creating user:', authError.message);
        return;
    }

    const userId = authData.user.id;
    console.log(`✅ User created: ${userId}`);

    // ۲. ساخت ورک‌اسپیس برای این یوزر
    const { data: workspaceData, error: wsError } = await supabase
        .from('workspaces')
        .insert({
            user_id: userId,
            name: companyName,
            is_home: false,
            // default_context_length: 4096, // اگر فیلدهای اجباری دیگری دارید اضافه کنید
        })
        .select()
        .single();

    if (wsError) {
        console.error('Error creating workspace:', wsError.message);
    } else {
        console.log(`✅ Workspace created: ${workspaceData.name} (${workspaceData.id})`);
    }
}

createEnterpriseUser();