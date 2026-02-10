"use client"

import React from 'react'
import { EntrepreneurWithSessions } from '@/types/entrepreneur'
import { EntrepreneurTable } from '@/app/admin/entrepreneurs/_components/EntrepreneurTable'
import { columns } from '@/app/admin/entrepreneurs/_components/columns'
import { StatisticsCards } from './StatisticsCard'

interface MyEntrepreneursClientProps {
    data: EntrepreneurWithSessions[]
    mentorId: string
}

export default function MyEntrepreneursClient({ data, mentorId }: MyEntrepreneursClientProps) {
    // Statistics Calculation
    const totalEntrepreneurs = data.length
    const totalSessions = data.reduce((acc, curr) => acc + curr.session_count, 0)
    const avgSessions = totalEntrepreneurs > 0 ? totalSessions / totalEntrepreneurs : 0
    const overdueCount = data.filter(e => e.engagement_status === 'overdue').length

    // Filter columns for Mentor View (remove Mentor Name and Assignment Status as they are redundant)
    // We keep 'assignment_status' if we want to show it, but 'Mentor Name' is obviously the logged in mentor.
    // The 'columns' from admin might be too broad. Let's start with all and maybe hide some via CSS or custom definition if needed.
    // Actually, TanStack table allows hiding columns easily, but we haven't implemented column visibility toggles.
    // For now, reusing the admin columns is fine, maybe redundant user name but acceptable.

    return (
        <div className="p-4 md:p-8 space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">My Entrepreneurs</h1>
                <p className="text-slate-500">Manage your assigned entrepreneurs and track their progress.</p>
            </div>

            <StatisticsCards
                totalEntrepreneurs={totalEntrepreneurs}
                totalSessions={totalSessions}
                avgSessions={avgSessions}
                overdueCount={overdueCount}
            />

            <EntrepreneurTable
                columns={columns}
                data={data}
                loading={false}
            />
        </div>
    )
}
