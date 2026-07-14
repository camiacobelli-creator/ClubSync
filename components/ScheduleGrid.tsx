"use client";

import { Weekend } from "@/lib/types";

function formatDate(iso: string) {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const prefLabel: Record<string, string> = {
  home: "Wants to host",
  away: "Wants to travel",
  either: "Open either way",
};

export default function ScheduleGrid({
  weekends,
  opponentName,
  onSelectOpen,
  selectedWeekendId,
  onDelete,
}: {
  weekends: Weekend[];
  opponentName?: (id: string) => string;
  onSelectOpen?: (weekend: Weekend) => void;
  selectedWeekendId?: string;
  onDelete?: (weekend: Weekend) => void;
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {weekends
        .slice()
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((w) => {
          const clickable = w.status === "open" && !!onSelectOpen;
          const selected = w.id === selectedWeekendId;
          return (
            <div
              key={w.id}
              role={clickable ? "button" : undefined}
              tabIndex={clickable ? 0 : undefined}
              onClick={() => clickable && onSelectOpen?.(w)}
              className={`relative text-left rounded-lg border px-3 py-3 transition-colors ${
                selected
                  ? "border-faceoff-blue bg-faceoff-blue/10"
                  : w.status === "open"
                  ? "border-faceoff-blue/40 hover:border-faceoff-blue hover:bg-rink-2"
                  : w.status === "scheduled"
                  ? "border-board-red/40 bg-board-red/5"
                  : "border-line-white bg-rink-2/40"
              } ${clickable ? "cursor-pointer" : "cursor-default"}`}
            >
              {onDelete && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(w);
                  }}
                  aria-label="Delete"
                  className="absolute top-1.5 right-1.5 w-5 h-5 flex items-center justify-center rounded text-ice-dim/60 hover:text-board-red hover:bg-board-red/10 text-xs leading-none"
                >
                  ✕
                </button>
              )}
              <div className="font-mono text-xs text-ice-dim">{formatDate(w.date)}</div>
              {w.status === "open" && (
                <div className="mt-2 flex items-center gap-2">
                  <span className="faceoff-dot w-2.5 h-2.5 rounded-full bg-faceoff-blue inline-block" />
                  <span className="text-xs text-ice-dim">{prefLabel[w.preference ?? "either"]}</span>
                </div>
              )}
              {w.status === "busy" && (
                <div className="mt-2 text-xs text-ice-dim/70">Not available</div>
              )}
              {w.status === "scheduled" && (
                <div className="mt-2">
                  <div className="text-sm font-medium text-ice">
                    vs{" "}
                    {w.opponent_team_id && opponentName
                      ? opponentName(w.opponent_team_id)
                      : w.opponent_name ?? "TBD"}
                  </div>
                  {w.game_time && (
                    <div className="text-xs text-ice-dim mt-0.5">
                      {w.game_time} · {w.is_home ? "Home" : "Away"}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
    </div>
  );
}
