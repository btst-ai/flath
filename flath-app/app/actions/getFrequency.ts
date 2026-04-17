"use server";
import { getFrequencyRank } from "@/lib/words";

export async function getWordFrequency(greekText: string) {
    return getFrequencyRank(greekText);
}
