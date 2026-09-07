"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/client";
import { Team, Weekend } from "@/lib/types";
import * as XLSX from "xlsx";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type Game = {
  weekend: Weekend;
  homeName: string;
  awayName: string;
  homeTeamId: string | null;
  awayTeamId: string | null;
};

function toKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function fmt(iso: string) {
  return new Date(iso + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function CommissionerCalendarPage() {
  const supabase = createClient();
  const { profile } = useAuth();
  const league = profile?.commissioner_league ?? null;
  const sport = profile?.commissioner_sport ?? null;

  const [view, setView] = useState<"calendar" | "list">("calendar");
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d;
  });
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

  // Same league+sport scoping as the main commissioner dashboard.
  const leagueTeams = allTeams.filter(
    (t) => (!league || t.conference === league) && (!sport || t.sport === sport)
  );
  const leagueTeamIds = new Set(leagueTeams.map((t) => t.id));
  const leagueGames =
    league || sport
      ? games.filter(
          (g) =>
            (g.homeTeamId && leagueTeamIds.has(g.homeTeamId)) ||
            (g.awayTeamId && leagueTeamIds.has(g.awayTeamId))
        )
      : games;

  const scopeLabel = [league, sport].filter(Boolean).join(" · ");

  function handleExportExcel() {
    const rows = leagueGames.map((g) => ({
      Date: g.weekend.date,
      Away: g.awayName,
      Home: g.homeName,
      Time: g.weekend.game_time ?? "",
      Location: g.weekend.game_location ?? "",
      Notes: g.weekend.game_notes ?? "",
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    worksheet["!cols"] = [
      { wch: 12 },
      { wch: 22 },
      { wch: 22 },
      { wch: 10 },
      { wch: 24 },
      { wch: 30 },
    ];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "League Schedule");
    const filenameBase = scopeLabel ? scopeLabel.replace(/\s+/g, "-") : "League";
    XLSX.writeFile(workbook, `${filenameBase}-schedule.xlsx`);
  }

  if (loading) {
    return <p className="text-ice-dim">Loading...</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-xs uppercase tracking-widest text-faceoff-blue font-mono">
            League Calendar{scopeLabel ? ` · ${scopeLabel}` : ""}
          </p>
          <h1 className="font-display text-3xl font-semibold mt-1">
            {leagueGames.length} confirmed game{leagueGames.length === 1 ? "" : "s"}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-md border border-line-white overflow-hidden">
            <button
              onClick={() => setView("calendar")}
              className={`px-3 py-2 text-sm font-medium ${
                view === "calendar"
                  ? "bg-faceoff-blue/15 text-faceoff-blue"
                  : "text-ice-dim hover:text-ice"
              }`}
            >
              Calendar
            </button>
            <button
              onClick={() => setView("list")}
              className={`px-3 py-2 text-sm font-medium ${
                view === "list" ? "bg-faceoff-blue/15 text-faceoff-blue" : "text-ice-dim hover:text-ice"
              }`}
            >
              List
            </button>
          </div>
          <button
            onClick={handleExportExcel}
            disabled={leagueGames.length === 0}
            className="px-3 py-2 text-sm font-medium rounded-md border border-line-white text-ice-dim hover:text-ice hover:border-ice-dim disabled:opacity-50"
          >
            Export to Excel
          </button>
        </div>
      </div>

      {view === "calendar" ? (
        <CalendarView cursor={cursor} setCursor={setCursor} games={leagueGames} />
      ) : (
        <ListView games={leagueGames} />
      )}
    </div>
  );
}

function CalendarView({
  cursor,
  setCursor,
  games,
}: {
  cursor: Date;
  setCursor: (d: Date) => void;
  games: Game[];
}) {
  const byDate: Record<string, Game[]> = {};
  games.forEach((g) => {
    (byDate[g.weekend.date] ??= []).push(g);
  });

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const startOffset = firstOfMonth.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (Date | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);

  const today = toKey(new Date());
  const monthLabel = cursor.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-center gap-2">
        <button
          onClick={() => setCursor(new Date(year, month - 1, 1))}
          className="w-9 h-9 flex items-center justify-center rounded-md border border-line-white text-ice-dim hover:text-ice hover:border-ice-dim"
          aria-label="Previous month"
        >
          ←
        </button>
        <span className="font-display text-lg font-medium w-40 text-center">{monthLabel}</span>
        <button
          onClick={() => setCursor(new Date(year, month + 1, 1))}
          className="w-9 h-9 flex items-center justify-center rounded-md border border-line-white text-ice-dim hover:text-ice hover:border-ice-dim"
          aria-label="Next month"
        >
          →
        </button>
        <button
          onClick={() => {
            const d = new Date();
            d.setDate(1);
            setCursor(d);
          }}
          className="ml-1 px-3 py-2 text-sm text-ice-dim hover:text-ice"
        >
          Today
        </button>
      </div>

      <div className="grid grid-cols-7 gap-px bg-line-white rounded-lg overflow-hidden border border-line-white">
        {WEEKDAYS.map((d) => (
          <div key={d} className="bg-rink-2 text-center text-xs font-mono text-ice-dim py-2">
            {d}
          </div>
        ))}
        {cells.map((date, i) => {
          if (!date) return <div key={i} className="bg-rink min-h-[90px] sm:min-h-[110px]" />;
          const key = toKey(date);
          const dayGames = byDate[key] ?? [];
          const isToday = key === today;
          return (
            <div
              key={i}
              className={`bg-rink min-h-[90px] sm:min-h-[110px] p-1.5 sm:p-2 space-y-1 overflow-y-auto ${
                isToday ? "ring-1 ring-inset ring-faceoff-blue" : ""
              }`}
            >
              <p className={`text-xs font-mono ${isToday ? "text-faceoff-blue" : "text-ice-dim"}`}>
                {date.getDate()}
              </p>
              {dayGames.map((g) => (
                <div
                  key={g.weekend.id}
                  className="rounded px-1.5 py-1 text-[10px] sm:text-xs leading-tight bg-board-red/15 text-ice"
                >
                  <span className="block font-medium truncate">
                    {g.awayName} @ {g.homeName}
                  </span>
                  {g.weekend.game_time && <span className="block opacity-80">{g.weekend.game_time}</span>}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ListView({ games }: { games: Game[] }) {
  if (games.length === 0) {
    return <p className="text-sm text-ice-dim">No games confirmed yet.</p>;
  }

  return (
    <div className="space-y-2">
      {games.map((g) => (
        <div
          key={g.weekend.id}
          className="rounded-lg border border-line-white bg-rink-2/40 p-4 flex flex-wrap items-center justify-between gap-2"
        >
          <div>
            <p className="font-medium text-sm">
              {g.awayName} <span className="text-ice-dim font-normal">at</span>{" "}
              {g.homeName}
            </p>
            <p className="text-xs text-ice-dim mt-0.5">{fmt(g.weekend.date)}</p>
          </div>
          <div className="text-right text-xs text-ice-dim">
            {g.weekend.game_time && <p>{g.weekend.game_time}</p>}
            {g.weekend.game_location && <p>{g.weekend.game_location}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}
