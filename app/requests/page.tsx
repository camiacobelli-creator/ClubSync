"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/client";
import { GameRequest, Team, Weekend } from "@/lib/types";

function fmt(iso: string) {
  return new Date(iso + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

const statusPill = (status: string) =>
  status === "pending"
    ? "bg-faceoff-blue/15 text-faceoff-blue"
    : status === "approved"
    ? "bg-green-500/15 text-green-400"
    : "bg-ice-dim/15 text-ice-dim";

export default function RequestsPage() {
  const supabase = createClient();
  const { team: myTeam } = useAuth();

  const [incoming, setIncoming] = useState<GameRequest[]>([]);
  const [outgoing, setOutgoing] = useState<GameRequest[]>([]);
  const [teamsById, setTeamsById] = useState<Record<string, Team>>({});
  const [weekendsById, setWeekendsById] = useState<Record<string, Weekend>>({});
  const [loading, setLoading] = useState(true);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [time, setTime] = useState("");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);

  function reload() {
    if (!myTeam) return;
    setLoading(true);
    Promise.all([
      supabase.from("game_requests").select("*").eq("to_team_id", myTeam.id).order("created_at", { ascending: false }),
      supabase.from("game_requests").select("*").eq("from_team_id", myTeam.id).order("created_at", { ascending: false }),
      supabase.from("teams").select("*"),
      supabase.from("weekends").select("*"),
    ]).then(([inc, out, teams, weekends]) => {
      setIncoming((inc.data as GameRequest[]) ?? []);
      setOutgoing((out.data as GameRequest[]) ?? []);
      const tMap: Record<string, Team> = {};
      ((teams.data as Team[]) ?? []).forEach((t) => (tMap[t.id] = t));
      setTeamsById(tMap);
      const wMap: Record<string, Weekend> = {};
      ((weekends.data as Weekend[]) ?? []).forEach((w) => (wMap[w.id] = w));
      setWeekendsById(wMap);
      setLoading(false);
    });
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myTeam, supabase]);

  // Availability flow: someone requested one of YOUR open weekends. You type in the details.
  async function handleApproveAvailability(r: GameRequest) {
    if (!time || !location || !r.weekend_id) return;
    setError(null);
    const weekend = weekendsById[r.weekend_id];
    if (!weekend) return;

    const isHostForToTeam = !r.from_wants_to_host;

    const { error: err1 } = await supabase
      .from("weekends")
      .update({
        status: "scheduled",
        opponent_team_id: r.from_team_id,
        game_time: time,
        game_location: location,
        game_notes: notes || null,
        is_home: isHostForToTeam,
      })
      .eq("id", weekend.id);

    const { error: err2 } = await supabase.from("weekends").upsert(
      {
        team_id: r.from_team_id,
        date: weekend.date,
        status: "scheduled",
        opponent_team_id: r.to_team_id,
        game_time: time,
        game_location: location,
        game_notes: notes || null,
        is_home: r.from_wants_to_host,
      },
      { onConflict: "team_id,date" }
    );

    const { error: err3 } = await supabase
      .from("game_requests")
      .update({ status: "approved" })
      .eq("id", r.id);

    if (err1 || err2 || err3) {
      setError((err1 || err2 || err3)?.message ?? "Something went wrong.");
      return;
    }

    setApprovingId(null);
    setTime("");
    setLocation("");
    setNotes("");
    reload();
  }

  // Confirmation flow: the other team already scheduled the game and filled in
  // details on their own board. You're just accepting — it mirrors onto yours.
  async function handleAcceptConfirmation(r: GameRequest) {
    if (!r.source_weekend_id) return;
    setConfirming(r.id);
    setError(null);
    const source = weekendsById[r.source_weekend_id];
    if (!source) {
      setConfirming(null);
      return;
    }

    const { error: err1 } = await supabase.from("weekends").upsert(
      {
        team_id: r.to_team_id,
        date: source.date,
        status: "scheduled",
        opponent_team_id: r.from_team_id,
        game_time: source.game_time,
        game_location: source.game_location,
        game_notes: source.game_notes,
        is_home: !r.from_wants_to_host,
      },
      { onConflict: "team_id,date" }
    );

    const { error: err2 } = await supabase
      .from("game_requests")
      .update({ status: "approved" })
      .eq("id", r.id);

    setConfirming(null);
    if (err1 || err2) {
      setError((err1 || err2)?.message ?? "Something went wrong.");
      return;
    }
    reload();
  }

  async function handleDecline(r: GameRequest) {
    await supabase.from("game_requests").update({ status: "declined" }).eq("id", r.id);
    reload();
  }

  if (loading) return <p className="text-ice-dim">Loading...</p>;

  return (
    <div className="space-y-10">
      <div>
        <h1 className="font-display text-3xl font-semibold">Requests</h1>
        <p className="text-ice-dim mt-1">Approve, decline, or track game requests.</p>
      </div>

      <section>
        <h2 className="font-display text-lg font-semibold mb-4">
          Incoming ({incoming.filter((r) => r.status === "pending").length} pending)
        </h2>
        <div className="space-y-3">
          {incoming.length === 0 && <p className="text-sm text-ice-dim">No requests yet.</p>}
          {incoming.map((r) => {
            const fromTeam = teamsById[r.from_team_id];
            const weekend =
              r.kind === "confirmation"
                ? r.source_weekend_id && weekendsById[r.source_weekend_id]
                : r.weekend_id && weekendsById[r.weekend_id];
            if (!fromTeam || !weekend) return null;

            if (r.kind === "confirmation") {
              return (
                <div key={r.id} className="rounded-lg border border-line-white bg-rink-2/40 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-medium">
                        <Link href={`/teams/${fromTeam.id}`} className="hover:text-faceoff-blue">
                          {fromTeam.short_name}
                        </Link>{" "}
                        scheduled a game with you
                      </p>
                      <p className="text-sm text-ice-dim mt-1">
                        {fmt(weekend.date)} · you {r.from_wants_to_host ? "travel" : "host"}
                        {weekend.game_time && ` · ${weekend.game_time}`}
                        {weekend.game_location && ` · ${weekend.game_location}`}
                      </p>
                    </div>
                    <span className={`text-xs font-mono px-2 py-1 rounded-full shrink-0 ${statusPill(r.status)}`}>
                      {r.status}
                    </span>
                  </div>
                  {r.status === "pending" && (
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() => handleAcceptConfirmation(r)}
                        disabled={confirming === r.id}
                        className="px-3 py-1.5 text-sm font-medium rounded-md bg-faceoff-blue text-ice hover:bg-faceoff-blue/90 disabled:opacity-50"
                      >
                        {confirming === r.id ? "Confirming..." : "Confirm"}
                      </button>
                      <button
                        onClick={() => handleDecline(r)}
                        className="px-3 py-1.5 text-sm text-ice-dim hover:text-ice"
                      >
                        Decline
                      </button>
                    </div>
                  )}
                  {error && confirming === null && (
                    <p className="text-sm text-board-red mt-2">{error}</p>
                  )}
                </div>
              );
            }

            return (
              <div key={r.id} className="rounded-lg border border-line-white bg-rink-2/40 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium">
                      <Link href={`/teams/${fromTeam.id}`} className="hover:text-faceoff-blue">
                        {fromTeam.short_name}
                      </Link>{" "}
                      wants to {r.from_wants_to_host ? "host you" : "travel to you"}
                    </p>
                    <p className="text-sm text-ice-dim mt-1">{fmt(weekend.date)}</p>
                  </div>
                  <span className={`text-xs font-mono px-2 py-1 rounded-full shrink-0 ${statusPill(r.status)}`}>
                    {r.status}
                  </span>
                </div>

                {r.status === "pending" && approvingId !== r.id && (
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => setApprovingId(r.id)}
                      className="px-3 py-1.5 text-sm font-medium rounded-md bg-faceoff-blue text-ice hover:bg-faceoff-blue/90"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => handleDecline(r)}
                      className="px-3 py-1.5 text-sm text-ice-dim hover:text-ice"
                    >
                      Decline
                    </button>
                  </div>
                )}

                {approvingId === r.id && (
                  <div className="mt-4 border-t border-line-white pt-4 space-y-3">
                    <p className="text-sm text-ice-dim">Fill in game details to confirm:</p>
                    <div className="grid sm:grid-cols-2 gap-3">
                      <input
                        value={time}
                        onChange={(e) => setTime(e.target.value)}
                        placeholder="Time (e.g. 7:00 PM)"
                        className="bg-rink border border-line-white rounded-md px-3 py-2 text-sm outline-none focus:border-faceoff-blue"
                      />
                      <input
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        placeholder="Rink / location"
                        className="bg-rink border border-line-white rounded-md px-3 py-2 text-sm outline-none focus:border-faceoff-blue"
                      />
                    </div>
                    <input
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Notes (optional)"
                      className="w-full bg-rink border border-line-white rounded-md px-3 py-2 text-sm outline-none focus:border-faceoff-blue"
                    />
                    {error && <p className="text-sm text-board-red">{error}</p>}
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApproveAvailability(r)}
                        disabled={!time || !location}
                        className="px-3 py-1.5 text-sm font-medium rounded-md bg-faceoff-blue text-ice hover:bg-faceoff-blue/90 disabled:opacity-40"
                      >
                        Confirm game
                      </button>
                      <button
                        onClick={() => setApprovingId(null)}
                        className="px-3 py-1.5 text-sm text-ice-dim hover:text-ice"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="font-display text-lg font-semibold mb-4">Sent by you</h2>
        <div className="space-y-3">
          {outgoing.length === 0 && (
            <p className="text-sm text-ice-dim">You haven&apos;t sent any requests.</p>
          )}
          {outgoing.map((r) => {
            const toTeam = teamsById[r.to_team_id];
            const weekend =
              r.kind === "confirmation"
                ? r.source_weekend_id && weekendsById[r.source_weekend_id]
                : r.weekend_id && weekendsById[r.weekend_id];
            if (!toTeam || !weekend) return null;
            return (
              <div
                key={r.id}
                className="rounded-lg border border-line-white bg-rink-2/40 p-4 flex items-center justify-between"
              >
                <div>
                  <p className="font-medium">
                    <Link href={`/teams/${toTeam.id}`} className="hover:text-faceoff-blue">
                      {toTeam.short_name}
                    </Link>{" "}
                    · {fmt(weekend.date)}
                  </p>
                  <p className="text-sm text-ice-dim mt-1">
                    You {r.from_wants_to_host ? "host" : "travel"}
                    {r.kind === "confirmation" && " · waiting on their confirmation"}
                  </p>
                </div>
                <span className={`text-xs font-mono px-2 py-1 rounded-full ${statusPill(r.status)}`}>
                  {r.status}
                </span>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
