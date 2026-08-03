import Link from "next/link";
import { Team, Weekend } from "@/lib/types";

export default function TeamCard({ team, weekends }: { team: Team; weekends: Weekend[] }) {
  const openCount = weekends.filter((w) => w.status === "open").length;

  return (
    <Link
      href={`/teams/${team.id}`}
      className="block rounded-lg border border-line-white bg-rink-2/50 p-5 hover:border-faceoff-blue transition-colors"
    >
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-display text-lg font-semibold">{team.short_name}</h3>
          <p className="text-xs text-ice-dim mt-0.5">
            {team.city} · {team.conference}
          </p>
        </div>
        <span
          className="w-3 h-3 rounded-full mt-1 shrink-0"
          style={{ backgroundColor: team.color_primary }}
        />
      </div>
      <p className="text-sm text-ice-dim mt-4">
        <span className="text-faceoff-blue font-medium">{openCount}</span> open weekend
        {openCount === 1 ? "" : "s"}
      </p>
    </Link>
  );
}
