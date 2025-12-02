"use client"

import { useState, useEffect } from "react"
import {
  uploadCustomerExcel,
  getGroupsAndOfficers,
  assignOfficerToGroup
} from "@/app/actions/mapping-actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card"
import { toast } from "sonner"
import {
  Loader2,
  UploadCloud,
  Users,
  FileSpreadsheet,
  ShieldCheck
} from "lucide-react"

export function GroupSettings({
  workspaceId,
  workspaceUsers
}: {
  workspaceId: string
  workspaceUsers: any[]
}) {
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [groups, setGroups] = useState<
    { name: string; assignedOfficerId: string | null }[]
  >([])

  // بارگذاری لیست گروه‌ها در زمان باز شدن صفحه
  useEffect(() => {
    loadGroups()
  }, [])

  const loadGroups = async () => {
    const data = await getGroupsAndOfficers(workspaceId)
    setGroups(data)
  }

  const handleUpload = async () => {
    if (!file) return toast.error("لطفا فایل اکسل را انتخاب کنید")
    setUploading(true)

    const formData = new FormData()
    formData.append("file", file)

    const res = await uploadCustomerExcel(workspaceId, formData)
    setUploading(false)

    if (res.success) {
      toast.success(`✅ ${res.count} مشتری با موفقیت ایمپورت شد!`)
      setFile(null)
      // پاک کردن ورودی فایل
      const fileInput = document.getElementById(
        "excel-upload"
      ) as HTMLInputElement
      if (fileInput) fileInput.value = ""

      loadGroups() // رفرش کردن لیست گروه‌ها
    } else {
      toast.error(`خطا: ${res.error}`)
    }
  }

  const handleAssign = async (groupName: string, officerId: string) => {
    const loadingToast = toast.loading("در حال ذخیره...")
    const res = await assignOfficerToGroup(workspaceId, groupName, officerId)

    if (res.success) {
      toast.success(`مسئول گروه "${groupName}" ذخیره شد`, { id: loadingToast })
      loadGroups()
    } else {
      toast.error("خطا در ذخیره مسئول", { id: loadingToast })
    }
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* --- کارت ۱: آپلود اکسل --- */}
      <Card className="border-t-4 border-t-blue-600 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileSpreadsheet className="size-5 text-blue-600" />
            بارگذاری لیست مشتریان
          </CardTitle>
          <CardDescription>
            فایل اکسل شامل دو ستون <b>Customer</b> (نام مشتری) و <b>Group</b>{" "}
            (گروه) را آپلود کنید.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid w-full max-w-sm items-center gap-1.5">
            <Input
              id="excel-upload"
              type="file"
              accept=".xlsx, .xls"
              className="cursor-pointer bg-blue-50/50"
              onChange={e => setFile(e.target.files?.[0] || null)}
            />
          </div>
          <Button
            onClick={handleUpload}
            disabled={uploading || !file}
            className="w-full bg-blue-600 hover:bg-blue-700"
          >
            {uploading ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" /> در حال
                پردازش...
              </>
            ) : (
              <>
                <UploadCloud className="mr-2 size-4" /> آپلود و بروزرسانی
                مشتریان
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* --- کارت ۲: تخصیص مسئول --- */}
      <Card className="border-t-4 border-t-green-600 shadow-sm md:col-span-2 lg:col-span-1">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ShieldCheck className="size-5 text-green-600" />
            تخصیص مسئول پیگیری
          </CardTitle>
          <CardDescription>
            برای هر گروه مشتری شناسایی شده، یک مسئول انتخاب کنید.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {groups.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed py-8 text-gray-400">
              <Users className="mb-2 size-10 opacity-20" />
              <p className="text-sm">
                هنوز گروهی یافت نشد. ابتدا فایل اکسل را آپلود کنید.
              </p>
            </div>
          ) : (
            <div className="max-h-[300px] space-y-4 overflow-y-auto pr-2">
              {groups.map((g, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between rounded-lg border bg-white p-3 shadow-sm"
                >
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{g.name}</span>
                    <span className="text-[10px] text-gray-400">
                      گروه مشتریان
                    </span>
                  </div>
                  <Select
                    defaultValue={g.assignedOfficerId || undefined}
                    onValueChange={val => handleAssign(g.name, val)}
                  >
                    <SelectTrigger className="h-9 w-[180px] text-xs">
                      <SelectValue placeholder="انتخاب مسئول..." />
                    </SelectTrigger>
                    <SelectContent>
                      {workspaceUsers.map(u => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.full_name || u.email || "کاربر بدون نام"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
