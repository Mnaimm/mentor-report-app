// lib/supabaseClient.js
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Missing Supabase environment variables');
}

// Create client with increased timeout for slow connections
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  db: {
    schema: 'public',
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

export default supabase;
