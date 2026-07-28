import { useCallback, useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { checkIsAdmin } from "../lib/adminApi";
import { getSupabase, isSupabaseConfigured } from "../lib/supabase";

export interface AdminAuthState {
  loading: boolean;
  session: Session | null;
  user: User | null;
  isAdmin: boolean;
  configured: boolean;
}

export function useAdminAuth() {
  const [state, setState] = useState<AdminAuthState>({
    loading: true,
    session: null,
    user: null,
    isAdmin: false,
    configured: isSupabaseConfigured(),
  });

  const refreshAdmin = useCallback(async (session: Session | null) => {
    if (!session) {
      setState((prev) => ({
        ...prev,
        loading: false,
        session: null,
        user: null,
        isAdmin: false,
      }));
      return;
    }

    const isAdmin = await checkIsAdmin();
    setState((prev) => ({
      ...prev,
      loading: false,
      session,
      user: session.user,
      isAdmin,
    }));
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setState((prev) => ({ ...prev, loading: false, configured: false }));
      return;
    }

    const supabase = getSupabase();

    supabase.auth.getSession().then(({ data: { session } }) => {
      void refreshAdmin(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setState((prev) => ({ ...prev, loading: true }));
      void refreshAdmin(session);
    });

    return () => subscription.unsubscribe();
  }, [refreshAdmin]);

  const signIn = useCallback(async (email: string, password: string) => {
    const supabase = getSupabase();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    const supabase = getSupabase();
    await supabase.auth.signOut();
  }, []);

  return { ...state, signIn, signOut };
}
