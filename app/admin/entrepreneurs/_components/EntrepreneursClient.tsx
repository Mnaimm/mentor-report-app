"use client"

import React, { useState, useEffect } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { EntrepreneurWithSessions } from '@/types/entrepreneur'
import { columns } from './columns'
import { EntrepreneurTable } from './EntrepreneurTable'
import { Filters } from './Filters'
import { exportToCSV } from '@/lib/utils/exportCSV'
import { SortingState } from '@tanstack/react-table'

interface EntrepreneursClientProps {
    initialData: EntrepreneurWithSessions[]
    batches: string[]
    zones: string[]
}

export default function EntrepreneursClient({
    initialData,
    batches,
    zones
}: EntrepreneursClientProps) {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    // Local state for immediate UI feedback
    const [data, setData] = useState(initialData)
    const [loading, setLoading] = useState(false)

    // Filter State
    const [filters, setFilters] = useState({
        batch: searchParams.get('batch') || 'all',
        zone: searchParams.get('zone') || 'all',
        program: searchParams.get('program') || 'all',
        search: searchParams.get('search') || '',
    })

    // Sorting State
    const [sorting, setSorting] = useState<SortingState>([])

    // Update URL on filter/sort change (Debounced for search)
    useEffect(() => {
        const params = new URLSearchParams()
        if (filters.batch && filters.batch !== 'all') params.set('batch', filters.batch)
        if (filters.zone && filters.zone !== 'all') params.set('zone', filters.zone)
        if (filters.program && filters.program !== 'all') params.set('program', filters.program)
        if (filters.search) params.set('search', filters.search)

        if (sorting.length > 0) {
            const sort = sorting[0]
            params.set('sort', `${sort.id}_${sort.desc ? 'desc' : 'asc'}`)
        }

        const timeout = setTimeout(() => {
            setLoading(true)
            router.push(`${pathname}?${params.toString()}`)
        }, 300)

        return () => clearTimeout(timeout)
    }, [filters, sorting, router, pathname])

    // Sync data when initialData changes (after server fetch)
    useEffect(() => {
        setData(initialData)
        setLoading(false)
    }, [initialData])

    const handleFilterChange = (key: string, value: string) => {
        setFilters(prev => ({ ...prev, [key]: value }))
    }

    return (
        <div className="p-4 md:p-8 space-y-4">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold tracking-tight">Entrepreneurs</h1>
                <div className="text-sm text-slate-500">
                    Total: {data.length}
                </div>
            </div>

            <Filters
                batches={batches}
                zones={zones}
                filters={filters}
                setFilter={handleFilterChange}
                onExport={() => exportToCSV(data, 'entrepreneurs_master')}
            />

            <EntrepreneurTable
                columns={columns}
                data={data}
                loading={loading}
                sorting={sorting}
                onSortingChange={setSorting}
            />
        </div>
    )
}
