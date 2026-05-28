import { useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { getWordFrequency } from "@/app/actions/getFrequency";

export interface WordInput {
  greek_text: string;
  french_text: string;
  part_of_speech: string;
  theme: string;
  frequency_rank?: number;
}

export function useAddWord() {
  const [isAdding, setIsAdding] = useState(false);
  
  // State for the modal
  const [conflictQueue, setConflictQueue] = useState<{
    resolve: (decision: "keep" | "overwrite") => void;
    reject: () => void;
    existingWord: WordInput;
    newWord: WordInput;
  }[]>([]);

  const currentConflict = conflictQueue[0] || null;

  const resolveConflict = (decision: "keep" | "overwrite") => {
    if (currentConflict) {
      currentConflict.resolve(decision);
      setConflictQueue((prev) => prev.slice(1));
    }
  };

  const closeConflict = () => {
    if (currentConflict) {
      currentConflict.reject();
      setConflictQueue((prev) => prev.slice(1));
    }
  };

  const addWords = useCallback(async (words: WordInput[]) => {
    setIsAdding(true);
    let successCount = 0;
    const addedWordsStats: { id: string; greek_text: string; french_text: string; theme: string; part_of_speech: string; frequency_rank: number }[] = [];
    
    try {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData.user?.id;

      if (!userId) {
        toast.error("You must be signed in.");
        return { stats: [] };
      }

      for (const word of words) {
        // 1. Check if word exists in words_dim
        const { data: existingData, error: searchError } = await supabase
          .from("words_dim")
          .select("*")
          .eq("greek_text", word.greek_text)
          .maybeSingle();

        if (searchError) {
          console.error("Search error:", searchError);
          continue;
        }

        let finalWordId = existingData?.id;
        let finalWordData: any = existingData;

        if (existingData) {
          // Conflict handling
          const isIdentical =
            existingData.french_text === word.french_text &&
            existingData.theme === word.theme &&
            existingData.part_of_speech === word.part_of_speech;

          if (!isIdentical) {
            // Prompt user
            try {
              const decision = await new Promise<"keep" | "overwrite">((resolve, reject) => {
                setConflictQueue((prev) => [
                  ...prev,
                  {
                    resolve,
                    reject,
                    existingWord: existingData,
                    newWord: word,
                  },
                ]);
              });

              if (decision === "overwrite") {
                const { error: updateError } = await supabase
                  .from("words_dim")
                  .update({
                    french_text: word.french_text,
                    theme: word.theme,
                    part_of_speech: word.part_of_speech,
                  })
                  .eq("id", finalWordId);

                if (updateError) {
                  toast.error(`Failed to update ${word.greek_text}`);
                  continue;
                }
                
                finalWordData = { ...existingData, french_text: word.french_text, theme: word.theme, part_of_speech: word.part_of_speech };
              }
            } catch (e) {
              // User closed modal
              continue;
            }
          }
        } else {
          // 2. Word doesn't exist, get frequency (use provided rank if available) and insert
          const frequency = word.frequency_rank ?? await getWordFrequency(word.greek_text);

          const { data: newWordData, error: insertError } = await supabase
            .from("words_dim")
            .insert({
              greek_text: word.greek_text,
              french_text: word.french_text,
              part_of_speech: word.part_of_speech,
              theme: word.theme,
              frequency_rank: frequency,
              created_by_user_id: userId,
            })
            .select()
            .single();

          if (insertError) {
            toast.error(`Failed to add ${word.greek_text}: ${insertError.message}`);
            continue;
          }
          
          finalWordId = newWordData.id;
          finalWordData = newWordData;
        }

        // 3. Upsert into user_word_settings
        const { error: settingsError } = await supabase
          .from("user_word_settings")
          .upsert({
            user_id: userId,
            word_id: finalWordId,
            avg_success_rate_prod: 50,
            avg_success_rate_rec: 50,
          }, { onConflict: 'user_id, word_id', ignoreDuplicates: true });

        if (settingsError) {
          console.error("Settings error:", settingsError);
        } else {
          successCount++;
          addedWordsStats.push({
            id: finalWordData.id,
            greek_text: finalWordData.greek_text || "",
            french_text: finalWordData.french_text || "",
            theme: finalWordData.theme || "General",
            part_of_speech: finalWordData.part_of_speech || "Autre",
            frequency_rank: finalWordData.frequency_rank || 99999,
          });
        }
      }
      
      if (successCount > 0 && words.length === 1) {
        toast.success(`Successfully added ${successCount} word(s) to your library.`);
      }

      return { stats: addedWordsStats };
    } finally {
      setIsAdding(false);
    }
  }, []);

  return {
    addWords,
    isAdding,
    conflictState: {
      isOpen: currentConflict !== null,
      existingWord: currentConflict?.existingWord || null,
      newWord: currentConflict?.newWord || null,
      onResolve: resolveConflict,
      onClose: closeConflict,
    }
  };
}
