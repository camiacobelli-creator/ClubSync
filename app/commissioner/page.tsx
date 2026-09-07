"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth";
import { Team, Weekend } from "@/lib/types";

type Game = {
  weekend: Weekend;
  homeName: string;
  awayName: string;
  homeTeamId: string | null;
  awayTeamId: string | null;
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
  const { profile } = useAuth();
  const league = profile?.commissioner_league ?? null;
  const sport = profile?.commissioner_sport ?? null;
  const [allTeams, setAllTeams] = useState<Team[]>([]);
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
      setAllTeams(teamList);

      // Each on-platform matchup exists as a mirrored weekend row on both
      // teams' boards. Dedupe by the matchup itself (team pair + date) rather
      // than trusting is_home, and include off-platform opponents (which only
      // ever have a single row) so those games are visible too.
      const scheduled = (w.data as Weekend[]) ?? [];
      const seen = new Set<string>();
      const list: Game[] = [];

      scheduled.forEach((wk) => {
        const team = teamsById[wk.team_id];
        if (!team) return;
        const opponentTeam = wk.opponent_team_id ? teamsById[wk.opponent_team_id] : undefined;
        const opponentLabel = opponentTeam ? opponentTeam.short_name : wk.opponent_name || "TBD";

        const key = opponentTeam
          ? [team.id, opponentTeam.id].sort().join("-") + "-" + wk.date
          : wk.id;
        if (seen.has(key)) return;
        seen.add(key);

        list.push({
          weekend: wk,
          homeName: wk.is_home ? team.short_name : opponentLabel,
          awayName: wk.is_home ? opponentLabel : team.short_name,
          homeTeamId: wk.is_home ? team.id : opponentTeam?.id ?? null,
          awayTeamId: wk.is_home ? opponentTeam?.id ?? null : team.id,
        });
      });

      list.sort((a, b) => a.weekend.date.localeCompare(b.weekend.date));
      setGames(list);
      setLoading(false);
    });
  }, [supabase]);

  // Scope everything to the commissioner's own league and sport. A team
  // belongs if both match; a game belongs if either side's team does.
  const teams = allTeams.filter(
    (t) => (!league || t.conference === league) && (!sport || t.sport === sport)
  );
  const leagueTeamIds = new Set(teams.map((t) => t.id));
  const leagueGames =
    league || sport
      ? games.filter(
          (g) =>
            (g.homeTeamId && leagueTeamIds.has(g.homeTeamId)) ||
            (g.awayTeamId && leagueTeamIds.has(g.awayTeamId))
        )
      : games;

  const now = new Date().toISOString().slice(0, 10);
  const upcoming = leagueGames.filter((g) => g.weekend.date >= now);
  const past = leagueGames.filter((g) => g.weekend.date < now);

  const scopeLabel = [league, sport].filter(Boolean).join(" · ");

  return (
    <div className="space-y-10">
      <div>
        <p className="text-xs uppercase tracking-widest text-faceoff-blue font-mono">
          Commissioner view{scopeLabel ? ` · ${scopeLabel}` : ""}
        </p>
        <h1 className="font-display text-3xl font-semibold mt-1">League Schedule</h1>
        <p className="text-ice-dim mt-1">
          {scopeLabel
            ? `Every confirmed game across ${teams.length} ${scopeLabel} team${teams.length === 1 ? "" : "s"} on ClubSync.`
            : `Every confirmed game across all ${teams.length} teams on ClubSync.`}
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
                <div
                  key={t.id}
                  className="rounded-lg border border-line-white bg-rink-2/40 p-4 flex items-center justify-between gap-2"
                >
                  <Link href={`/teams/${t.id}`} className="min-w-0 hover:opacity-80">
                    <p className="font-medium text-sm truncate">{t.short_name}</p>
                    <p className="text-xs text-ice-dim mt-0.5">{t.city}</p>
                  </Link>
                  <Link
                    href={`/commissioner/messages/${t.id}`}
                    className="shrink-0 px-2.5 py-1.5 text-xs font-medium rounded-md border border-line-white text-ice-dim hover:text-ice hover:border-faceoff-blue"
                  >
                    Message
                  </Link>
                </div>
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
          {game.awayName} <span className="text-ice-dim font-normal">at</span> {game.homeName}
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
