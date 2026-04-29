"use client";

import { useState, useEffect } from "react";
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
        className="fixed left-4 z-50 w-12 h-12 flex items-center justify-center text-white rounded-full shadow-lg transition-transform hover:scale-105 active:scale-95 overflow-hidden"
        style={{
          bottom: "calc(1rem + env(safe-area-inset-bottom))",
          backgroundColor: "#003DA5",
          boxShadow: "0 0 0 4.5px white, 0 0 0 9px #003DA5, 0 4px 12px rgba(0,0,0,0.3)",
        }}
      >
        <span style={{ fontSize: "4.8rem", lineHeight: 1, fontWeight: 200, display: "block", textAlign: "center" }}>+</span>
      </button>
      <AddWordModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}
