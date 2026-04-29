"use client";

import { useState, useEffect } from "react";
import { Plus } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { AddWordModal } from "@/components/AddWordModal";

export function FloatingAddButton() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setIsLoggedIn(!!data.user);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(!!session?.user);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (!isLoggedIn) return null;

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        title="Add word"
        className="fixed top-4 left-4 z-50 w-10 h-10 flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg transition-transform hover:scale-105 active:scale-95"
      >
        <Plus className="w-5 h-5" />
      </button>
      <AddWordModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}
