// lib/featureFlags.js
// Env-driven feature flags. All flags default to false when unset.
// NEXT_PUBLIC_* values are inlined at build time — a redeploy is needed to toggle them.

export const MIA_UI_ENABLED  = process.env.NEXT_PUBLIC_MIA_ENABLED === 'true';
export const MIA_API_ENABLED = process.env.MIA_ENABLED === 'true';
