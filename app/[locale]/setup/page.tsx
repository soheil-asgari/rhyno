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
import { FinishStep } from "../../../components/setup/finish-step"
import { ProfileStep } from "../../../components/setup/profile-step"
import { StepContainer } from "../../../components/setup/step-container"

export default function SetupPage() {
  const { profile, setProfile, setWorkspaces, setSelectedWorkspace } =
    useContext(ChatbotUIContext)

  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [currentStep, setCurrentStep] = useState(1)
  const [displayName, setDisplayName] = useState("")
  const [username, setUsername] = useState(profile?.username || "")
  const [usernameAvailable, setUsernameAvailable] = useState(true)

  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === "SIGNED_IN" && session) {
          const user = session.user

          const handleUserOnboarding = async () => {
            const profile = await getProfileByUserId(user.id)
            setProfile(profile)
            setUsername(profile.username)

            if (profile.has_onboarded) {
              const homeWorkspaceId = await getHomeWorkspaceByUserId(user.id)
              if (homeWorkspaceId) {
                router.push(`/${homeWorkspaceId}/chat`)
              } else {
                console.error("Onboarded user has no home workspace!")
                setLoading(false)
              }
            } else {
              setLoading(false)
            }
          }

          handleUserOnboarding()
        } else if (event === "SIGNED_OUT") {
          router.push("/login")
        }
      }
    )

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        setLoading(false)
      }
    })

    return () => {
      authListener.subscription.unsubscribe()
    }
  }, [router, setProfile])

  const handleSaveSetupSetting = async () => {
    const {
      data: { session }
    } = await supabase.auth.getSession()
    if (!session) {
      return router.push("/login")
    }

    const user = session.user
    const profile = await getProfileByUserId(user.id)

    const updateProfilePayload: TablesUpdate<"profiles"> = {
      ...profile,
      has_onboarded: true,
      display_name: displayName,
      username
    }

    const updatedProfile = await updateProfile(profile.id, updateProfilePayload)
    setProfile(updatedProfile)

    const workspaces = await getWorkspacesByUserId(profile.user_id)
    const homeWorkspace = workspaces.find(w => w.is_home)

    if (homeWorkspace) {
      setSelectedWorkspace(homeWorkspace)
      setWorkspaces(workspaces)
      return router.push(`/${homeWorkspace.id}/chat`)
    } else {
      console.error("Home workspace could not be found after setup!")
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
            // ✨ اصلاح: متغیر `displayName` به شرط اضافه شد
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
    return null // در حین بارگذاری صفحه سفید نمایش داده می‌شود
  }

  return (
    <div className="flex h-full items-center justify-center">
      {renderStep(currentStep)}
    </div>
  )
}
