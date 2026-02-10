export function normalizePhoneMY(phone?: string | null): string | null {
    if (!phone) return null
    let p = phone.replace(/[\s\-()]/g, '')
    if (p.startsWith('0')) p = '+60' + p.slice(1)
    if (!p.startsWith('+')) p = '+60' + p
    return p
}
