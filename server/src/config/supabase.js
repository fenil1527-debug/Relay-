import { createClient } from '@supabase/supabase-js';
import config from './index.js';

let supabaseClient = null;

export function getSupabase() {
  if (!supabaseClient) {
    if (!config.supabaseUrl || !config.supabaseKey) {
      throw new Error(
        'Supabase configuration missing. Please set SUPABASE_URL and SUPABASE_KEY (or SUPABASE_SERVICE_ROLE_KEY) in your .env file.'
      );
    }

    supabaseClient = createClient(config.supabaseUrl, config.supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }
  return supabaseClient;
}

export default getSupabase;
