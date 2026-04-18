"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { motion } from "framer-motion";
import { Check, X, HelpCircle, ArrowLeft, StopCircle, Star, Archive, Edit2 } from "lucide-react";
import { submitSessionAttempts } from "@/app/actions/session";
import { EditWordModal, getDifficultyFromRank } from "@/components/EditWordModal";
import {
  fetchUserWords,
  sortSoloPriority,
  assignTracks,
  type SessionWord,
} from "@/lib/sessionQueue";

function PracticeSession() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const packId = searchParams.get("pack_id");
  
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  const [queue, setQueue] = useState<SessionWord[]>([]);
  const [totalSessionSize, setTotalSessionSize] = useState(0);
  const [masteredCount, setMasteredCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  
  // Stats
  const [attempts, setAttempts] = useState<any[]>([]);
  const [isFinished, setIsFinished] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Card state
  const [flipped, setFlipped] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [currentInterestToggle, setCurrentInterestToggle] = useState<string>("none");
  const [editingWord, setEditingWord] = useState<any | null>(null);

  const handleInterest = async (e: React.MouseEvent, interaction: "fav" | "up" | "none" | "down" | "archive") => {
    e.stopPropagation();
    if (queue.length === 0 || !userId) return;
    
    setCurrentInterestToggle(interaction);
    const currentWord = queue[0];

    let updatePayload: any = {};
    if (interaction === "fav") updatePayload.is_fav = true;
    if (interaction === "archive") updatePayload.is_archived = true;

    if (Object.keys(updatePayload).length > 0) {
      await supabase.from("user_word_settings").update(updatePayload)
        .eq("user_id", userId).eq("word_id", currentWord.word_id);
    }
  };

  const fetchSessionData = useCallback(async () => {
    if (!userId) return;
    setIsLoading(true);

    const words = await fetchUserWords(userId, packId);

    // Sort order: interest desc → success asc → frequency asc.
    const ranked = sortSoloPriority(words);

    // Top 50, with adaptive rec/prod assignment.
    const sessionWords = assignTracks(ranked.slice(0, 50), "mixed");

    setQueue(sessionWords);
    setTotalSessionSize(sessionWords.length);
    setMasteredCount(0);
    setIsLoading(false);
  }, [userId, packId]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data, error }) => {
      if (error || !data.user) {
        router.replace("/login");
      } else {
        setUserId(data.user.id);
        setIsAuthChecking(false);
      }
    });
  }, [router]);

  useEffect(() => {
    if (userId) {
      fetchSessionData();
    }
  }, [userId, fetchSessionData]);

  // Timer
  useEffect(() => {
    if (isAuthChecking || isLoading || queue.length === 0 || isFinished) return;
    const interval = setInterval(() => {
      setElapsedSeconds(s => s + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [isAuthChecking, isLoading, queue.length, isFinished]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const handleAction = async (outcome: "know" | "meh" | "forgot") => {
    if (queue.length === 0) return;
    const currentWord = queue[0];
    
    // Log attempt
    setAttempts(prev => [...prev, {
      word_id: currentWord.word_id,
      mode: currentWord.track,
      outcome,
      interest_interaction: currentInterestToggle
    }]);

    setFlipped(false);
    setCurrentInterestToggle("none");
    
    if (outcome === "know") {
      // Remove from queue
      setTimeout(() => {
        setQueue(prev => prev.slice(1));
        setMasteredCount(c => c + 1);
        if (queue.length === 1) {
          handleEndSession(true); // Last item was popped
        }
      }, 150);
    } else {
      // Move to back
      setTimeout(() => {
        setQueue(prev => {
          const rest = prev.slice(1);
          return [...rest, currentWord];
        });
      }, 150);
    }
  };

  const handleEndSession = async (finishedNormally = false) => {
    setIsFinished(true);
    if (!finishedNormally) {
      // Manual end
    }
    
    if (attempts.length > 0 && userId) {
      setIsSaving(true);
      await submitSessionAttempts(userId, attempts);
      setIsSaving(false);
    }
  };

  if (isAuthChecking || isLoading) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </main>
    );
  }

  if (isFinished) {
    const accuracy = attempts.length > 0 
      ? Math.round((attempts.filter(a => a.outcome === 'know').length / attempts.length) * 100) 
      : 0;

    return (
      <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
        <div className="bg-white rounded-3xl shadow-sm border border-gray-200 p-12 text-center max-w-md w-full">
          <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <Check className="w-8 h-8" />
          </div>
          <h2 className="text-3xl font-extrabold text-gray-900 mb-2">Session Complete!</h2>
          <div className="space-y-3 mb-8 text-gray-600">
            <p><strong>Time Elapsed:</strong> {formatTime(elapsedSeconds)}</p>
            <p><strong>Total Cards Seen:</strong> {attempts.length}</p>
            <p><strong>Accuracy:</strong> {accuracy}%</p>
          </div>
          {isSaving ? (
            <div className="text-blue-500 font-medium mb-4 flex items-center justify-center gap-2">
               <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
               Saving Progress...
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <button
                onClick={() => {
                  setQueue([]);
                  setTotalSessionSize(0);
                  setMasteredCount(0);
                  setAttempts([]);
                  setIsFinished(false);
                  setElapsedSeconds(0);
                  fetchSessionData();
                }}
                className="w-full px-6 py-4 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 transition shadow"
              >
                Start New Session
              </button>
              <button
                onClick={() => router.push("/")}
                className="w-full px-6 py-4 bg-gray-900 text-white rounded-xl font-semibold hover:bg-gray-800 transition"
              >
                Return to Dashboard
              </button>
            </div>
          )}
        </div>
      </main>
    );
  }

  if (queue.length === 0 && totalSessionSize === 0) {
    return (
      <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">No words to practice!</h2>
        <p className="text-gray-500 mb-8">Add some vocabulary in the Vault first.</p>
        <button
          onClick={() => router.push("/vault")}
          className="px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold shadow hover:bg-blue-700 transition"
        >
          Go to Vault
        </button>
      </main>
    );
  }

  const currentWord = queue[0];
  const isRec = currentWord.track === "rec";
  const promptText = isRec ? currentWord.words_dim.greek_text : currentWord.words_dim.french_text;
  const translationText = isRec ? currentWord.words_dim.french_text : currentWord.words_dim.greek_text;

  const currentRank = currentWord.words_dim.frequency_rank > 0 ? currentWord.words_dim.frequency_rank : 99999;
  const difficulty = getDifficultyFromRank(currentRank);
  const difficultyColors = {
    easy: "bg-green-100 text-green-700",
    medium: "bg-yellow-100 text-yellow-700",
    hard: "bg-orange-100 text-orange-700",
    niche: "bg-red-100 text-red-700"
  };
  const diffColor = difficultyColors[difficulty as keyof typeof difficultyColors] || "bg-gray-100 text-gray-700";

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center p-6">
      <EditWordModal 
        isOpen={!!editingWord}
        onClose={() => setEditingWord(null)}
        word={editingWord}
        onSuccess={async () => {
          if (editingWord) {
            const { data } = await supabase.from('words_dim').select('*').eq('id', editingWord.id).single();
            if (data) {
              setQueue(prev => prev.map(item => 
                item.words_dim.id === data.id ? { ...item, words_dim: data } : item
              ));
            }
          }
          setEditingWord(null);
        }}
      />
      <div className="w-full max-w-2xl flex items-center justify-between mb-8 mt-4">
        <button
          onClick={() => router.push("/")}
          className="p-2 text-gray-400 hover:text-gray-700 bg-white border border-gray-200 rounded-full shadow-sm transition"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        
        {/* Stats Bar */}
        <div className="flex items-center gap-6 bg-white px-6 py-3 rounded-full border border-gray-200 shadow-sm font-semibold text-gray-700">
          <div className="flex items-center gap-2">
            <span className="text-gray-400">⏱</span>
            <span className="w-12 text-center font-mono">{formatTime(elapsedSeconds)}</span>
          </div>
          <div className="w-px h-4 bg-gray-300"></div>
          <div className="flex items-center gap-2">
            <span className="text-gray-400">📈</span>
            <span>{masteredCount} / {totalSessionSize}</span>
          </div>
        </div>
        
        <button
          onClick={() => handleEndSession(false)}
          className="flex items-center gap-1 p-2 px-3 text-red-500 hover:bg-red-50 rounded-full transition font-medium text-sm"
        >
          <StopCircle className="w-5 h-5" />
          End Session
        </button>
      </div>

      {/* Flashcard Area */}
      <div className="flex-1 w-full max-w-2xl flex flex-col items-center justify-center -mt-12">
        <div 
          className="w-full aspect-[4/3] perspective-1000 cursor-pointer"
          onClick={() => setFlipped(!flipped)}
        >
          <motion.div
            className="w-full h-full relative preserve-3d"
            animate={{ rotateY: flipped ? 180 : 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 20 }}
          >
            {/* Front */}
            <div className="absolute w-full h-full backface-hidden bg-white rounded-3xl shadow-lg border border-gray-100 flex flex-col items-center justify-center p-8 text-center">
              <div className="absolute top-6 left-6 flex flex-col items-start gap-2">
                <span className="text-xs font-bold uppercase tracking-widest text-gray-400 bg-gray-100 px-3 py-1 rounded-full">
                  Theme: {currentWord.words_dim.theme || 'None'}
                </span>
                <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${diffColor}`}>
                  {difficulty}
                </span>
              </div>
              <div className="absolute top-6 right-6 flex items-center gap-2">
                <span className={`text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full ${isRec ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'}`}>
                  {isRec ? 'Recognition' : 'Production'}
                </span>
                <button 
                  onClick={(e) => { e.stopPropagation(); setEditingWord(currentWord.words_dim); }}
                  className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors z-10"
                  title="Edit Word"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
              </div>
              
              <h2 className={`font-medium text-gray-900 mb-6 ${isRec ? 'text-5xl sm:text-6xl font-serif' : 'text-4xl sm:text-5xl'}`}>
                {promptText}
              </h2>
              
              <p className="text-gray-400 font-medium">
                {currentWord.words_dim.part_of_speech}
              </p>
              
              <div className="absolute bottom-6 text-gray-300 text-sm animate-pulse">
                Tap to flip
              </div>
            </div>

            {/* Back */}
            <div 
              className="absolute w-full h-full backface-hidden bg-gray-900 rounded-3xl shadow-xl flex flex-col items-center justify-center p-8 text-center"
              style={{ transform: "rotateY(180deg)" }}
            >
              <div className="absolute top-6 left-6 flex flex-col items-start gap-2">
                <span className="text-xs font-bold uppercase tracking-widest text-gray-400 bg-gray-800 px-3 py-1 rounded-full">
                  Theme: {currentWord.words_dim.theme || 'None'}
                </span>
                <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${diffColor}`}>
                  {difficulty}
                </span>
              </div>
              <div className="absolute top-6 right-6 flex items-center gap-2">
                <button 
                  onClick={(e) => { e.stopPropagation(); setEditingWord(currentWord.words_dim); }}
                  className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-full transition-colors z-10"
                  title="Edit Word"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 flex flex-col items-center justify-center w-full">
                <p className="text-gray-400 text-lg mb-4">
                  {promptText}
                </p>
                <h2 className={`font-medium text-white ${!isRec ? 'text-5xl sm:text-6xl font-serif' : 'text-4xl sm:text-5xl'}`}>
                  {translationText}
                </h2>
              </div>
              
              {/* Interest Buttons */}
              <div className="absolute bottom-8 w-full px-8 flex justify-between items-center gap-2">
                <button
                  onClick={(e) => handleInterest(e, "fav")}
                  className={`p-3 rounded-full transition-colors ${currentInterestToggle === "fav" ? "bg-yellow-500/20 text-yellow-400" : "bg-gray-800 text-gray-400 hover:text-yellow-400 hover:bg-gray-700"}`}
                  title="Favorite"
                >
                  <Star className="w-5 h-5" fill={currentInterestToggle === "fav" ? "currentColor" : "none"} />
                </button>
                <div className="flex gap-2">
                  <button
                    onClick={(e) => handleInterest(e, "down")}
                    className={`px-4 py-2 rounded-full text-sm font-bold transition-colors ${currentInterestToggle === "down" ? "bg-red-500/20 text-red-400" : "bg-gray-800 text-gray-400 hover:bg-gray-700"}`}
                  >
                    Low
                  </button>
                  <button
                    onClick={(e) => handleInterest(e, "none")}
                    className={`px-4 py-2 rounded-full text-sm font-bold transition-colors ${currentInterestToggle === "none" ? "bg-gray-600 text-white" : "bg-gray-800 text-gray-400 hover:bg-gray-700"}`}
                  >
                    Std
                  </button>
                  <button
                    onClick={(e) => handleInterest(e, "up")}
                    className={`px-4 py-2 rounded-full text-sm font-bold transition-colors ${currentInterestToggle === "up" ? "bg-green-500/20 text-green-400" : "bg-gray-800 text-gray-400 hover:bg-gray-700"}`}
                  >
                    Boost
                  </button>
                </div>
                <button
                  onClick={(e) => handleInterest(e, "archive")}
                  className={`p-3 rounded-full transition-colors ${currentInterestToggle === "archive" ? "bg-red-500/20 text-red-500" : "bg-gray-800 text-gray-400 hover:text-red-500 hover:bg-gray-700"}`}
                  title="Archive"
                >
                  <Archive className="w-5 h-5" />
                </button>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Action Buttons */}
        <div className={`mt-12 flex items-center justify-center gap-4 transition-all duration-300 ${flipped ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}>
          <button
            onClick={(e) => { e.stopPropagation(); handleAction("forgot"); }}
            className="flex flex-col items-center justify-center w-24 h-24 rounded-full bg-red-100 text-red-600 hover:bg-red-200 transition shadow-sm"
          >
            <X className="w-8 h-8 mb-1" />
            <span className="text-xs font-bold uppercase tracking-wider">Forgot</span>
          </button>
          
          <button
            onClick={(e) => { e.stopPropagation(); handleAction("meh"); }}
            className="flex flex-col items-center justify-center w-24 h-24 rounded-full bg-yellow-100 text-yellow-600 hover:bg-yellow-200 transition shadow-sm"
          >
            <HelpCircle className="w-8 h-8 mb-1" />
            <span className="text-xs font-bold uppercase tracking-wider">Unsure</span>
          </button>
          
          <button
            onClick={(e) => { e.stopPropagation(); handleAction("know"); }}
            className="flex flex-col items-center justify-center w-24 h-24 rounded-full bg-green-100 text-green-600 hover:bg-green-200 transition shadow-sm"
          >
            <Check className="w-8 h-8 mb-1" />
            <span className="text-xs font-bold uppercase tracking-wider">Knew It</span>
          </button>
        </div>
      </div>
    </main>
  );
}

export default function PracticePage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </main>
    }>
      <PracticeSession />
    </Suspense>
  );
}
