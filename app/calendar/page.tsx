"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/client";
import { Weekend, Team } from "@/lib/types";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function toKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

export default function CalendarPage() {
  const supabase = createClient();
  const { team } = useAuth();
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d;
  });
  const [weekends, setWeekends] = useState<Weekend[]>([]);
  const [opponentNames, setOpponentNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!team) return;
    setLoading(true);
    Promise.all([
      supabase.from("weekends").select("*").eq("team_id", team.id),
      supabase.from("teams").select("id, short_name"),
    ]).then(([w, t]) => {
      setWeekends((w.data as Weekend[]) ?? []);
      const map: Record<string, string> = {};
      ((t.data as Team[]) ?? []).forEach((tm) => (map[tm.id] = tm.short_name));
      setOpponentNames(map);
      setLoading(false);
    });
  }, [team, supabase]);

  if (!team || loading) {
    return <p className="text-ice-dim">Loading...</p>;
  }

  const byDate: Record<string, Weekend> = {};
  weekends.forEach((w) => (byDate[w.date] = w));

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

  function opponentLabel(w: Weekend) {
    if (w.opponent_team_id) return opponentNames[w.opponent_team_id] ?? "TBD";
    if (w.opponent_name) return w.opponent_name;
    return "TBD";
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-xs uppercase tracking-widest text-faceoff-blue font-mono">
            Calendar
          </p>
          <h1 className="font-display text-3xl font-semibold mt-1">{team.short_name}</h1>
        </div>
        <div className="flex items-center gap-2">
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
      </div>

      <div className="grid grid-cols-7 gap-px bg-line-white rounded-lg overflow-hidden border border-line-white">
        {WEEKDAYS.map((d) => (
          <div
            key={d}
            className="bg-rink-2 text-center text-xs font-mono text-ice-dim py-2"
          >
            {d}
          </div>
        ))}
        {cells.map((date, i) => {
          if (!date) return <div key={i} className="bg-rink min-h-[90px] sm:min-h-[110px]" />;
          const key = toKey(date);
          const w = byDate[key];
          const isToday = key === today;
          return (
            <div
              key={i}
              className={`bg-rink min-h-[90px] sm:min-h-[110px] p-1.5 sm:p-2 ${
                isToday ? "ring-1 ring-inset ring-faceoff-blue" : ""
              }`}
            >
              <p className={`text-xs font-mono ${isToday ? "text-faceoff-blue" : "text-ice-dim"}`}>
                {date.getDate()}
              </p>
              {w && (
                <div
                  className={`mt-1 rounded px-1.5 py-1 text-[10px] sm:text-xs leading-tight ${
                    w.status === "scheduled"
                      ? "bg-board-red/15 text-ice"
                      : w.status === "open"
                      ? "bg-faceoff-blue/15 text-faceoff-blue"
                      : "bg-line-white text-ice-dim"
                  }`}
                >
                  {w.status === "scheduled" ? (
                    <>
                      <span className="block font-medium truncate">
                        {w.is_home ? "vs" : "at"} {opponentLabel(w)}
                      </span>
                      {w.game_time && <span className="block opacity-80">{w.game_time}</span>}
                    </>
                  ) : w.status === "open" ? (
                    "Open"
                  ) : (
                    "Busy"
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-4 text-xs text-ice-dim">
        <Legend color="bg-board-red/40" label="Scheduled game" />
        <Legend color="bg-faceoff-blue/40" label="Open" />
        <Legend color="bg-line-white" label="Busy" />
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`w-2.5 h-2.5 rounded-sm ${color}`} />
      {label}
    </span>
  );
}
