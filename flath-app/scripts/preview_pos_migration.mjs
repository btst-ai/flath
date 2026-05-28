#!/usr/bin/env node
// Preview which words_dim rows would be affected by the PoS migration.
// Read-only — nothing is mutated.
// Usage: cd flath-app && node scripts/preview_pos_migration.mjs

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, "../.env.local");

const env = Object.fromEntries(
  readFileSync(envPath, "utf8")
    .split("\n")
    .filter(line => line.includes("=") && !line.startsWith("#"))
    .map(line => {
      const idx = line.indexOf("=");
      return [line.slice(0, idx).trim(), line.slice(idx + 1).trim()];
    })
);

const SUPABASE_URL = env["NEXT_PUBLIC_SUPABASE_URL"];
const SUPABASE_KEY = env["SUPABASE_SERVICE_ROLE_KEY"];

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const ALLOWED = ["Adjectif","Adverbe","Conjonction","Interjection","Nom","Phrase","Preposition","Verbe","Pronom","Autre"];

const { data: allRows, error } = await supabase
  .from("words_dim")
  .select("id, greek_text, french_text, part_of_speech");

if (error) {
  console.error("Query failed:", error.message);
  process.exit(1);
}

// 1. Distribution of current values
const counts = {};
for (const row of allRows) {
  const val = row.part_of_speech ?? "(null)";
  counts[val] = (counts[val] || 0) + 1;
}

console.log("\n=== Current Part of Speech distribution ===");
const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
const maxLen = Math.max(...sorted.map(([k]) => k.length));
for (const [val, count] of sorted) {
  const inAllowed = ALLOWED.includes(val) ? "  OK" : "  -> would become 'Autre'";
  console.log(`  ${val.padEnd(maxLen)}  ${String(count).padStart(5)}${inAllowed}`);
}

// 2. Rows that would be rewritten
const toRewrite = allRows.filter(r => !ALLOWED.includes(r.part_of_speech ?? ""));
console.log(`\n=== Rows that would be rewritten to 'Autre': ${toRewrite.length} ===`);
if (toRewrite.length > 0) {
  const sample = toRewrite.slice(0, 200);
  for (const r of sample) {
    console.log(`  id=${r.id}  greek=${r.greek_text}  pos=${JSON.stringify(r.part_of_speech)}`);
  }
  if (toRewrite.length > 200) {
    console.log(`  ... and ${toRewrite.length - 200} more`);
  }
}

console.log("\nDone. Nothing was modified.\n");
