"use client"

import React, { useState, useEffect } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { EntrepreneurDirectoryAdmin } from '@/types/entrepreneur'
import { exportToCSV } from '@/lib/utils/exportCSV'

interface EntrepreneursClientProps {
    initialData: EntrepreneurDirectoryAdmin[]
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
        batch: searchParams?.get('batch') || 'all',
        zone: searchParams?.get('zone') || 'all',
        program: searchParams?.get('program') || 'all',
        search: searchParams?.get('search') || '',
    })

    // UI state
    const [searchQuery, setSearchQuery] = useState(filters.search)
    const [expandedRow, setExpandedRow] = useState<number | null>(null)

    // Update URL on filter change (Debounced for search)
    useEffect(() => {
        const params = new URLSearchParams()
        if (filters.batch && filters.batch !== 'all') params.set('batch', filters.batch)
        if (filters.zone && filters.zone !== 'all') params.set('zone', filters.zone)
        if (filters.program && filters.program !== 'all') params.set('program', filters.program)
        if (filters.search) params.set('search', filters.search)

        const timeout = setTimeout(() => {
            setLoading(true)
            router.push(`${pathname}?${params.toString()}`)
        }, 300)

        return () => clearTimeout(timeout)
    }, [filters, router, pathname])

    // Sync data when initialData changes (after server fetch)
    useEffect(() => {
        setData(initialData)
        setLoading(false)
    }, [initialData])

    const handleFilterChange = (key: string, value: string) => {
        setFilters(prev => ({ ...prev, [key]: value }))
    }

    const handleSearchChange = (value: string) => {
        setSearchQuery(value)
        handleFilterChange('search', value)
    }

    // Helper function: get initials from name
    const getInitials = (name: string | undefined | null) => {
        if (!name) return '??'
        const words = name.trim().split(' ')
        if (words.length === 1) return words[0].substring(0, 2).toUpperCase()
        return (words[0][0] + words[words.length - 1][0]).toUpperCase()
    }

    // Helper function: convert to title case
    const toTitleCase = (str: string | undefined | null) => {
        if (!str) return ''
        return str
            .toLowerCase()
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ')
    }

    // Helper function: get program display name
    const getProgramName = (program: string | undefined | null) => {
        if (!program) return 'Unknown'
        if (program.toLowerCase().includes('bangkit')) return 'Bangkit'
        if (program.toLowerCase().includes('maju')) return 'Maju'
        return program
    }

    // Toggle row expansion
    const toggleRow = (index: number) => {
        setExpandedRow(expandedRow === index ? null : index)
    }

    // Handle action button clicks (prevent row expansion)
    const handleAction = (e: React.MouseEvent, action: string, data: string) => {
        e.stopPropagation()
        if (action === 'call') {
            window.location.href = `tel:${data}`
        } else if (action === 'email') {
            window.location.href = `mailto:${data}`
        }
    }

    // Count by program
    const bangkitCount = data.filter(e => getProgramName(e.program) === 'Bangkit').length
    const majuCount = data.filter(e => getProgramName(e.program) === 'Maju').length

    return (
        <>
            <div className="min-h-screen bg-[#F8FAFC]" style={{ fontFamily: '"DM Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
                {/* Header */}
                <div className="bg-white border-b border-gray-200">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center text-white text-xl">
                                        👥
                                    </div>
                                    <h1 className="text-2xl font-bold text-gray-900">Direktori Usahawan</h1>
                                </div>
                                <p className="text-sm text-gray-600 ml-[52px]">Directory of all entrepreneurs with contact information</p>
                            </div>
                        </div>

                        {/* Stat Pills */}
                        <div className="flex gap-3 mt-6">
                            <div className="px-4 py-2 bg-gray-100 rounded-full text-sm font-medium text-gray-700">
                                Total: <span className="font-bold">{data.length}</span>
                            </div>
                            <div className="px-4 py-2 bg-blue-50 rounded-full text-sm font-medium text-blue-700 border border-blue-200">
                                Bangkit: <span className="font-bold">{bangkitCount}</span>
                            </div>
                            <div className="px-4 py-2 bg-orange-50 rounded-full text-sm font-medium text-orange-700 border border-orange-200">
                                Maju: <span className="font-bold">{majuCount}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Main Content */}
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    {/* Toolbar */}
                    <div className="bg-white rounded-t-2xl border border-gray-200 border-b-0 px-6 py-4">
                        <div className="flex flex-col gap-4">
                            {/* First Row: Search + Filters */}
                            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                                {/* Search */}
                                <div className="relative flex-1 max-w-md">
                                    <input
                                        type="text"
                                        placeholder="Search name, business, email..."
                                        value={searchQuery}
                                        onChange={(e) => handleSearchChange(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                                    />
                                    <svg className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                    </svg>
                                </div>

                                {/* Filters Row */}
                                <div className="flex gap-2 flex-wrap">
                                    {/* Batch Filter */}
                                    <div className="relative">
                                        <select
                                            value={filters.batch}
                                            onChange={(e) => handleFilterChange('batch', e.target.value)}
                                            className="appearance-none px-3 py-2 pr-8 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer"
                                        >
                                            <option value="all">All Batches</option>
                                            {batches.map(b => (
                                                <option key={b} value={b}>{b}</option>
                                            ))}
                                        </select>
                                        <svg className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                        </svg>
                                    </div>

                                    {/* Zone Filter */}
                                    <div className="relative">
                                        <select
                                            value={filters.zone}
                                            onChange={(e) => handleFilterChange('zone', e.target.value)}
                                            className="appearance-none px-3 py-2 pr-8 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer"
                                        >
                                            <option value="all">All Zones</option>
                                            {zones.map(z => (
                                                <option key={z} value={z}>{z}</option>
                                            ))}
                                        </select>
                                        <svg className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                        </svg>
                                    </div>

                                    {/* Program Filter */}
                                    <div className="relative">
                                        <select
                                            value={filters.program}
                                            onChange={(e) => handleFilterChange('program', e.target.value)}
                                            className="appearance-none px-3 py-2 pr-8 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer"
                                        >
                                            <option value="all">All Programs</option>
                                            <option value="Bangkit">Bangkit</option>
                                            <option value="Maju">Maju</option>
                                        </select>
                                        <svg className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                        </svg>
                                    </div>

                                    {/* Export Button */}
                                    <button
                                        onClick={() => exportToCSV(data, 'usahawan_directory')}
                                        className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors flex items-center gap-2"
                                    >
                                        <span>⬇</span>
                                        Export
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Hint */}
                        <p className="text-xs text-gray-500 mt-3">
                            💡 Klik pada mana-mana baris untuk lihat alamat penuh
                        </p>
                    </div>

                    {/* Table */}
                    <div className="bg-white rounded-b-2xl border border-gray-200 shadow-sm overflow-hidden">
                        {loading && (
                            <div className="px-6 py-4 bg-blue-50 border-b border-blue-200">
                                <p className="text-sm text-blue-700">🔄 Loading...</p>
                            </div>
                        )}

                        {!loading && data.length === 0 && (
                            <div className="px-6 py-12 text-center">
                                <p className="text-gray-500">Tiada usahawan dijumpai</p>
                            </div>
                        )}

                        {!loading && data.length > 0 && (
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="bg-[#F8FAFC] border-b border-gray-200">
                                            <th className="text-left px-6 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Usahawan</th>
                                            <th className="text-left px-6 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Perniagaan</th>
                                            <th className="text-left px-6 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Mentor</th>
                                            <th className="text-left px-6 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Lokasi</th>
                                            <th className="text-left px-6 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Program</th>
                                            <th className="text-left px-6 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Hubungi</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data.map((entrepreneur, index) => {
                                            const isExpanded = expandedRow === index
                                            const programName = getProgramName(entrepreneur.program)

                                            return (
                                                <React.Fragment key={entrepreneur.id || index}>
                                                    {/* Main Row */}
                                                    <tr
                                                        onClick={() => toggleRow(index)}
                                                        className={`border-b border-[#F1F5F9] cursor-pointer transition-colors ${
                                                            isExpanded ? 'bg-[#EFF6FF]' : 'hover:bg-[#FAFBFF]'
                                                        }`}
                                                    >
                                                        {/* Usahawan */}
                                                        <td className="px-6 py-4">
                                                            <div className="flex items-center gap-3">
                                                                <div
                                                                    className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold ${
                                                                        programName === 'Bangkit' ? 'bg-blue-500' : 'bg-orange-500'
                                                                    }`}
                                                                >
                                                                    {getInitials(entrepreneur.name)}
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <span className="font-medium text-gray-900">
                                                                        {toTitleCase(entrepreneur.name)}
                                                                    </span>
                                                                    <svg
                                                                        className={`w-4 h-4 transition-transform ${
                                                                            isExpanded ? 'rotate-180 text-blue-600' : 'text-gray-400'
                                                                        }`}
                                                                        fill="none"
                                                                        stroke="currentColor"
                                                                        viewBox="0 0 24 24"
                                                                    >
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                                    </svg>
                                                                </div>
                                                            </div>
                                                        </td>

                                                        {/* Perniagaan */}
                                                        <td className="px-6 py-4 text-sm text-gray-700">
                                                            {entrepreneur.business_name || '-'}
                                                        </td>

                                                        {/* Mentor */}
                                                        <td className="px-6 py-4 text-sm text-gray-700">
                                                            {entrepreneur.mentor_name ? toTitleCase(entrepreneur.mentor_name) : <span className="text-gray-400">—</span>}
                                                        </td>

                                                        {/* Lokasi */}
                                                        <td className="px-6 py-4 text-sm text-gray-700">
                                                            {entrepreneur.zone || entrepreneur.state || '-'}
                                                        </td>

                                                        {/* Program */}
                                                        <td className="px-6 py-4">
                                                            <span
                                                                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
                                                                    programName === 'Bangkit'
                                                                        ? 'bg-[#EFF6FF] text-[#1D4ED8] border border-[#BFDBFE]'
                                                                        : 'bg-[#FFF7ED] text-[#C2410C] border border-[#FED7AA]'
                                                                }`}
                                                            >
                                                                <span
                                                                    className={`w-1.5 h-1.5 rounded-full ${
                                                                        programName === 'Bangkit' ? 'bg-[#3B82F6]' : 'bg-[#F97316]'
                                                                    }`}
                                                                />
                                                                {programName}
                                                            </span>
                                                        </td>

                                                        {/* Hubungi */}
                                                        <td className="px-6 py-4">
                                                            <div className="flex items-center gap-2">
                                                                {entrepreneur.phone && (
                                                                    <button
                                                                        onClick={(e) => handleAction(e, 'call', entrepreneur.phone)}
                                                                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                                                                        title="Telefon"
                                                                    >
                                                                        📞
                                                                    </button>
                                                                )}
                                                                {entrepreneur.email && (
                                                                    <button
                                                                        onClick={(e) => handleAction(e, 'email', entrepreneur.email)}
                                                                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                                                                        title="E-mel"
                                                                    >
                                                                        ✉️
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>

                                                    {/* Expanded Address Row */}
                                                    {isExpanded && (
                                                        <tr className="bg-[#EFF6FF] border-b border-[#BFDBFE]">
                                                            <td colSpan={6} className="px-6 py-0">
                                                                <div
                                                                    className="overflow-hidden transition-all duration-300"
                                                                    style={{
                                                                        maxHeight: isExpanded ? '120px' : '0px'
                                                                    }}
                                                                >
                                                                    <div className="py-4">
                                                                        <div className="flex items-start gap-3 bg-white rounded-lg p-4 border border-blue-200">
                                                                            <span className="text-2xl">🏠</span>
                                                                            <div className="flex-1">
                                                                                <p className="text-xs font-semibold text-gray-500 uppercase mb-1">
                                                                                    Alamat Premis
                                                                                </p>
                                                                                <p className="text-sm text-gray-700 mb-2">
                                                                                    {entrepreneur.address || 'Alamat tidak tersedia'}
                                                                                </p>
                                                                                {entrepreneur.address && (
                                                                                    <a
                                                                                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(entrepreneur.address)}`}
                                                                                        target="_blank"
                                                                                        rel="noopener noreferrer"
                                                                                        onClick={(e) => e.stopPropagation()}
                                                                                        className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
                                                                                    >
                                                                                        🗺 Buka di Google Maps →
                                                                                    </a>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    )}
                                                </React.Fragment>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {/* Footer */}
                        <div className="px-6 py-4 bg-[#F8FAFC] border-t border-gray-200 flex items-center justify-between">
                            <p className="text-sm text-gray-600">
                                Menunjukkan <span className="font-semibold">{data.length}</span> usahawan
                            </p>
                            <p className="text-sm text-gray-500">iTEKAD Mentor Portal</p>
                        </div>
                    </div>
                </div>
            </div>
        </>
    )
}
