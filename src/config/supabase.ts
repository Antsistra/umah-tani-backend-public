// src/config/supabase.ts
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;


export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
export const supabaseClient = createClient(supabaseUrl, process.env.SUPABASE_ANON_KEY!);