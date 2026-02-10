import React from 'react'
import { Badge } from '@/components/ui/badge'
import { EngagementStatus } from '@/types/entrepreneur'

interface SessionBadgeProps {
    count: number
    engagementStatus?: EngagementStatus
    lastSessionDate?: string | null
    daysSinceLastSession?: number | null
}

export function SessionBadge({
    count,
    engagementStatus,
    lastSessionDate,
    daysSinceLastSession
}: SessionBadgeProps) {

    // Session count logic
    let countVariant: "default" | "secondary" | "success" | "warning" | "danger" | "info" = "secondary"

    if (count === 0) countVariant = "secondary" // Gray
    else if (count >= 1 && count <= 3) countVariant = "warning" // Yellow
    else if (count >= 4 && count <= 6) countVariant = "info" // Blue
    else if (count >= 7) countVariant = "success" // Green

    const getEngagementBadge = () => {
        switch (engagementStatus) {
            case 'active':
                return <Badge variant="success">Active</Badge>
            case 'at-risk':
                return <Badge variant="warning">At Risk</Badge>
            case 'overdue':
                return <Badge variant="danger">Overdue</Badge>
            case 'new':
                return <Badge variant="info">New</Badge>
            default:
                return null
        }
    }

    const isDaysOverdue = daysSinceLastSession && daysSinceLastSession > 30

    // Format date helper
    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        })
    }

    return (
        <div className="flex flex-col gap-1 items-start">
            <div className="flex gap-2 items-center flex-wrap">
                <Badge variant={countVariant}>
                    {count} {count === 1 ? 'Session' : 'Sessions'}
                </Badge>
                {getEngagementBadge()}
            </div>

            {lastSessionDate ? (
                <span className="text-xs text-slate-500">
                    Last: {formatDate(lastSessionDate)}
                    {isDaysOverdue && (
                        <span className="text-red-500 font-medium ml-1">
                            (⚠️ {daysSinceLastSession} days)
                        </span>
                    )}
                </span>
            ) : (
                <span className="text-xs text-slate-400">No sessions yet</span>
            )}
        </div>
    )
}
