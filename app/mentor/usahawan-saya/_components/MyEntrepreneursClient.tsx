"use client"

import React from 'react'
import { MyEntrepreneur } from '@/types/entrepreneur'
import { ColumnDef } from '@tanstack/react-table'
import { Badge } from '@/components/ui/badge'
import { normalizePhoneMY } from '@/lib/utils/phone'
import { Phone, Mail } from 'lucide-react'
import { EntrepreneurTable } from '@/app/admin/usahawan/_components/EntrepreneurTable'

// Mentor-specific columns (no assignment status or mentor info needed)
const mentorColumns: ColumnDef<MyEntrepreneur>[] = [
    {
        accessorKey: "name",
        header: "Name",
        cell: ({ row }) => <div className="font-medium">{row.getValue("name")}</div>,
    },
    {
        accessorKey: "business_name",
        header: "Business",
        cell: ({ row }) => <div className="truncate max-w-[150px]" title={row.getValue("business_name")}>{row.getValue("business_name") || '-'}</div>,
    },
    {
        accessorKey: "phone",
        header: "Contact",
        cell: ({ row }) => {
            const phone = row.original.phone
            const email = row.original.email
            const normalizedPhone = normalizePhoneMY(phone)

            return (
                <div className="flex gap-2">
                    {phone && (
                        <a href={`tel:${normalizedPhone}`} title={phone} className="text-slate-500 hover:text-primary">
                            <Phone className="h-4 w-4" />
                        </a>
                    )}
                    {email && (
                        <a href={`mailto:${email}`} title={email} className="text-slate-500 hover:text-primary">
                            <Mail className="h-4 w-4" />
                        </a>
                    )}
                </div>
            )
        },
    },
    {
        accessorKey: "state",
        header: "Location",
        cell: ({ row }) => <div>{row.getValue("state") || row.original.zone || '-'}</div>,
    },
    {
        accessorKey: "program",
        header: "Program",
        cell: ({ row }) => {
            const program = row.getValue("program") as string
            return (
                <Badge variant={program === 'Bangkit' ? 'info' : 'warning'}>
                    {program}
                </Badge>
            )
        },
    },
    {
        accessorKey: "address",
        header: "Address",
        cell: ({ row }) => <div className="truncate max-w-[180px]" title={row.getValue("address")}>{row.getValue("address") || '-'}</div>,
    },
]

interface MyEntrepreneursClientProps {
    data: MyEntrepreneur[]
    mentorId: string
}

export default function MyEntrepreneursClient({ data, mentorId }: MyEntrepreneursClientProps) {
    return (
        <div className="p-4 md:p-8 space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Usahawan Saya</h1>
                <p className="text-slate-500">
                    Your assigned entrepreneurs contact directory ({data.length})
                </p>
            </div>

            <EntrepreneurTable
                columns={mentorColumns}
                data={data}
                loading={false}
            />
        </div>
    )
}
