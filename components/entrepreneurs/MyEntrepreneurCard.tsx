import React from 'react'
import { MyEntrepreneur } from '@/types/entrepreneur'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Phone, Mail, MapPin } from 'lucide-react'
import { normalizePhoneMY } from '@/lib/utils/phone'

interface MyEntrepreneurCardProps {
    entrepreneur: MyEntrepreneur
}

export function MyEntrepreneurCard({ entrepreneur }: MyEntrepreneurCardProps) {
    const phoneLink = normalizePhoneMY(entrepreneur.phone)

    return (
        <Card className="mb-4">
            <CardContent className="p-4 space-y-3">
                {/* Name & Business */}
                <div>
                    <h3 className="font-bold text-lg">{entrepreneur.name}</h3>
                    {entrepreneur.business_name && (
                        <p className="text-sm text-slate-600 font-medium">{entrepreneur.business_name}</p>
                    )}
                </div>

                {/* Location & Program Badge */}
                <div className="flex items-center gap-2 text-sm">
                    <div className="flex items-center gap-1 text-slate-600">
                        <MapPin className="h-3 w-3" />
                        <span>{entrepreneur.state || entrepreneur.zone || 'N/A'}</span>
                    </div>
                    <span className="text-slate-300">•</span>
                    <Badge variant={entrepreneur.program === 'Bangkit' ? 'info' : 'warning'}>
                        {entrepreneur.program}
                    </Badge>
                </div>

                {/* Address */}
                {entrepreneur.address && (
                    <div className="text-sm text-slate-600 bg-slate-50 p-2 rounded border border-slate-200">
                        {entrepreneur.address}
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
