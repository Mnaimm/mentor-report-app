import React from 'react'
import { getEntrepreneursDirectory } from '@/lib/supabase/queries/entrepreneurs'
import { createClient } from '@/lib/supabase/server'
import EntrepreneursClient from './_components/EntrepreneursClient'

export const dynamic = 'force-dynamic'

export const metadata = {
    title: 'Direktori Usahawan - iTEKAD Mentor Portal',
}

export default async function Page({
    searchParams,
}: {
    searchParams: { [key: string]: string | string[] | undefined }
}) {
    const batch = typeof searchParams.batch === 'string' ? searchParams.batch : 'all'
    const zone = typeof searchParams.zone === 'string' ? searchParams.zone : 'all'
    const program = typeof searchParams.program === 'string' ? searchParams.program : 'all'
    const search = typeof searchParams.search === 'string' ? searchParams.search : ''

    // Fetch unique batches and zones for filters
    const supabase = await createClient()

    try {
        // Fetch data - use single call with reasonable limit
        const data = await getEntrepreneursDirectory({
            batch,
            zone,
            program,
            search,
            limit: 500, // Reasonable limit to avoid timeouts
        })

        // Extract unique values from the fetched data
        // Note: This only shows batches/zones present in the current result set
        const uniqueBatches = Array.from(new Set(data?.map(e => e.batch).filter(Boolean) as string[])).sort()
        const uniqueZones = Array.from(new Set(data?.map(e => e.zone).filter(Boolean) as string[])).sort()

        return (
            <EntrepreneursClient
                initialData={data || []}
                batches={uniqueBatches}
                zones={uniqueZones}
            />
        )
    } catch (error) {
        console.error('❌ Error fetching entrepreneurs:', error)
        return (
            <EntrepreneursClient
                initialData={[]}
                batches={[]}
                zones={[]}
            />
        )
    }
}
