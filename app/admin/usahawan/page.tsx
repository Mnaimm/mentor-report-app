import React from 'react'
import { redirect } from 'next/navigation'
import { unstable_getServerSession } from 'next-auth/next'
import { authOptions } from '@/pages/api/auth/[...nextauth]'
import { canAccessAdmin } from '@/lib/auth'
import supabaseAdmin from '@/lib/supabaseAdmin'
import { getEntrepreneursDirectory } from '@/lib/supabase/queries/entrepreneurs'
import EntrepreneursClient from './_components/EntrepreneursClient'

export const dynamic = 'force-dynamic'

export const metadata = {
    title: 'Direktori Usahawan - iTEKAD Mentor Portal',
}

// getUserRoles (lib/auth.js) auto-inserts a 'mentor' row for emails with no
// user_roles row. Such users can never pass canAccessAdmin, so deny them here
// before calling it to avoid that write.
async function hasAnyUserRole(email: string): Promise<boolean> {
    const { count, error } = await supabaseAdmin
        .from('user_roles')
        .select('id', { count: 'exact', head: true })
        .eq('email', email.toLowerCase().trim())
    if (error) {
        console.error('❌ Error checking user_roles:', error)
        return false
    }
    return (count ?? 0) > 0
}

function AccessDeniedBM({ userEmail }: { userEmail: string }) {
    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
            <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
                <h1 className="text-2xl font-bold text-gray-900 mb-2">Anda tidak dibenarkan</h1>
                <p className="text-gray-600 mb-6">
                    Anda tidak mempunyai kebenaran untuk melihat halaman ini. Sila hubungi pentadbir jika anda rasa ini satu kesilapan.
                </p>
                <div className="mb-6 p-3 bg-gray-100 rounded-lg">
                    <p className="text-sm text-gray-600">Log masuk sebagai:</p>
                    <p className="text-sm font-medium text-gray-900">{userEmail}</p>
                </div>
                <a href="/" className="inline-block bg-gray-600 hover:bg-gray-700 text-white font-medium py-2 px-4 rounded-lg">
                    Kembali ke Laman Utama
                </a>
            </div>
        </div>
    )
}

export default async function Page({
    searchParams,
}: {
    searchParams: { [key: string]: string | string[] | undefined }
}) {
    const session = await unstable_getServerSession(authOptions)
    const userEmail = session?.user?.email
    if (!userEmail) {
        redirect('/api/auth/signin?callbackUrl=/admin/usahawan')
    }

    const hasAccess = (await hasAnyUserRole(userEmail)) && (await canAccessAdmin(userEmail))
    if (!hasAccess) {
        return <AccessDeniedBM userEmail={userEmail} />
    }

    const batch = typeof searchParams.batch === 'string' ? searchParams.batch : 'all'
    const zone = typeof searchParams.zone === 'string' ? searchParams.zone : 'all'
    const program = typeof searchParams.program === 'string' ? searchParams.program : 'all'
    const search = typeof searchParams.search === 'string' ? searchParams.search : ''

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
