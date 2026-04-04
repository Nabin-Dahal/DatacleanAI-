import { createClient } from '@supabase/supabase-js';

// Use the EXPO_PUBLIC_ prefix so Expo can read them
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;


//const supabaseUrl = "https://ghkkqocuislmcrnkijem.supabase.co";
//const supabaseAnonKey = "sb_publishable_rzBOlov0JksGq9rNvtmSbw_gLFOVmuo"


export const supabase = createClient(supabaseUrl, supabaseAnonKey);