"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  PROFILE_DISPLAY_NAME_MAX,
  PROFILE_USERNAME_MAX,
  PROFILE_USERNAME_MIN
} from "@/db/limits"
import {
  IconCircleCheckFilled,
  IconCircleXFilled,
  IconLoader2
} from "@tabler/icons-react"
import { FC, useCallback, useState, useEffect } from "react"
import { toast } from "sonner"
import { LimitDisplay } from "../ui/limit-display"

interface ProfileStepProps {
  email: string // ✨ ۱. ایمیل به props اضافه شد
  username: string
  usernameAvailable: boolean
  displayName: string
  onUsernameAvailableChange: (isAvailable: boolean) => void
  onUsernameChange: (username: string) => void
  onDisplayNameChange: (name: string) => void
}

export const ProfileStep: FC<ProfileStepProps> = ({
  email, // ✨ ۲. ایمیل از props گرفته شد
  username,
  usernameAvailable,
  displayName,
  onUsernameAvailableChange,
  onUsernameChange,
  onDisplayNameChange
}) => {
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (username || !email) return

    const generateAndSetUsername = async () => {
      setLoading(true)

      // ✨ ۳. از prop ایمیل برای ساخت نام کاربری استفاده می‌کنیم
      const emailPrefix = email
        .split("@")[0]
        .replace(/[^a-zA-Z0-9_]/g, "_")
        .slice(0, PROFILE_USERNAME_MAX - 4)

      let finalUsername = emailPrefix
      let isAvailable = false
      let attempts = 0

      while (!isAvailable && attempts < 10) {
        const response = await fetch(`/api/username/available`, {
          method: "POST",
          body: JSON.stringify({ username: finalUsername })
        })
        const data = await response.json()
        isAvailable = data.isAvailable

        if (isAvailable) break

        const randomNumber = Math.floor(100 + Math.random() * 900)
        finalUsername = `${emailPrefix}_${randomNumber}`
        attempts++
      }

      onUsernameChange(finalUsername)
      onUsernameAvailableChange(isAvailable)
      setLoading(false)
    }

    generateAndSetUsername()
  }, [email, username, onUsernameChange, onUsernameAvailableChange])

  // ... (بقیه کد بدون تغییر باقی می‌ماند)
  const debounce = (func: (...args: any[]) => void, wait: number) => {
    let timeout: NodeJS.Timeout | null

    return (...args: any[]) => {
      const later = () => {
        if (timeout) clearTimeout(timeout)
        func(...args)
      }

      if (timeout) clearTimeout(timeout)
      timeout = setTimeout(later, wait)
    }
  }

  const checkUsernameAvailability = useCallback(
    debounce(async (username: string) => {
      if (!username) return

      if (
        username.length < PROFILE_USERNAME_MIN ||
        username.length > PROFILE_USERNAME_MAX
      ) {
        onUsernameAvailableChange(false)
        return
      }

      const usernameRegex = /^[a-zA-Z0-9_]+$/
      if (!usernameRegex.test(username)) {
        onUsernameAvailableChange(false)
        toast.error("Username must be letters, numbers, or underscores only.")
        return
      }

      setLoading(true)
      const response = await fetch(`/api/username/available`, {
        method: "POST",
        body: JSON.stringify({ username })
      })
      const data = await response.json()
      onUsernameAvailableChange(data.isAvailable)
      setLoading(false)
    }, 500),
    [onUsernameAvailableChange]
  )

  return (
    <>
      <div className="space-y-1">
        <div className="flex items-center space-x-2">
          <Label>Username</Label>
          <div className="text-xs">
            {username &&
              !loading &&
              (usernameAvailable ? (
                <div className="text-green-500">AVAILABLE</div>
              ) : (
                <div className="text-red-500">UNAVAILABLE</div>
              ))}
          </div>
        </div>
        <div className="relative">
          <Input
            className="pr-10"
            placeholder="username"
            value={username}
            onChange={e => {
              onUsernameChange(e.target.value)
              checkUsernameAvailability(e.target.value)
            }}
            minLength={PROFILE_USERNAME_MIN}
            maxLength={PROFILE_USERNAME_MAX}
          />
          <div className="absolute inset-y-0 right-0 flex items-center pr-3">
            {loading ? (
              <IconLoader2 className="animate-spin" />
            ) : username ? (
              usernameAvailable ? (
                <IconCircleCheckFilled className="text-green-500" />
              ) : (
                <IconCircleXFilled className="text-red-500" />
              )
            ) : null}
          </div>
        </div>
        <LimitDisplay used={username.length} limit={PROFILE_USERNAME_MAX} />
      </div>

      <div className="space-y-1">
        <Label>Chat Display Name</Label>
        <Input
          placeholder="Your Name"
          value={displayName}
          onChange={e => onDisplayNameChange(e.target.value)}
          maxLength={PROFILE_DISPLAY_NAME_MAX}
        />
        <LimitDisplay
          used={displayName.length}
          limit={PROFILE_DISPLAY_NAME_MAX}
        />
      </div>
    </>
  )
}
