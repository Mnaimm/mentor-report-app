import { ColumnDef } from "@tanstack/react-table"
import { EntrepreneurDirectoryAdmin } from "@/types/entrepreneur"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { normalizePhoneMY } from "@/lib/utils/phone"
import { ArrowUpDown, Mail, Phone } from "lucide-react"

export const columns: ColumnDef<EntrepreneurDirectoryAdmin>[] = [
    {
        accessorKey: "name",
        header: ({ column }) => {
            return (
                <Button
                    variant="ghost"
                    onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                >
                    Name
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            )
        },
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
        header: "Loc",
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
        accessorKey: "batch",
        header: "Batch",
        cell: ({ row }) => <div>{row.getValue("batch") || '-'}</div>,
    },
    {
        accessorKey: "assignment_status",
        header: "Status",
        cell: ({ row }) => {
            const status = row.getValue("assignment_status") as string
            const mentor = row.original.mentor_name

            return (
                <div className="flex flex-col gap-1">
                    <Badge variant={status === 'Assigned' ? 'success' : 'warning'}>
                        {status}
                    </Badge>
                    {mentor && <span className="text-xs text-slate-500 truncate max-w-[100px]" title={mentor}>{mentor}</span>}
                </div>
            )
        },
    },
    {
        accessorKey: "address",
        header: "Address",
        cell: ({ row }) => <div className="truncate max-w-[180px]" title={row.getValue("address")}>{row.getValue("address") || '-'}</div>,
    },
]
