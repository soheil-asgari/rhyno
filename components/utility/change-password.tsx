"use client"

import { supabase } from "@/lib/supabase/browser-client"
import { useRouter } from "next/navigation"
import { FC, useState } from "react"
import { Button } from "../ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "../ui/dialog"
import { Input } from "../ui/input"
import { toast } from "sonner"

export const ChangePassword: FC = () => {
  const router = useRouter()
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState(false)

  const handleResetPassword = async () => {
    if (!newPassword || !confirmPassword) {
      return toast.info("Please enter and confirm your new password.")
    }

    if (newPassword !== confirmPassword) {
      return toast.error("Passwords do not match.")
    }

    setLoading(true)

    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setLoading(false)

    if (error) {
      return toast.error(error.message)
    }

    toast.success("Password changed successfully.")
    router.push("/login")
  }

  return (
    <Dialog open={true}>
      <DialogContent className="h-[240px] w-[400px] p-4">
        <DialogHeader>
          <DialogTitle>Change Password</DialogTitle>
        </DialogHeader>

        <Input
          id="password"
          placeholder="New Password"
          type="password"
          value={newPassword}
          onChange={e => setNewPassword(e.target.value)}
          className="mb-2"
        />

        <Input
          id="confirmPassword"
          placeholder="Confirm New Password"
          type="password"
          value={confirmPassword}
          onChange={e => setConfirmPassword(e.target.value)}
        />

        <DialogFooter>
          <Button
            onClick={handleResetPassword}
            disabled={
              !newPassword ||
              !confirmPassword ||
              newPassword !== confirmPassword ||
              loading
            }
          >
            {loading ? "Updating..." : "Confirm Change"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
