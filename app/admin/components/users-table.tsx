"use client"

import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table"
import { deleteUser } from "../actions"
import { toast } from "sonner"
import { useState } from "react"
import { FiTrash2 } from "react-icons/fi"

export function UsersTable({ users }: { users: any[] }) {
  const [loadingId, setLoadingId] = useState<string | null>(null)

  const handleDelete = async (id: string) => {
    if (!confirm("آیا از حذف این کاربر اطمینان دارید؟")) return

    setLoadingId(id)
    try {
      await deleteUser(id)
      toast.success("کاربر حذف شد")
    } catch (e) {
      toast.error("خطا در حذف")
    } finally {
      setLoadingId(null)
    }
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>ایمیل</TableHead>
          <TableHead>تاریخ عضویت</TableHead>
          <TableHead>آخرین ورود</TableHead>
          <TableHead>عملیات</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {users.map(user => (
          <TableRow key={user.id}>
            <TableCell>{user.email}</TableCell>
            <TableCell>
              {new Date(user.created_at).toLocaleDateString("fa-IR")}
            </TableCell>
            <TableCell>
              {user.last_sign_in_at
                ? new Date(user.last_sign_in_at).toLocaleDateString("fa-IR")
                : "-"}
            </TableCell>
            <TableCell>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => handleDelete(user.id)}
                disabled={loadingId === user.id}
              >
                <FiTrash2 />
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
