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
        className="fixed left-4 z-50 w-12 h-12 flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg transition-transform hover:scale-105 active:scale-95"
        style={{ bottom: "calc(1rem + env(safe-area-inset-bottom))" }}
      >
        <Plus className="w-6 h-6" />
      </button>
      <AddWordModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}
