"use client"

import { ChatbotUIContext } from "@/context/context"
import { getProfileByUserId, updateProfile } from "@/db/profile"
import {
  getHomeWorkspaceByUserId,
  getWorkspacesByUserId
} from "@/db/workspaces"
import { supabase } from "@/lib/supabase/browser-client"
import { TablesUpdate } from "@/supabase/types"
import { useRouter } from "next/navigation"
import { useContext, useEffect, useState } from "react"
import { toast } from "sonner"
import { FinishStep } from "../../../components/setup/finish-step"
import { ProfileStep } from "../../../components/setup/profile-step"
import { StepContainer } from "../../../components/setup/step-container"
import { PROFILE_USERNAME_MAX } from "@/db/limits"

// ---------- helpers (NEW) ----------
const ADJECTIVES = [
  "swift",
  "bright",
  "calm",
  "clever",
  "brave",
  "neat",
  "solid",
  "prime",
  "lucky",
  "zen",
  "vivid",
  "fresh",
  "bold",
  "epic",
  "rapid",
  "smart",
  "sunny",
  "true",
  "alpha",
  "nova"
]
const NOUNS = [
  "tiger",
  "falcon",
  "panther",
  "eagle",
  "lynx",
  "otter",
  "whale",
  "panda",
  "rhino",
  "fox",
  "wolf",
  "bear",
  "koala",
  "hawk",
  "owl",
  "monkey",
  "horse",
  "dolphin",
  "yak",
  "zebra"
]

const sanitize = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, PROFILE_USERNAME_MAX)

const makeCandidate = () => {
  const a = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)]
  const n = NOUNS[Math.floor(Math.random() * NOUNS.length)]
  const num = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(3, "0") // 3–4 رقمی
  let u = `${a}_${n}_${num}`
  if (u.length > PROFILE_USERNAME_MAX) u = u.slice(0, PROFILE_USERNAME_MAX)
  return sanitize(u)
}

const checkUsernameAvailability = async (username: string) => {
  const res = await fetch(`/api/username/available`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username })
  })
  if (!res.ok) throw new Error("availability endpoint failed")
  const data = await res.json()
  return Boolean(data?.isAvailable)
}

const getAvailableRandomUsername = async (maxAttempts = 30) => {
  for (let i = 0; i < maxAttempts; i++) {
    const cand = makeCandidate()
    const ok = await checkUsernameAvailability(cand)
    if (ok) return { username: cand, available: true }
  }
  // اگر بعد از چند تلاش چیزی پیدا نشد، آخرین کاندید را برگردان (غیرقابل)
  return { username: makeCandidate(), available: false }
}
// -----------------------------------

export default function SetupPage() {
  const { profile, setProfile, setWorkspaces, setSelectedWorkspace } =
    useContext(ChatbotUIContext)

  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [currentStep, setCurrentStep] = useState(1)

  const [displayName, setDisplayName] = useState("")
  const [username, setUsername] = useState("")
  const [usernameAvailable, setUsernameAvailable] = useState(true)

  useEffect(() => {
    const checkAuthAndOnboard = async () => {
      const {
        data: { session }
      } = await supabase.auth.getSession()

      if (!session) {
        router.push("/login")
        return
      }

      const user = session.user
      const prof = await getProfileByUserId(user.id)
      setProfile(prof)

      if (prof.has_onboarded) {
        const homeWorkspaceId = await getHomeWorkspaceByUserId(user.id)
        if (homeWorkspaceId) {
          router.push(`/${homeWorkspaceId}/chat`)
        } else {
          toast.error("Home workspace not found.")
          setLoading(false)
        }
        return
      }

      // نمایش‌نام پیش‌فرض (اگر خالی بود)
      if (!prof.display_name) {
        const fallbackName =
          (user.user_metadata && (user.user_metadata.full_name as string)) ||
          (user.email ? user.email.split("@")[0] : "") ||
          "User"
        setDisplayName(fallbackName)
      } else {
        setDisplayName(prof.display_name)
      }

      // اگر پروفایل قبلاً یوزرنیم دارد
      if (prof.username) {
        setUsername(prof.username)
        setUsernameAvailable(true)
      } else {
        // --- رندومِ در دسترس: اینجا خودش می‌سازد و ست می‌کند ---
        try {
          const { username: u, available } = await getAvailableRandomUsername()
          setUsername(u)
          setUsernameAvailable(available)
          if (!available) {
            toast.warning(
              "Could not find an available username on first try. You can edit it."
            )
          }
        } catch (e) {
          console.error(e)
          toast.error("Failed to generate a random username.")
          // fallback: از پیشوند ایمیل به‌عنوان بکاپ
          if (user.email) {
            const emailPrefix = user.email
              .split("@")[0]
              .replace(/[^a-zA-Z0-9_]/g, "_")
            const trimmed = emailPrefix.slice(
              0,
              Math.max(3, PROFILE_USERNAME_MAX - 4)
            )
            setUsername(trimmed)
            // صرفاً حدس می‌زنیم آزاد باشد؛ چک واقعی هنگام تایپ/ذخیره
            setUsernameAvailable(true)
          }
        }
      }

      setLoading(false)
    }

    checkAuthAndOnboard()
  }, [router, setProfile])

  const handleSaveSetupSetting = async () => {
    const {
      data: { session }
    } = await supabase.auth.getSession()
    if (!session) return router.push("/login")

    const user = session.user
    const prof = await getProfileByUserId(user.id)

    const updateProfilePayload: TablesUpdate<"profiles"> = {
      ...prof,
      has_onboarded: true,
      display_name: displayName,
      username
    }
    await updateProfile(prof.id, updateProfilePayload)
    setProfile({ ...prof, ...updateProfilePayload })

    const workspaces = await getWorkspacesByUserId(user.id)
    const homeWorkspace = workspaces.find(w => w.is_home)

    if (homeWorkspace) {
      setSelectedWorkspace(homeWorkspace)
      setWorkspaces(workspaces)
      return router.push(`/${homeWorkspace.id}/chat`)
    }
  }

  const handleShouldProceed = (proceed: boolean) => {
    if (proceed) {
      if (currentStep === 2) {
        handleSaveSetupSetting()
      } else {
        setCurrentStep(currentStep + 1)
      }
    } else {
      setCurrentStep(currentStep - 1)
    }
  }

  const renderStep = (stepNum: number) => {
    switch (stepNum) {
      case 1:
        return (
          <StepContainer
            stepDescription="Let's create your profile."
            stepNum={currentStep}
            stepTitle="Welcome to Rhyno Chat"
            onShouldProceed={handleShouldProceed}
            showNextButton={!!(displayName && username && usernameAvailable)}
            showBackButton={false}
          >
            <ProfileStep
              username={username}
              usernameAvailable={usernameAvailable}
              displayName={displayName}
              onUsernameAvailableChange={setUsernameAvailable}
              onUsernameChange={setUsername}
              onDisplayNameChange={setDisplayName}
            />
          </StepContainer>
        )
      case 2:
        return (
          <StepContainer
            stepDescription="You are all set up!"
            stepNum={currentStep}
            stepTitle="Setup Complete"
            onShouldProceed={handleShouldProceed}
            showNextButton={true}
            showBackButton={true}
          >
            <FinishStep displayName={displayName} />
          </StepContainer>
        )
      default:
        return null
    }
  }

  if (loading) {
    return null
  }

  return (
    <div className="flex h-full items-center justify-center">
      {renderStep(currentStep)}
    </div>
  )
}
