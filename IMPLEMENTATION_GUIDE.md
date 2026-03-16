markdown# iTEKAD Mentor Portal - Entrepreneur Directory Views
## Implementation Guide for Antigravity AI / Claude Code / Cursor

---

## 📋 Table of Contents
1. [Overview](#overview)
2. [Database Setup](#database-setup)
3. [Supabase MCP Configuration](#supabase-mcp-configuration)
4. [File Structure](#file-structure)
5. [TypeScript Types](#typescript-types)
6. [Utility Functions](#utility-functions)
7. [Shared Components](#shared-components)
8. [Admin View Implementation](#admin-view-implementation)
9. [Mentor View Implementation](#mentor-view-implementation)
10. [Testing Checklist](#testing-checklist)

---

## Overview

Building **two simplified directory views** for iTEKAD Mentor Portal:

1. **Admin View** (`/admin/usahawan`) - Contact directory for all entrepreneurs with filtering
2. **Mentor View** (`/mentor/usahawan-saya`) - Simple contact list of assigned entrepreneurs

**Key Principle:** Remove ALL session tracking (already on dashboards). Focus on contact information only.

### Tech Stack
- Next.js 14+ (App Router)
- TypeScript
- Supabase (via MCP)
- TanStack Table v8
- Tailwind CSS + shadcn/ui

---

## Database Setup

### Step 1: Run in Supabase SQL Editor
```sql
-- ==================================================
-- ADMIN: Simplified Entrepreneur Directory Function
-- ==================================================
CREATE OR REPLACE FUNCTION get_entrepreneurs_directory(
  p_batch varchar DEFAULT 'all',
  p_zone varchar DEFAULT 'all',
  p_program varchar DEFAULT 'all',
  p_search varchar DEFAULT '',
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  name varchar,
  business_name varchar,
  phone varchar,
  email varchar,
  address text,
  business_type varchar,
  state varchar,
  zone varchar,
  batch varchar,
  program varchar,
  assignment_status text,
  mentor_name varchar,
  mentor_email varchar
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    e.id,
    e.name,
    e.business_name,
    e.phone,
    e.email,
    e.address,
    e.business_type,
    e.state,
    e.zone,
    e.batch,
    e.program::varchar,
    
    CASE 
      WHEN ma.id IS NOT NULL THEN 'Assigned'
      ELSE 'Unassigned'
    END as assignment_status,
    
    m.name as mentor_name,
    m.email as mentor_email
    
  FROM entrepreneurs e
  
  LEFT JOIN mentor_assignments ma 
    ON e.id = ma.entrepreneur_id 
    AND ma.is_active = true
  
  LEFT JOIN mentors m 
    ON ma.mentor_id = m.id
  
  WHERE 1=1
    AND (p_batch = 'all' OR e.batch = p_batch)
    AND (p_zone = 'all' OR e.zone = p_zone)
    AND (p_program = 'all' OR e.program::text = p_program)
    AND (
      p_search = '' OR
      e.name ILIKE '%' || p_search || '%' OR
      e.business_name ILIKE '%' || p_search || '%' OR
      e.email ILIKE '%' || p_search || '%'
    )
  
  ORDER BY e.name ASC
  LIMIT p_limit OFFSET p_offset;
END;
$$;

-- ==================================================
-- MENTOR: My Entrepreneurs Directory Function
-- ==================================================
CREATE OR REPLACE FUNCTION get_my_entrepreneurs_directory(
  p_mentor_id uuid
)
RETURNS TABLE (
  id uuid,
  name varchar,
  business_name varchar,
  phone varchar,
  email varchar,
  address text,
  business_type varchar,
  state varchar,
  zone varchar,
  batch varchar,
  program varchar
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    e.id,
    e.name,
    e.business_name,
    e.phone,
    e.email,
    e.address,
    e.business_type,
    e.state,
    e.zone,
    e.batch,
    e.program::varchar
    
  FROM entrepreneurs e
  INNER JOIN mentor_assignments ma 
    ON e.id = ma.entrepreneur_id
  
  WHERE ma.mentor_id = p_mentor_id
    AND ma.is_active = true
  
  ORDER BY e.name ASC;
END;
$$;

-- Test queries
SELECT * FROM get_entrepreneurs_directory(p_limit := 5);
-- Replace with actual mentor ID:
SELECT * FROM get_my_entrepreneurs_directory('09ca902a-a533-422a-9761-06b465796a73'::uuid);
```

---

## Supabase MCP Configuration

### For Antigravity AI / Claude Code

**Using Supabase MCP Server:**

The AI assistant can access your Supabase database directly via the Supabase MCP server. Make sure you have:

1. **Supabase Project ID** from your project settings
2. **Connection configured** in the MCP settings

**When calling functions via MCP:**
```typescript
// The AI will use MCP to call:
await supabase.rpc('get_entrepreneurs_directory', {
  p_batch: 'Batch 5 Bangkit',
  p_zone: 'all',
  p_program: 'all',
  p_search: '',
  p_limit: 50,
  p_offset: 0
})
```

**Important for AI Assistant:**
- Use `supabase.rpc()` for calling database functions
- All parameters must match the function signature exactly
- Return types are inferred from the RETURNS TABLE clause
- Use proper TypeScript types based on database schema

---

## File Structure
```
app/
├── admin/
│   └── usahawan/
│       ├── page.tsx                    # Server component
│       └── _components/
│           ├── UsahawanClient.tsx      # Client wrapper
│           ├── UsahawanTable.tsx       # TanStack table
│           ├── columns.tsx             # Column definitions
│           └── Filters.tsx             # Filter components
│
└── mentor/
    └── usahawan-saya/
        ├── page.tsx                    # Server component
        └── _components/
            ├── UsahawanSayaClient.tsx  # Client wrapper
            └── columns.tsx             # Column definitions

components/entrepreneurs/
├── ContactInfo.tsx                     # Phone + Email display
└── EntrepreneurCard.tsx                # Mobile card view

lib/
├── supabase/
│   └── queries/
│       └── entrepreneurs.ts            # RPC functions
└── utils/
    ├── exportCSV.ts                    # CSV export
    └── phone.ts                        # Phone normalization

types/
└── entrepreneur.ts                     # TypeScript interfaces
```

---

## TypeScript Types

**File:** `types/entrepreneur.ts`
```typescript
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
  program: 'Bangkit' | 'Maju'
}

// Admin view extends with assignment info
export interface EntrepreneurDirectoryAdmin extends EntrepreneurDirectory {
  assignment_status: 'Assigned' | 'Unassigned'
  mentor_name: string | null
  mentor_email: string | null
}

// Mentor view uses base type
export type MyEntrepreneur = EntrepreneurDirectory
```

---

## Utility Functions

### Phone Normalization

**File:** `lib/utils/phone.ts`
```typescript
/**
 * Normalize Malaysian phone numbers to international format
 * Examples:
 *   011-2345678 → +60112345678
 *   013 234 5678 → +60132345678
 *   60123456789 → +60123456789
 */
export function normalizePhoneMY(phone?: string | null): string | null {
  if (!phone) return null
  
  // Remove spaces, dashes, parentheses
  let normalized = phone.replace(/[\s\-()]/g, '')
  
  // Handle Malaysian numbers starting with 0
  if (normalized.startsWith('0')) {
    normalized = '+60' + normalized.slice(1)
  } 
  // Add +60 if no country code
  else if (!normalized.startsWith('+')) {
    normalized = '+60' + normalized
  }
  
  return normalized
}
```

### CSV Export with Security

**File:** `lib/utils/exportCSV.ts`
```typescript
import { EntrepreneurDirectoryAdmin, MyEntrepreneur } from '@/types/entrepreneur'

/**
 * Sanitize cell value to prevent Excel formula injection
 */
function sanitizeCell(value: any): string {
  if (value === null || value === undefined) return ''
  
  const str = String(value)
  
  // Prevent Excel formula injection
  if (/^[=+\-@]/.test(str)) {
    return `'${str}`
  }
  
  // Escape quotes
  return `"${str.replace(/"/g, '""')}"`
}

/**
 * Export entrepreneurs to CSV with UTF-8 BOM
 */
export function exportEntrepreneursToCSV(
  data: EntrepreneurDirectoryAdmin[] | MyEntrepreneur[],
  filename: string = 'usahawan'
) {
  const headers = [
    'Name',
    'Business',
    'Phone',
    'Email',
    'Address',
    'Business Type',
    'State',
    'Zone',
    'Program',
    'Batch',
  ]
  
  // Add admin columns if present
  if (data.length > 0 && 'mentor_name' in data[0]) {
    headers.push('Assignment Status', 'Mentor')
  }
  
  const rows = data.map(e => {
    const row = [
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
    ]
    
    if ('mentor_name' in e) {
      row.push(
        e.assignment_status,
        e.mentor_name || 'Unassigned'
      )
    }
    
    return row.map(sanitizeCell)
  })
  
  const csv = [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n')
  
  // Add BOM for Excel UTF-8 support
  const BOM = '\uFEFF'
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
```

---

## Shared Components

### Contact Info Component

**File:** `components/entrepreneurs/ContactInfo.tsx`
```typescript
'use client'

import { Phone, Mail } from 'lucide-react'
import { normalizePhoneMY } from '@/lib/utils/phone'

interface ContactInfoProps {
  phone?: string | null
  email: string
  compact?: boolean
}

export function ContactInfo({ phone, email, compact = false }: ContactInfoProps) {
  return (
    
      {phone && (
        
          
          {phone}
        
      )}
      
        
        {email}
      
    
  )
}
```

### Mobile Card Component

**File:** `components/entrepreneurs/EntrepreneurCard.tsx`
```typescript
'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ContactInfo } from './ContactInfo'
import { Building2, MapPin } from 'lucide-react'
import { normalizePhoneMY } from '@/lib/utils/phone'

interface EntrepreneurCardProps {
  entrepreneur: {
    name: string
    business_name: string | null
    phone: string | null
    email: string
    address: string | null
    state: string | null
    zone: string | null
    program: string
    mentor_name?: string | null
  }
  showMentor?: boolean
}

export function EntrepreneurCard({ entrepreneur, showMentor = false }: EntrepreneurCardProps) {
  return (
    
      {/* Header */}
      
        {entrepreneur.name}
        
          
          {entrepreneur.business_name || 'No business name'}
        
      

      {/* Contact */}
      

      {/* Location */}
      
        
        {entrepreneur.state || 'N/A'}
        {entrepreneur.zone && (
          
            {entrepreneur.zone}
          
        )}
      

      {/* Program */}
      <Badge 
        variant={entrepreneur.program === 'Bangkit' ? 'default' : 'secondary'}
        className="w-fit"
      >
        {entrepreneur.program}
      

      {/* Address */}
      {entrepreneur.address && (
        
          {entrepreneur.address}
        
      )}

      {/* Mentor (admin view) */}
      {showMentor && entrepreneur.mentor_name && (
        
          Mentor: {entrepreneur.mentor_name}
        
      )}

      {/* Quick Actions */}
      
        
          
            Call
          
        
        
          
            Email
          
        
      
    
  )
}
```

---

## Admin View Implementation

### Query Function

**File:** `lib/supabase/queries/entrepreneurs.ts`
```typescript
import { createClient } from '@/lib/supabase/server'
import { EntrepreneurDirectoryAdmin } from '@/types/entrepreneur'

export async function getEntrepreneursDirectory(params: {
  batch?: string
  zone?: string
  program?: string
  search?: string
  limit?: number
  offset?: number
}) {
  const {
    batch = 'all',
    zone = 'all',
    program = 'all',
    search = '',
    limit = 50,
    offset = 0,
  } = params

  const supabase = await createClient()
  
  const { data, error } = await supabase.rpc('get_entrepreneurs_directory', {
    p_batch: batch,
    p_zone: zone,
    p_program: program,
    p_search: search,
    p_limit: limit,
    p_offset: offset,
  })
  
  if (error) throw error
  return data as EntrepreneurDirectoryAdmin[]
}

export async function getFilterOptions() {
  const supabase = await createClient()
  
  const [batchesRes, zonesRes, programsRes] = await Promise.all([
    supabase.from('entrepreneurs').select('batch').not('batch', 'is', null),
    supabase.from('entrepreneurs').select('zone').not('zone', 'is', null),
    supabase.from('entrepreneurs').select('program'),
  ])
  
  return {
    batches: Array.from(new Set(batchesRes.data?.map(b => b.batch) || [])).sort(),
    zones: Array.from(new Set(zonesRes.data?.map(z => z.zone) || [])).sort(),
    programs: Array.from(new Set(programsRes.data?.map(p => p.program) || [])),
  }
}
```

### Server Page

**File:** `app/admin/usahawan/page.tsx`
```typescript
import { Suspense } from 'react'
import { getEntrepreneursDirectory, getFilterOptions } from '@/lib/supabase/queries/entrepreneurs'
import UsahawanClient from './_components/UsahawanClient'
import { Skeleton } from '@/components/ui/skeleton'

interface PageProps {
  searchParams: Promise
}

export default async function AdminUsahawanPage({ searchParams }: PageProps) {
  const params = await searchParams
  
  try {
    const [entrepreneurs, filterOptions] = await Promise.all([
      getEntrepreneursDirectory({
        batch: params.batch || 'all',
        zone: params.zone || 'all',
        program: params.program || 'all',
        search: params.search || '',
      }),
      getFilterOptions(),
    ])
    
    return (
      
        
          Direktori Usahawan
          
            Directory of all entrepreneurs with contact information
          
        
        
        }>
          
        
      
    )
  } catch (error) {
    console.error('Error loading entrepreneurs:', error)
    return (
      
        
          Error Loading Data
          
            {error instanceof Error ? error.message : 'Failed to load entrepreneurs'}
          
        
      
    )
  }
}
```

### Column Definitions

**File:** `app/admin/usahawan/_components/columns.tsx`
```typescript
'use client'

import { ColumnDef } from '@tanstack/react-table'
import { EntrepreneurDirectoryAdmin } from '@/types/entrepreneur'
import { Badge } from '@/components/ui/badge'
import { ContactInfo } from '@/components/entrepreneurs/ContactInfo'
import { ArrowUpDown } from 'lucide-react'
import { Button } from '@/components/ui/button'

export const columns: ColumnDef[] = [
  {
    accessorKey: 'name',
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
      >
        Name
        
      
    ),
    cell: ({ row }) => (
      {row.getValue('name')}
    ),
  },
  {
    accessorKey: 'business_name',
    header: 'Business',
    cell: ({ row }) => (
      
        {row.getValue('business_name') || '-'}
      
    ),
  },
  {
    id: 'contact',
    header: 'Contact',
    cell: ({ row }) => (
      
    ),
  },
  {
    id: 'location',
    header: 'Location',
    cell: ({ row }) => (
      
        {row.original.state || 'N/A'}
        {row.original.zone && (
          
            {row.original.zone}
          
        )}
      
    ),
  },
  {
    accessorKey: 'program',
    header: 'Program',
    cell: ({ row }) => {
      const program = row.getValue('program') as string
      return (
        <Badge variant={program === 'Bangkit' ? 'default' : 'secondary'}>
          {program}
        
      )
    },
  },
  {
    accessorKey: 'batch',
    header: 'Batch',
    cell: ({ row }) => (
      {row.getValue('batch') || '-'}
    ),
  },
  {
    accessorKey: 'assignment_status',
    header: 'Status',
    cell: ({ row }) => {
      const status = row.getValue('assignment_status') as string
      return (
        <Badge 
          variant={status === 'Assigned' ? 'default' : 'secondary'}
        >
          {status}
        
      )
    },
  },
  {
    accessorKey: 'mentor_name',
    header: 'Mentor',
    cell: ({ row }) => (
      
        {row.getValue('mentor_name') || '-'}
      
    ),
  },
  {
    accessorKey: 'address',
    header: 'Address',
    cell: ({ row }) => {
      const address = row.getValue('address') as string | null
      if (!address) return -
      
      return (
        
          {address}
        
      )
    },
  },
]
```

### Filters Component

**File:** `app/admin/usahawan/_components/Filters.tsx`
```typescript
'use client'

import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Search } from 'lucide-react'

interface FiltersProps {
  batches: string[]
  zones: string[]
  programs: string[]
  selectedBatch: string
  selectedZone: string
  selectedProgram: string
  searchQuery: string
  onBatchChange: (value: string) => void
  onZoneChange: (value: string) => void
  onProgramChange: (value: string) => void
  onSearchChange: (query: string) => void
}

export function Filters({
  batches,
  zones,
  programs,
  selectedBatch,
  selectedZone,
  selectedProgram,
  searchQuery,
  onBatchChange,
  onZoneChange,
  onProgramChange,
  onSearchChange,
}: FiltersProps) {
  return (
    
      {/* Search */}
      
        
        <Input
          placeholder="Search name, business, email..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10"
        />
      

      {/* Batch */}
      
        
          
        
        
          All Batches
          {batches.map(batch => (
            
              {batch}
            
          ))}
        
      

      {/* Zone */}
      
        
          
        
        
          All Zones
          {zones.map(zone => (
            
              {zone}
            
          ))}
        
      

      {/* Program */}
      
        
          
        
        
          All Programs
          {programs.map(program => (
            
              {program}
            
          ))}
        
      
    
  )
}
```

### Client Component

**File:** `app/admin/usahawan/_components/UsahawanClient.tsx`
```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { EntrepreneurDirectoryAdmin } from '@/types/entrepreneur'
import { DataTable } from '@/components/ui/data-table'
import { columns } from './columns'
import { Filters } from './Filters'
import { Button } from '@/components/ui/button'
import { Download } from 'lucide-react'
import { exportEntrepreneursToCSV } from '@/lib/utils/exportCSV'
import { EntrepreneurCard } from '@/components/entrepreneurs/EntrepreneurCard'

interface UsahawanClientProps {
  initialData: EntrepreneurDirectoryAdmin[]
  filterOptions: {
    batches: string[]
    zones: string[]
    programs: string[]
  }
  initialFilters: {
    batch: string
    zone: string
    program: string
    search: string
  }
}

export default function UsahawanClient({ 
  initialData, 
  filterOptions,
  initialFilters 
}: UsahawanClientProps) {
  const router = useRouter()
  const [filters, setFilters] = useState(initialFilters)
  const [searchQuery, setSearchQuery] = useState(initialFilters.search)

  const handleFilterChange = (key: string, value: string) => {
    const newFilters = { ...filters, [key]: value }
    setFilters(newFilters)
    
    const params = new URLSearchParams()
    Object.entries(newFilters).forEach(([k, v]) => {
      if (v && v !== 'all') params.set(k, v)
    })
    router.push(`/admin/usahawan?${params.toString()}`)
  }

  const handleSearch = (query: string) => {
    setSearchQuery(query)
    handleFilterChange('search', query)
  }

  const handleExport = () => {
    exportEntrepreneursToCSV(initialData, 'direktori_usahawan')
  }

  return (
    
      
        <Filters
          batches={filterOptions.batches}
          zones={filterOptions.zones}
          programs={filterOptions.programs}
          selectedBatch={filters.batch}
          selectedZone={filters.zone}
          selectedProgram={filters.program}
          searchQuery={searchQuery}
          onBatchChange={(v) => handleFilterChange('batch', v)}
          onZoneChange={(v) => handleFilterChange('zone', v)}
          onProgramChange={(v) => handleFilterChange('program', v)}
          onSearchChange={handleSearch}
        />
        
        
          
          Export CSV ({initialData.length})
        
      

      {/* Desktop */}
      
        
      

      {/* Mobile */}
      
        {initialData.length === 0 ? (
          
            No entrepreneurs found
          
        ) : (
          initialData.map(entrepreneur => (
            
          ))
        )}
      
    
  )
}
```

---

## Mentor View Implementation

### Query Function

Add to `lib/supabase/queries/entrepreneurs.ts`:
```typescript
import { MyEntrepreneur } from '@/types/entrepreneur'

export async function getMyEntrepreneursDirectory(mentorId: string) {
  const supabase = await createClient()
  
  const { data, error } = await supabase.rpc('get_my_entrepreneurs_directory', {
    p_mentor_id: mentorId,
  })
  
  if (error) throw error
  return data as MyEntrepreneur[]
}
```

### Server Page

**File:** `app/mentor/usahawan-saya/page.tsx`
```typescript
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getMyEntrepreneursDirectory } from '@/lib/supabase/queries/entrepreneurs'
import UsahawanSayaClient from './_components/UsahawanSayaClient'

export default async function MentorUsahawanPage() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  
  const { data: mentor, error: mentorError } = await supabase
    .from('mentors')
    .select('id')
    .eq('email', user.email)
    .single()
  
  if (mentorError || !mentor) {
    return (
      
        
          Not Registered
          
            You are not registered as a mentor.
          
        
      
    )
  }
  
  try {
    const entrepreneurs = await getMyEntrepreneursDirectory(mentor.id)
    
    return (
      
        
          Usahawan Saya
          
            Your assigned entrepreneurs ({entrepreneurs.length})
          
        
        
        
      
    )
  } catch (error) {
    console.error('Error:', error)
    return (
      
        
          Error
          
            {error instanceof Error ? error.message : 'Failed to load'}
          
        
      
    )
  }
}
```

### Mentor Columns

**File:** `app/mentor/usahawan-saya/_components/columns.tsx`
```typescript
'use client'

import { ColumnDef } from '@tanstack/react-table'
import { MyEntrepreneur } from '@/types/entrepreneur'
import { Badge } from '@/components/ui/badge'
import { ContactInfo } from '@/components/entrepreneurs/ContactInfo'

export const columns: ColumnDef[] = [
  {
    accessorKey: 'name',
    header: 'Name',
    cell: ({ row }) => (
      {row.getValue('name')}
    ),
  },
  {
    accessorKey: 'business_name',
    header: 'Business',
    cell: ({ row }) => (
      
        {row.getValue('business_name') || '-'}
      
    ),
  },
  {
    id: 'contact',
    header: 'Contact',
    cell: ({ row }) => (
      
    ),
  },
  {
    id: 'location',
    header: 'Location',
    cell: ({ row }) => (
      
        {row.original.state || 'N/A'}
        {row.original.zone && (
          
            {row.original.zone}
          
        )}
      
    ),
  },
  {
    accessorKey: 'program',
    header: 'Program',
    cell: ({ row }) => {
      const program = row.getValue('program') as string
      return (
        <Badge variant={program === 'Bangkit' ? 'default' : 'secondary'}>
          {program}
        
      )
    },
  },
  {
    accessorKey: 'address',
    header: 'Address',
    cell: ({ row }) => {
      const address = row.getValue('address') as string | null
      if (!address) return -
      
      return (
        
          {address}
        
      )
    },
  },
]
```

### Mentor Client

**File:** `app/mentor/usahawan-saya/_components/UsahawanSayaClient.tsx`
```typescript
'use client'

import { useState } from 'react'
import { MyEntrepreneur } from '@/types/entrepreneur'
import { DataTable } from '@/components/ui/data-table'
import { columns } from './columns'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Download, Search } from 'lucide-react'
import { exportEntrepreneursToCSV } from '@/lib/utils/exportCSV'
import { EntrepreneurCard } from '@/components/entrepreneurs/EntrepreneurCard'

interface UsahawanSayaClientProps {
  data: MyEntrepreneur[]
}

export default function UsahawanSayaClient({ data }: UsahawanSayaClientProps) {
  const [searchQuery, setSearchQuery] = useState('')

  const filteredData = data.filter(e => 
    e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    e.business_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    e.email.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleExport = () => {
    exportEntrepreneursToCSV(filteredData, 'usahawan_saya')
  }

  return (
    
      
        
          
          <Input
            placeholder="Search name, business..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        
        
        
          
          Export CSV ({filteredData.length})
        
      

      {/* Desktop */}
      
        
      

      {/* Mobile */}
      
        {filteredData.length === 0 ? (
          
            No entrepreneurs found
          
        ) : (
          filteredData.map(entrepreneur => (
            
          ))
        )}
      
    
  )
}
```

---

## Testing Checklist

### Database
- [ ] Run both SQL functions successfully
- [ ] Test admin function with filters
- [ ] Test mentor function with mentor ID
- [ ] Verify data returns correctly

### Admin View
- [ ] Page loads all entrepreneurs
- [ ] Batch filter works
- [ ] Zone filter works
- [ ] Program filter works
- [ ] Search works (name, business, email)
- [ ] CSV export downloads
- [ ] CSV opens in Excel with proper encoding
- [ ] Phone links work (tel:+60...)
- [ ] Email links work (mailto:)
- [ ] Mobile shows cards
- [ ] Desktop shows table
- [ ] No console errors

### Mentor View
- [ ] Page shows only assigned entrepreneurs
- [ ] Search works
- [ ] CSV export works
- [ ] Phone/email links work
- [ ] Mobile responsive
- [ ] Auth redirect works
- [ ] No console errors

### Security
- [ ] CSV sanitizes formula injection
- [ ] Phone normalization works
- [ ] No SQL injection possible
- [ ] Auth checks work

---

## Required Dependencies
```bash
# Install if not present
npm install @tanstack/react-table lucide-react date-fns

# Shadcn components
npx shadcn-ui@latest add table
npx shadcn-ui@latest add select
npx shadcn-ui@latest add input
npx shadcn-ui@latest add button
npx shadcn-ui@latest add badge
npx shadcn-ui@latest add skeleton
```

---

## Key Reminders

### ✅ Must Include
- TanStack Table for desktop
- Mobile card view
- Filters (Admin: Batch/Zone/Program)
- Search functionality
- CSV export with security
- Malaysian phone normalization
- Clickable contact links
- Error handling
- Loading states

### ❌ Must NOT Include
- Session counts
- Overdue badges
- Days since tracking
- Engagement status
- Statistics cards
- Google Maps links
- Pagination (use simple scrolling)

---

**END OF IMPLEMENTATION GUIDE**