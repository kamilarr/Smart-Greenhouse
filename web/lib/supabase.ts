import { createClient } from "@supabase/supabase-js";

// Dipakai HANYA di server (API routes). Secret key tidak boleh sampai ke browser.
export const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
  { auth: { persistSession: false } }
);

// Node dianggap online jika mengirim data dalam 30 detik terakhir
export const ONLINE_WINDOW_MS = 30_000;