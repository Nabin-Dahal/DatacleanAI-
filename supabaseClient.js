import { createClient } from '@supabase/supabase-js';

// Use the EXPO_PUBLIC_ prefix so Expo can read them
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;




export const supabase = createClient(supabaseUrl, supabaseAnonKey);