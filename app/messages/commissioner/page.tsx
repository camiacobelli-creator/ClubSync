"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/client";
import { Profile } from "@/lib/types";
import CommissionerMessageThread from "@/components/CommissionerMessageThread";

export default function TeamCommissionerMessagePage() {
  const supabase = createClient();
  const { team, profile } = useAuth();
  const [commissioners, setCommissioners] = useState<Profile[]>([]);
  const [selected, setSelected] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!team) return;
    supabase
      .from("profiles")
      .select("*")
      .eq("is_commissioner", true)
      .eq("commissioner_league", team.conference)
      .eq("commissioner_sport", team.sport)
      .then(({ data }) => {
        const list = (data as Profile[]) ?? [];
        setCommissioners(list);
        setSelected(list[0] ?? null);
        setLoading(false);
      });
  }, [team, supabase]);

  if (!team || loading) {
    return (
      <div className="h-full flex items-center justify-center border border-line-white rounded-lg bg-rink-2/20">
        <p className="text-sm text-ice-dim">Loading...</p>
      </div>
    );
  }

  if (commissioners.length === 0 || !selected || !profile) {
    return (
      <div className="h-full flex items-center justify-center border border-line-white rounded-lg bg-rink-2/20">
        <p className="text-sm text-ice-dim">
          No commissioner is registered for {team.conference} {team.sport} yet.
        </p>
      </div>
    );
  }

  return (
    <div className="h-[70vh] flex flex-col">
      <div className="mb-3">
        <h1 className="font-display text-lg font-semibold">League Commissioner</h1>
        <p className="text-xs text-ice-dim">
          {team.conference} {team.sport} · Direct thread visible to your team&apos;s staff.
        </p>
        {commissioners.length > 1 && (
          <select
            value={selected.id}
            onChange={(e) =>
              setSelected(commissioners.find((c) => c.id === e.target.value) ?? commissioners[0])
            }
            className="mt-2 bg-rink border border-line-white rounded-md px-2 py-1 text-xs outline-none focus:border-faceoff-blue"
          >
            {commissioners.map((c) => (
              <option key={c.id} value={c.id}>
                {c.full_name}
              </option>
            ))}
          </select>
        )}
      </div>
      <div className="flex-1 min-h-0">
        <CommissionerMessageThread
          commissionerId={selected.id}
          teamId={team.id}
          senderRole="team"
          senderProfileId={profile.id}
          senderName={profile.full_name}
        />
      </div>
    </div>
  );
}
