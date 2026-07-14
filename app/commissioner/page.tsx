"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Team, Weekend } from "@/lib/types";

type Game = {
  weekend: Weekend;
  home: Team;
  away: Team;
};

function fmt(iso: string) {
  return new Date(iso + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function CommissionerPage() {
  const supabase = createClient();
  const [teams, setTeams] = useState<Team[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      supabase.from("teams").select("*").order("short_name"),
      supabase.from("weekends").select("*").eq("status", "scheduled"),
    ]).then(([t, w]) => {
      const teamList = (t.data as Team[]) ?? [];
      const teamsById: Record<string, Team> = {};
      teamList.forEach((tm) => (teamsById[tm.id] = tm));
      setTeams(teamList);

      // Each scheduled game exists as a mirrored weekend row on both teams'
      // boards. Keep only the row where is_home is true, so each game shows once.
      const scheduled = (w.data as Weekend[]) ?? [];
      const deduped = scheduled
        .filter((wk) => wk.is_home === true && wk.opponent_team_id)
        .map((wk) => {
          const home = teamsById[wk.team_id];
          const away = teamsById[wk.opponent_team_id!];
          if (!home || !away) return null;
          return { weekend: wk, home, away };
        })
        .filter((g): g is Game => g !== null)
        .sort((a, b) => a.weekend.date.localeCompare(b.weekend.date));

      setGames(deduped);
      setLoading(false);
    });
  }, [supabase]);

  const now = new Date().toISOString().slice(0, 10);
  const upcoming = games.filter((g) => g.weekend.date >= now);
  const past = games.filter((g) => g.weekend.date < now);

  return (
    <div className="space-y-10">
      <div>
        <p className="text-xs uppercase tracking-widest text-faceoff-blue font-mono">
          Commissioner view
        </p>
        <h1 className="font-display text-3xl font-semibold mt-1">League Schedule</h1>
        <p className="text-ice-dim mt-1">
          Every confirmed game across all {teams.length} teams on ClubSync.
        </p>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        <div className="rounded-lg border border-line-white bg-rink-2/40 p-4">
          <p className="text-2xl font-display font-semibold">{teams.length}</p>
          <p className="text-xs text-ice-dim mt-1">Teams on the platform</p>
        </div>
        <div className="rounded-lg border border-line-white bg-rink-2/40 p-4">
          <p className="text-2xl font-display font-semibold">{upcoming.length}</p>
          <p className="text-xs text-ice-dim mt-1">Upcoming confirmed games</p>
        </div>
        <div className="rounded-lg border border-line-white bg-rink-2/40 p-4">
          <p className="text-2xl font-display font-semibold">{past.length}</p>
          <p className="text-xs text-ice-dim mt-1">Games played this season</p>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-ice-dim">Loading schedule...</p>
      ) : (
        <>
          <section>
            <h2 className="font-display text-lg font-semibold mb-4">Upcoming</h2>
            {upcoming.length === 0 ? (
              <p className="text-sm text-ice-dim">No games confirmed yet.</p>
            ) : (
              <div className="space-y-2">
                {upcoming.map((g) => (
                  <GameRow key={g.weekend.id} game={g} />
                ))}
              </div>
            )}
          </section>

          {past.length > 0 && (
            <section>
              <h2 className="font-display text-lg font-semibold mb-4">Played</h2>
              <div className="space-y-2 opacity-70">
                {past
                  .slice()
                  .reverse()
                  .map((g) => (
                    <GameRow key={g.weekend.id} game={g} />
                  ))}
              </div>
            </section>
          )}

          <section>
            <h2 className="font-display text-lg font-semibold mb-4">All teams</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {teams.map((t) => (
                <Link
                  key={t.id}
                  href={`/teams/${t.id}`}
                  className="rounded-lg border border-line-white bg-rink-2/40 p-4 hover:border-faceoff-blue"
                >
                  <p className="font-medium text-sm">{t.short_name}</p>
                  <p className="text-xs text-ice-dim mt-0.5">{t.city}</p>
                </Link>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function GameRow({ game }: { game: Game }) {
  return (
    <div className="rounded-lg border border-line-white bg-rink-2/40 p-4 flex flex-wrap items-center justify-between gap-2">
      <div>
        <p className="font-medium text-sm">
          {game.away.short_name}{" "}
          <span className="text-ice-dim font-normal">at</span> {game.home.short_name}
        </p>
        <p className="text-xs text-ice-dim mt-0.5">{fmt(game.weekend.date)}</p>
      </div>
      <div className="text-right text-xs text-ice-dim">
        {game.weekend.game_time && <p>{game.weekend.game_time}</p>}
        {game.weekend.game_location && <p>{game.weekend.game_location}</p>}
      </div>
    </div>
  );
}
