import { EntrepreneurWithSessions } from '@/types/entrepreneur'

function sanitizeCell(value: any): string {
    if (value === null || value === undefined) return ''
    const str = String(value)
    // Prevent Excel formula injection
    if (/^[=+\-@]/.test(str)) return `'${str}`
    return `"${str.replace(/"/g, '""')}"`
}

export function exportToCSV(data: EntrepreneurWithSessions[], filename: string) {
    const headers = [
        'Name', 'Business', 'Phone', 'Email', 'Address', 'Type',
        'State', 'Zone', 'Program', 'Batch', 'Sessions',
        'Last Session', 'Status', 'Mentor'
    ]

    const rows = data.map(e => [
        e.name,
        e.business_name || '',
        e.phone || '',
        e.email,
        e.address || '',
        e.business_type || '',
        e.state || '',
        e.zone || '',
        e.program,
        e.batch || '',
        e.session_count.toString(),
        e.last_session_date || 'No sessions',
        e.assignment_status,
        e.mentor_name || 'Unassigned',
    ].map(sanitizeCell))

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const BOM = '\uFEFF' // For Excel UTF-8
    const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
}
