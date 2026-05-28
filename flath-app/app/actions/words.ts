"use server";

import { createClient } from "@supabase/supabase-js";

function getServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(supabaseUrl, supabaseServiceKey);
}

export async function editWord(wordId: string, updates: { french_text: string; theme: string; part_of_speech: string; frequency_rank?: number }) {
  const supabase = getServiceClient();

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

export async function batchEditWords(wordIds: string[], updates: { theme?: string; frequency_rank?: number; part_of_speech?: string }) {
  const supabase = getServiceClient();

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

export async function renameOrMergeTheme(wordIds: string[], fromTheme: string, toTheme: string) {
  const supabase = getServiceClient();

  const { data, error } = await supabase
    .from("words_dim")
    .update({ theme: toTheme.trim() })
    .in("id", wordIds)
    .eq("theme", fromTheme)
    .select("id");

  if (error) {
    console.error("Failed to rename/merge theme", error);
    return { error: error.message };
  }
  return { success: true, updated: data?.length ?? 0 };
}

export async function batchArchiveWords(userId: string, wordIds: string[]) {
  const supabase = getServiceClient();

  // Upsert so words without a settings row get one with is_archived = true.
  const rows = wordIds.map(wid => ({
    user_id: userId,
    word_id: wid,
    is_archived: true,
    avg_success_rate_prod: 50,
    avg_success_rate_rec: 50,
  }));

  const { error } = await supabase
    .from("user_word_settings")
    .upsert(rows, { onConflict: "user_id, word_id" });

  if (error) {
    console.error("Failed to batch archive words", error);
    return { error: error.message };
  }
  return { success: true };
}

export async function batchDeleteWords(userId: string, wordIds: string[]) {
  const supabase = getServiceClient();

  // Check which words are owned by this user
  const { data: ownedWords } = await supabase
    .from("words_dim")
    .select("id")
    .in("id", wordIds)
    .eq("created_by_user_id", userId);

  const ownedIds = new Set((ownedWords ?? []).map((w: any) => w.id));
  const notOwnedIds = wordIds.filter(id => !ownedIds.has(id));

  const errors: string[] = [];

  // Delete words_dim rows for owned words (cascades to user_word_settings)
  if (ownedIds.size > 0) {
    const { error } = await supabase
      .from("words_dim")
      .delete()
      .in("id", Array.from(ownedIds));
    if (error) errors.push(`words_dim delete: ${error.message}`);
  }

  // For non-owned words: just remove user's settings row
  if (notOwnedIds.length > 0) {
    const { error } = await supabase
      .from("user_word_settings")
      .delete()
      .in("word_id", notOwnedIds)
      .eq("user_id", userId);
    if (error) errors.push(`settings delete: ${error.message}`);
  }

  if (errors.length > 0) {
    return { error: errors.join("; "), ownedDeleted: ownedIds.size, removedFromLibrary: notOwnedIds.length };
  }
  return { success: true, ownedDeleted: ownedIds.size, removedFromLibrary: notOwnedIds.length };
}
