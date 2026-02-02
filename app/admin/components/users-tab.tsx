// app/admin/components/users-tab.tsx
"use client"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useState } from "react"
import { Input } from "@/components/ui/input"

export function UsersTab({ users }: { users: any[] }) {
  const [search, setSearch] = useState("")

  const filteredUsers = users.filter(u =>
    u.email?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>لیست کاربران ({users.length})</CardTitle>
        <Input
          placeholder="جستجو با ایمیل..."
          className="max-w-xs"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-right">کاربر</TableHead>
              <TableHead className="text-right">تاریخ عضویت</TableHead>
              <TableHead className="text-right">موجودی کیف پول</TableHead>
              <TableHead className="text-right">وضعیت</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUsers.map(user => (
              <TableRow key={user.id}>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-medium">{user.email}</span>
                    <span className="text-xs text-gray-500">{user.id}</span>
                  </div>
                </TableCell>
                <TableCell>
                  {new Date(user.created_at).toLocaleDateString("fa-IR")}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={user.balance > 0 ? "default" : "secondary"}
                    className="px-3 py-1 text-sm"
                  >
                    {user.balance.toLocaleString()} تومان
                  </Badge>
                </TableCell>
                <TableCell>
                  {user.confirmed_at ? (
                    <span className="text-xs font-bold text-green-600">
                      تایید شده
                    </span>
                  ) : (
                    <span className="text-xs font-bold text-yellow-600">
                      در انتظار تایید
                    </span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
