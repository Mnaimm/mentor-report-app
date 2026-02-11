import React from 'react'
import { getMyEntrepreneursDirectory } from '@/lib/supabase/queries/entrepreneurs'
import { createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import MyEntrepreneursClient from './_components/MyEntrepreneursClient'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/pages/api/auth/[...nextauth]'

export const dynamic = 'force-dynamic'

export default async function Page() {
    // 1. Get Logged In User via NextAuth (Server Side)
    const session = await getServerSession(authOptions)

    if (!session || !session.user?.email) {
        redirect('/login?callbackUrl=/mentor/usahawan-saya')
    }

    // 2. Get Mentor ID using the admin client (service role) to bypass RLS.
    //    Email is trusted — it comes from the NextAuth session.
    //    The anon-key client has no auth context here (project uses NextAuth,
    //    not Supabase Auth), so RLS blocks the query without the service role.
    const supabase = createAdminClient()

    const { data: mentor, error: mentorError } = await supabase
        .from('mentors')
        .select('id')
        .eq('email', session.user.email)
        .single()

    if (mentorError || !mentor) {
        return (
            <div className="p-8 text-center">
                <h1 className="text-xl font-bold text-red-600">Access Denied</h1>
                <p>Your account ({session.user.email}) is not registered as a mentor.</p>
                <p className="text-sm text-slate-500 mt-2">Please contact the administrator if you believe this is an error.</p>
            </div>
        )
    }

    // 3. Get Entrepreneurs
    const data = await getMyEntrepreneursDirectory(mentor.id)

    return (
        <MyEntrepreneursClient
            data={data}
            mentorId={mentor.id}
        />
    )
}
