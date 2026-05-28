"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

// Module-level cache — avoids refetching across component mounts in the same session.
let cachedIsAdmin: boolean | null = null;
let cachedUserId: string | null = null;

export function useIsAdmin(): { isAdmin: boolean; loading: boolean } {
  const [isAdmin, setIsAdmin] = useState<boolean>(cachedIsAdmin ?? false);
  const [loading, setLoading] = useState<boolean>(cachedIsAdmin === null);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      const { data: authData } = await supabase.auth.getUser();
      const uid = authData.user?.id ?? null;

      // Return cached result if same user
      if (uid === cachedUserId && cachedIsAdmin !== null) {
        if (!cancelled) {
          setIsAdmin(cachedIsAdmin);
          setLoading(false);
        }
        return;
      }

      if (!uid) {
        cachedUserId = null;
        cachedIsAdmin = false;
        if (!cancelled) { setIsAdmin(false); setLoading(false); }
        return;
      }

      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", uid)
        .maybeSingle();

      const result = data?.role === "admin";
      cachedUserId = uid;
      cachedIsAdmin = result;

      if (!cancelled) {
        setIsAdmin(result);
        setLoading(false);
      }
    }

    check();
    return () => { cancelled = true; };
  }, []);

  return { isAdmin, loading };
}
