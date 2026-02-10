import React from 'react'
import { EntrepreneurWithSessions } from '@/types/entrepreneur'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Phone, Mail, MapPin, Briefcase, User } from 'lucide-react'
import { SessionBadge } from './SessionBadge'
import { normalizePhoneMY } from '@/lib/utils/phone'

interface EntrepreneurCardProps {
    entrepreneur: EntrepreneurWithSessions
}

export function EntrepreneurCard({ entrepreneur }: EntrepreneurCardProps) {
    const phoneLink = normalizePhoneMY(entrepreneur.phone)

    return (
        <Card className="mb-4">
            <CardContent className="p-4 space-y-4">
                {/* Header */}
                <div className="flex justify-between items-start">
                    <div>
                        <h3 className="font-bold text-lg">{entrepreneur.name}</h3>
                        {entrepreneur.business_name && (
                            <p className="text-sm text-slate-600 font-medium">{entrepreneur.business_name}</p>
                        )}
                    </div>
                    <Badge
                        variant={entrepreneur.assignment_status === 'Assigned' ? 'success' : 'warning'}
                    >
                        {entrepreneur.assignment_status}
                    </Badge>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-2 gap-2 text-sm text-slate-600">
                    <div className="flex items-center gap-1">
                        <Briefcase className="h-3 w-3" />
                        <span className="truncate">{entrepreneur.business_type || 'N/A'}</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        <span className="truncate">{entrepreneur.state || entrepreneur.zone || 'N/A'}</span>
                    </div>
                </div>

                {/* Session Info */}
                <div className="bg-slate-50 p-3 rounded-md">
                    <SessionBadge
                        count={entrepreneur.session_count}
                        engagementStatus={entrepreneur.engagement_status}
                        lastSessionDate={entrepreneur.last_session_date}
                        daysSinceLastSession={entrepreneur.days_since_last_session}
                    />
                </div>

                {/* Mentor Info (if assigned) */}
                {entrepreneur.mentor_name && (
                    <div className="flex items-center gap-2 text-sm text-slate-600 border-t pt-2">
                        <User className="h-3 w-3" />
                        <span>Mentor: <span className="font-medium text-slate-900">{entrepreneur.mentor_name}</span></span>
                    </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-2">
                    {entrepreneur.phone && (
                        <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            asChild
                        >
                            <a href={`tel:${phoneLink}`}>
                                <Phone className="h-3 w-3 mr-2" />
                                Call
                            </a>
                        </Button>
                    )}
                    {entrepreneur.email && (
                        <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            asChild
                        >
                            <a href={`mailto:${entrepreneur.email}`}>
                                <Mail className="h-3 w-3 mr-2" />
                                Email
                            </a>
                        </Button>
                    )}
                </div>
            </CardContent>
        </Card>
    )
}
