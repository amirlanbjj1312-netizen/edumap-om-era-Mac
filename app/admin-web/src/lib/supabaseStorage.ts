import { supabase } from '@/lib/supabaseClient';

export const supabaseStorage = {
  storage: supabase.storage,
};
