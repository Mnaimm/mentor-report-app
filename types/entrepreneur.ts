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

// Simple directory type (no session tracking)
export interface EntrepreneurDirectory {
    id: string
    name: string
    business_name: string | null
    phone: string | null
    email: string
    address: string | null
    business_type: string | null
    state: string | null
    zone: string | null
    batch: string | null
    program: string
}

// Admin view includes assignment + mentor info
export interface EntrepreneurDirectoryAdmin extends EntrepreneurDirectory {
    assignment_status: 'Assigned' | 'Unassigned'
    mentor_name: string | null
    mentor_email: string | null
}

// Mentor view - just the entrepreneur contact info
export type MyEntrepreneur = EntrepreneurDirectory
