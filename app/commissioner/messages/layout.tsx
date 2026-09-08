"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/client";
import { Team } from "@/lib/types";

export default function CommissionerMessagesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const pathname = usePathname();
  const { profile } = useAuth();
  const league = profile?.commissioner_league ?? null;
  const sport = profile?.commissioner_sport ?? null;
  const [teams, setTeams] = useState<Team[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  const activeTeamId = pathname.startsWith("/commissioner/messages/")
    ? pathname.split("/commissioner/messages/")[1]
    : null;

  useEffect(() => {
    supabase
      .from("teams")
      .select("*")
      .order("short_name")
      .then(({ data }) => {
        const all = (data as Team[]) ?? [];
        const scoped = all.filter(
          (t) => (!league || t.conference === league) && (!sport || t.sport === sport)
        );
        setTeams(scoped);
        setLoading(false);
      });
  }, [league, sport, supabase]);

  const filtered = teams.filter((t) => t.short_name.toLowerCase().includes(query.toLowerCase()));
  const showListOnMobile = !activeTeamId;

  return (
    <div className="grid md:grid-cols-[300px_1fr] gap-6 h-[calc(100vh-8rem)] min-h-[500px]">
      <div
        className={`${showListOnMobile ? "block" : "hidden"} md:block border border-line-white rounded-lg bg-rink-2/40 overflow-hidden flex flex-col`}
      >
        <div className="p-3 border-b border-line-white">
          <h1 className="font-display text-lg font-semibold mb-2">Messages</h1>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find a team..."
            className="w-full bg-rink border border-line-white rounded-md px-3 py-1.5 text-sm outline-none focus:border-faceoff-blue"
          />
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <p className="text-sm text-ice-dim p-3">Loading...</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-ice-dim p-3">No teams in your league yet.</p>
          ) : (
            filtered.map((t) => (
              <Link
                key={t.id}
                href={`/commissioner/messages/${t.id}`}
                className={`block px-3 py-3 border-b border-line-white/50 hover:bg-rink-2 ${
                  activeTeamId === t.id ? "bg-rink-2" : ""
                }`}
              >
                <p className="text-sm font-medium truncate">{t.short_name}</p>
                <p className="text-xs text-ice-dim mt-0.5 truncate">{t.city}</p>
              </Link>
            ))
          )}
        </div>
      </div>

      <div className={`${showListOnMobile ? "hidden" : "block"} md:block min-h-0`}>{children}</div>
    </div>
  );
}
