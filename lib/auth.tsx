"use client";

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Profile, Team } from "@/lib/types";

type AuthShape = {
  loading: boolean;
  userId: string | null;
  profile: Profile | null;
  team: Team | null;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthShape | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [team, setTeam] = useState<Team | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setUserId(null);
      setProfile(null);
      setTeam(null);
      setLoading(false);
      return;
    }
    setUserId(user.id);

    const { data: profileRow } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();
    setProfile(profileRow as Profile | null);

    if (profileRow?.team_id) {
      const { data: teamRow } = await supabase
        .from("teams")
        .select("*")
        .eq("id", profileRow.team_id)
        .maybeSingle();
      setTeam(teamRow as Team | null);
    } else {
      setTeam(null);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => load());
    return () => subscription.unsubscribe();
  }, [load, supabase]);

  async function signOut() {
    await supabase.auth.signOut();
    setUserId(null);
    setProfile(null);
    setTeam(null);
  }

  return (
    <AuthContext.Provider value={{ loading, userId, profile, team, refresh: load, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
