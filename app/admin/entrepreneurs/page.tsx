import React from 'react'
import { getEntrepreneursAdmin } from '@/lib/supabase/queries/entrepreneurs'
import { createClient } from '@/lib/supabase/server'
import EntrepreneursClient from './_components/EntrepreneursClient'

export const dynamic = 'force-dynamic'

export default async function Page({
    searchParams,
}: {
    searchParams: { [key: string]: string | string[] | undefined }
}) {
    const batch = typeof searchParams.batch === 'string' ? searchParams.batch : 'all'
    const zone = typeof searchParams.zone === 'string' ? searchParams.zone : 'all'
    const program = typeof searchParams.program === 'string' ? searchParams.program : 'all'
    const search = typeof searchParams.search === 'string' ? searchParams.search : ''
    const sort = typeof searchParams.sort === 'string' ? searchParams.sort : 'name_asc'

    // Fetch unique batches and zones for filters
    const supabase = await createClient()

    // Parallel fetching
    const [data, batchRes, zoneRes] = await Promise.all([
        getEntrepreneursAdmin({
            batch,
            zone,
            program,
            search,
            sort,
            limit: 100, // Reasonable limit for admin view
        }),
        supabase.from('entrepreneurs').select('batch').not('batch', 'is', null),
        supabase.from('entrepreneurs').select('zone').not('zone', 'is', null)
    ])

    // Extract unique values
    const uniqueBatches = Array.from(new Set(batchRes.data?.map(b => b.batch).filter(Boolean) as string[])).sort()
    const uniqueZones = Array.from(new Set(zoneRes.data?.map(z => z.zone).filter(Boolean) as string[])).sort()

    return (
        <EntrepreneursClient
            initialData={data}
            batches={uniqueBatches}
            zones={uniqueZones}
        />
    )
}
