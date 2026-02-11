import { createClient } from '@/lib/supabase/server'
import { EntrepreneurDirectoryAdmin, MyEntrepreneur } from '@/types/entrepreneur'

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

    const { data, error } = await supabase.rpc('get_entrepreneurs_directory_simple', {
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

export async function getMyEntrepreneursDirectory(mentorId: string) {
    const supabase = await createClient()

    const { data, error } = await supabase.rpc('get_my_entrepreneurs_simple', {
        p_mentor_id: mentorId,
    })

    if (error) throw error
    return data as MyEntrepreneur[]
}
