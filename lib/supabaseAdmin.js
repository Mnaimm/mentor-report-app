// lib/supabaseAdmin.js
// SERVER-SIDE ONLY — Do not import this file in client-side code
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL environment variable');
}

if (!supabaseServiceKey) {
  console.error('❌ Missing SUPABASE_SERVICE_ROLE_KEY environment variable');
}

// Create admin client with service role key (bypasses RLS)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  db: {
    schema: 'public',
  },
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
  global: {
    fetch: (...args) => {
      return fetch(args[0], {
        ...args[1],
        // Increase timeout to 30 seconds to handle slow connections
        signal: AbortSignal.timeout(30000)
      });
    }
  }
});

export default supabaseAdmin;
