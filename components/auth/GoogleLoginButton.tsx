"use client";

import { createClient } from "@/lib/supabase/client";

export default function GoogleLoginButton() {
    const handleGoogleLogin = async () => {
        const supabase = createClient();
        await supabase.auth.signInWithOAuth({
            provider: "google",
            options: {
                redirectTo: `${window.location.origin}/auth/callback`,
            },
        });
    };

    return (
        <button
            type="button"
            onClick={handleGoogleLogin}
            className="flex items-center justify-center rounded-md border px-4 py-2 border-foreground/20 bg-white text-black hover:bg-gray-200"
        >
            {/* لینک جدید لوگوی گوگل */}
            <img
                src="https://www.gstatic.com/marketing-cms/assets/images/d5/dc/cfe9ce8b4425b410b49b7f2dd3f3/g.webp=s48-fcrop64=1,00000000ffffffff-rw"
                alt="Google Logo"
                className="w-5 h-5 mr-2" // تنظیم اندازه لوگو
            />
            Sign in with Google
        </button>
    );
}
