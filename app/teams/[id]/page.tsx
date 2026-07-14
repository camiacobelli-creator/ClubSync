"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/client";
import { Team, Weekend, Profile } from "@/lib/types";
import ScheduleGrid from "@/components/ScheduleGrid";
import RequestModal from "@/components/RequestModal";

export default function TeamDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = createClient();
  const { team: myTeam } = useAuth();

  const [team, setTeam] = useState<Team | null>(null);
  const [weekends, setWeekends] = useState<Weekend[]>([]);
  const [staff, setStaff] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Weekend | null>(null);
  const [sent, setSent] = useState(false);
  const [opponentNames, setOpponentNames] = useState<Record<string, string>>({});

  useEffect(() => {
    Promise.all([
      supabase.from("teams").select("*").eq("id", id).maybeSingle(),
      supabase.from("weekends").select("*").eq("team_id", id).order("date"),
      supabase.from("profiles").select("*").eq("team_id", id),
      supabase.from("teams").select("id, short_name"),
    ]).then(([t, w, p, all]) => {
      setTeam(t.data as Team | null);
      setWeekends((w.data as Weekend[]) ?? []);
      setStaff((p.data as Profile[]) ?? []);
      const map: Record<string, string> = {};
      ((all.data as Team[]) ?? []).forEach((tm) => (map[tm.id] = tm.short_name));
      setOpponentNames(map);
      setLoading(false);
    });
  }, [id, supabase]);

  async function handleConfirm(fromWantsToHost: boolean) {
    if (!selected || !myTeam) return;
    const { error } = await supabase.from("game_requests").insert({
      from_team_id: myTeam.id,
      to_team_id: selected.team_id,
      weekend_id: selected.id,
      from_wants_to_host: fromWantsToHost,
    });
    setSelected(null);
    if (!error) setSent(true);
  }

  if (loading) return <p className="text-ice-dim">Loading...</p>;
  if (!team) return <p className="text-ice-dim">Team not found.</p>;

  return (
    <div className="space-y-10">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-faceoff-blue font-mono">
            {team.conference}
          </p>
          <h1 className="font-display text-3xl font-semibold mt-1">{team.name}</h1>
          <p className="text-ice-dim mt-1">{team.city}</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <Link
            href={`/messages/${team.id}`}
            className="px-3 py-1.5 text-sm font-medium rounded-md border border-line-white text-ice-dim hover:text-ice hover:border-faceoff-blue"
          >
            Message {team.short_name}
          </Link>
          <span
            className="w-4 h-4 rounded-full shrink-0"
            style={{ backgroundColor: team.color_primary }}
          />
        </div>
      </div>

      {sent && (
        <div className="rounded-lg border border-faceoff-blue/50 bg-faceoff-blue/10 px-5 py-3 text-sm">
          Request sent to {team.short_name}. You&apos;ll see it under{" "}
          <button onClick={() => router.push("/requests")} className="underline font-medium">
            Requests
          </button>{" "}
          once they respond.
        </div>
      )}

      <section>
        <h2 className="font-display text-lg font-semibold mb-2">Schedule</h2>
        <p className="text-sm text-ice-dim mb-4">Click an open weekend to request a game.</p>
        {weekends.length === 0 ? (
          <p className="text-sm text-ice-dim">This team hasn&apos;t posted any weekends yet.</p>
        ) : (
          <ScheduleGrid
            weekends={weekends}
            opponentName={(oid) => opponentNames[oid] ?? oid}
            onSelectOpen={(w) => setSelected(w)}
          />
        )}
      </section>

      <section>
        <h2 className="font-display text-lg font-semibold mb-4">Staff contacts</h2>
        <div className="grid sm:grid-cols-3 gap-3">
          {staff.map((s) => (
            <div key={s.id} className="rounded-lg border border-line-white bg-rink-2/40 p-4">
              <p className="font-medium text-sm">{s.full_name}</p>
              <p className="text-xs text-faceoff-blue mt-0.5">{s.role}</p>
              {s.phone && <p className="text-xs text-ice-dim mt-2 font-mono">{s.phone}</p>}
              <p className="text-xs text-ice-dim font-mono">{s.email}</p>
            </div>
          ))}
          {staff.length === 0 && (
            <p className="text-sm text-ice-dim">No staff listed yet.</p>
          )}
        </div>
      </section>

      {selected && (
        <RequestModal
          weekend={selected}
          opponentName={team.short_name}
          myTeamName={myTeam?.short_name ?? "Your team"}
          onClose={() => setSelected(null)}
          onConfirm={handleConfirm}
        />
      )}
    </div>
  );
}
