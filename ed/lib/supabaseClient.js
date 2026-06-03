import { createClient } from "@supabase/supabase-js";

const sanitize = (value = "") => value.trim().replace(/^['"]|['"]$/g, "");

const supabaseUrl = sanitize(process.env.NEXT_PUBLIC_SUPABASE_URL);
const supabaseAnonKey = sanitize(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
let cachedClient = null;

const isValidUrl = (value) => {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
};

export const getSupabase = () => {
  if (cachedClient) return cachedClient;
  if (typeof window === "undefined") return null;
  if (!isValidUrl(supabaseUrl) || !supabaseAnonKey) return null;
  cachedClient = createClient(supabaseUrl, supabaseAnonKey);
  return cachedClient;
};
