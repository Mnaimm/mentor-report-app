export type EngagementStatus = 'new' | 'active' | 'at-risk' | 'overdue'

export interface Entrepreneur {
    id: string
    name: string
    email: string
    business_name: string | null
    phone: string | null
    address: string | null
    zone: string | null
    batch: string | null
    program: 'Bangkit' | 'Maju'
    status: string | null
    business_type: string | null
    state: string | null
}

export interface EntrepreneurWithSessions extends Entrepreneur {
    assignment_status: 'Assigned' | 'Unassigned'
    mentor_name: string | null
    mentor_email: string | null
    assigned_at: string | null
    session_count: number
    last_session_date: string | null
    latest_session_number: number | null
    days_since_last_session: number | null
    engagement_status?: EngagementStatus
}
