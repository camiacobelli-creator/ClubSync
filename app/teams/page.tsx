"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/client";
import { Team, Weekend } from "@/lib/types";
import TeamCard from "@/components/TeamCard";

export default function TeamsPage() {
  const supabase = createClient();
  const { team: myTeam } = useAuth();
  const [query, setQuery] = useState("");
  const [teams, setTeams] = useState<Team[]>([]);
  const [weekendsByTeam, setWeekendsByTeam] = useState<Record<string, Weekend[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      supabase.from("teams").select("*").order("short_name"),
      supabase.from("weekends").select("*"),
    ]).then(([t, w]) => {
      setTeams((t.data as Team[]) ?? []);
      const grouped: Record<string, Weekend[]> = {};
      ((w.data as Weekend[]) ?? []).forEach((wk) => {
        grouped[wk.team_id] = grouped[wk.team_id] ?? [];
        grouped[wk.team_id].push(wk);
      });
      setWeekendsByTeam(grouped);
      setLoading(false);
    });
  }, [supabase]);

  const others = teams
    .filter((t) => t.id !== myTeam?.id)
    .filter(
      (t) =>
        t.name.toLowerCase().includes(query.toLowerCase()) ||
        t.city.toLowerCase().includes(query.toLowerCase())
    );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold">Browse teams</h1>
        <p className="text-ice-dim mt-1">Find an opponent and see when they&apos;re open.</p>
      </div>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by team or city..."
        className="w-full sm:w-80 bg-rink-2 border border-line-white rounded-md px-3 py-2 text-sm text-ice placeholder:text-ice-dim/60 outline-none focus:border-faceoff-blue"
      />

      {loading ? (
        <p className="text-sm text-ice-dim">Loading teams...</p>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {others.map((t) => (
            <TeamCard key={t.id} team={t} weekends={weekendsByTeam[t.id] ?? []} />
          ))}
          {others.length === 0 && (
            <p className="text-sm text-ice-dim">No other teams on ClubSync yet.</p>
          )}
        </div>
      )}
    </div>
  );
}
