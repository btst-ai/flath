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

    async function evaluate(uid: string | null) {
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

    async function check() {
      const { data: authData } = await supabase.auth.getUser();
      await evaluate(authData.user?.id ?? null);
    }

    check();

    // Keep admin status in sync when the user signs out or switches accounts
    // in the same tab. The module cache is uid-keyed, so an already-mounted
    // component would otherwise show the previous user's status until remount.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const uid = session?.user?.id ?? null;
      if (uid !== cachedUserId) {
        // Invalidate so evaluate() refetches rather than returning a stale value.
        cachedUserId = null;
        cachedIsAdmin = null;
        if (!cancelled) setLoading(true);
        evaluate(uid);
      }
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { isAdmin, loading };
}
