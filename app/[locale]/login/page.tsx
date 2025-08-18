import { Brand } from "@/components/ui/brand"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SubmitButton } from "@/components/ui/submit-button"
import { createClient } from "@/lib/supabase/server"
import { Database } from "@/supabase/types"
import { createServerClient } from "@supabase/ssr"
import { get } from "@vercel/edge-config"
import { Metadata } from "next"
import { cookies, headers } from "next/headers"
import { redirect } from "next/navigation"

export const metadata: Metadata = {
  title: "Login"
}

export default async function Login({
  searchParams
}: {
  searchParams: { message: string }
}) {
  const cookieStore = cookies()
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        }
      }
    }
  )
  const session = (await supabase.auth.getSession()).data.session

  if (session) {
    const { data: homeWorkspace, error } = await supabase
      .from("workspaces")
      .select("*")
      .eq("user_id", session.user.id)
      .eq("is_home", true)
      .single()

    if (!homeWorkspace) {
      throw new Error(error.message)
    }

    return redirect(`/${homeWorkspace.id}/chat`)
  }

  const signIn = async (formData: FormData) => {
    "use server"

    const email = formData.get("email") as string
    const password = formData.get("password") as string
    const cookieStore = cookies()
    const supabase = createClient(cookieStore)

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })

    if (error) {
      return redirect(`/login?message=${error.message}`)
    }

    const { data: homeWorkspace, error: homeWorkspaceError } = await supabase
      .from("workspaces")
      .select("*")
      .eq("user_id", data.user.id)
      .eq("is_home", true)
      .single()

    if (!homeWorkspace) {
      throw new Error(
        homeWorkspaceError?.message || "An unexpected error occurred"
      )
    }

    return redirect(`/${homeWorkspace.id}/chat`)
  }

  const getEnvVarOrEdgeConfigValue = async (name: string) => {
    "use server"
    if (process.env.EDGE_CONFIG) {
      return await get<string>(name)
    }

    return process.env[name]
  }

  const signUp = async (formData: FormData) => {
    "use server"

    const email = formData.get("email") as string
    const password = formData.get("password") as string

    const cookieStore = cookies()
    const supabase = createClient(cookieStore)

    // ثبت‌نام کاربر
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // emailRedirectTo: `${origin}/auth/callback`
      }
    })

    if (error) {
      console.error(error)
      return redirect(`/login?message=${error.message}`)
    }

    const userId = data.user?.id
    if (!userId) {
      throw new Error("User ID not found after sign-up")
    }

    // workspaceهای پیش‌فرض برای کاربر جدید
    // const defaultWorkspaces = [
    //   {
    //     name: 'Default gpt-3.5-turbo',
    //     description: 'Auto-added model',
    //     default_model: 'gpt-3.5-turbo',
    //     default_prompt: 'You are Rhyno v1, optimized for speed and efficiency.',
    //     default_temperature: 0.5,
    //     default_context_length: 4096,
    //     embeddings_provider: 'openai',
    //     include_profile_context: true,
    //     include_workspace_instructions: true,
    //     sharing: 'private',
    //     is_home: true
    //   },
    //   {
    //     name: 'Default gpt-4',
    //     description: 'Auto-added model',
    //     default_model: 'gpt-4',
    //     default_prompt: 'You are Rhyno v2, provide detailed and accurate answers.',
    //     default_temperature: 0.5,
    //     default_context_length: 4096,
    //     embeddings_provider: 'openai',
    //     include_profile_context: true,
    //     include_workspace_instructions: true,
    //     sharing: 'private',
    //     is_home: false
    //   },
    //   {
    //     name: 'Default gpt-4-turbo-preview',
    //     description: 'Auto-added model',
    //     default_model: 'gpt-4-turbo-preview',
    //     default_prompt: 'You are Rhyno v3, optimized for reasoning and analysis.',
    //     default_temperature: 0.5,
    //     default_context_length: 4096,
    //     embeddings_provider: 'openai',
    //     include_profile_context: true,
    //     include_workspace_instructions: true,
    //     sharing: 'private',
    //     is_home: false
    //   },
    //   {
    //     name: 'Default gpt-5',
    //     description: 'Auto-added model',
    //     default_model: 'gpt-5',
    //     default_prompt: 'You are Rhyno v5, the most advanced model with deep reasoning.',
    //     default_temperature: 0.5,
    //     default_context_length: 4096,
    //     embeddings_provider: 'openai',
    //     include_profile_context: true,
    //     include_workspace_instructions: true,
    //     sharing: 'private',
    //     is_home: false
    //   },
    //   {
    //     name: 'Default gpt-5-mini',
    //     description: 'Auto-added model',
    //     default_model: 'gpt-5-mini',
    //     default_prompt: 'You are Rhyno v5 mini, lightweight and fast responses.',
    //     default_temperature: 0.5,
    //     default_context_length: 4096,
    //     embeddings_provider: 'openai',
    //     include_profile_context: true,
    //     include_workspace_instructions: true,
    //     sharing: 'private',
    //     is_home: false
    //   },
    //   {
    //     name: 'Default gpt-4o',
    //     description: 'Auto-added model',
    //     default_model: 'gpt-4o',
    //     default_prompt: 'You are Rhyno v4.1, multimodal and balanced in detail.',
    //     default_temperature: 0.5,
    //     default_context_length: 4096,
    //     embeddings_provider: 'openai',
    //     include_profile_context: true,
    //     include_workspace_instructions: true,
    //     sharing: 'private',
    //     is_home: false
    //   },
    //   {
    //     name: 'Default gpt-4o-mini',
    //     description: 'Auto-added model',
    //     default_model: 'gpt-4o-mini',
    //     default_prompt: 'You are Rhyno v4 mini, optimized for quick interactions.',
    //     default_temperature: 0.5,
    //     default_context_length: 4096,
    //     embeddings_provider: 'openai',
    //     include_profile_context: true,
    //     include_workspace_instructions: true,
    //     sharing: 'private',
    //     is_home: false
    //   },
    //   {
    //     name: 'Default dall-e-3',
    //     description: 'Auto-added model',
    //     default_model: 'dall-e-3',
    //     default_prompt: 'You are Rhyno Image, generate high quality creative images.',
    //     default_temperature: 0.5,
    //     default_context_length: 4096,
    //     embeddings_provider: 'openai',
    //     include_profile_context: true,
    //     include_workspace_instructions: true,
    //     sharing: 'private',
    //     is_home: false
    //   }
    // ]

    // اضافه کردن workspaceها به جدول
    // for (const ws of defaultWorkspaces) {
    //   await supabase.from('workspaces').insert({ user_id: userId, ...ws })
    // }

    // هدایت به صفحه setup بعد از ثبت‌نام
    return redirect("/setup")

    // USE IF YOU WANT TO SEND EMAIL VERIFICATION, ALSO CHANGE TOML FILE
    // return redirect("/login?message=Check email to continue sign in process")
  }

  const handleResetPassword = async (formData: FormData) => {
    "use server"

    const origin = headers().get("origin")
    const email = formData.get("email") as string
    const cookieStore = cookies()
    const supabase = createClient(cookieStore)

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/auth/callback?next=/login/password`
    })

    if (error) {
      return redirect(`/login?message=${error.message}`)
    }

    return redirect("/login?message=Check email to reset password")
  }

  return (
    <div className="flex w-full flex-1 flex-col justify-center gap-2 px-8 sm:max-w-md">
      <form
        className="animate-in text-foreground flex w-full flex-1 flex-col justify-center gap-2"
        action={signIn}
      >
        <Brand />

        <Label className="text-md mt-4" htmlFor="email">
          Email
        </Label>
        <Input
          className="mb-3 rounded-md border bg-inherit px-4 py-2"
          name="email"
          placeholder="you@example.com"
          required
        />

        <Label className="text-md" htmlFor="password">
          Password
        </Label>
        <Input
          className="mb-6 rounded-md border bg-inherit px-4 py-2"
          type="password"
          name="password"
          placeholder="••••••••"
        />

        <SubmitButton className="mb-2 rounded-md bg-blue-700 px-4 py-2 text-white">
          Login
        </SubmitButton>

        <SubmitButton
          formAction={signUp}
          className="border-foreground/20 mb-2 rounded-md border px-4 py-2"
        >
          Sign Up
        </SubmitButton>

        <div className="text-muted-foreground mt-1 flex justify-center text-sm">
          <span className="mr-1">Forgot your password?</span>
          <button
            formAction={handleResetPassword}
            className="text-primary ml-1 underline hover:opacity-80"
          >
            Reset
          </button>
        </div>

        {searchParams?.message && (
          <p className="bg-foreground/10 text-foreground mt-4 p-4 text-center">
            {searchParams.message}
          </p>
        )}
      </form>
    </div>
  )
}
