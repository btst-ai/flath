"use server";

import { createClient } from "@supabase/supabase-js";

export async function editWord(wordId: string, updates: { french_text: string; theme: string; part_of_speech: string; frequency_rank?: number }) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  // Use service key to bypass RLS since the user might be editing words added by others (or just use standard user access if you have proper RLS)
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const { error } = await supabase
    .from("words_dim")
    .update(updates)
    .eq("id", wordId);

  if (error) {
    console.error("Failed to edit word", error);
    return { error: error.message };
  }
  return { success: true };
}

export async function batchEditWords(wordIds: string[], updates: { theme?: string; frequency_rank?: number }) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const { error } = await supabase
    .from("words_dim")
    .update(updates)
    .in("id", wordIds);

  if (error) {
    console.error("Failed to batch edit words", error);
    return { error: error.message };
  }
  return { success: true };
}
