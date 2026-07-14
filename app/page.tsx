"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/client";
import { Weekend, Team, Preference, WeekendStatus, TeamJoinRequest, Profile } from "@/lib/types";
import ScheduleGrid from "@/components/ScheduleGrid";

function fmtDate(iso: string) {
  return new Date(iso + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export default function Dashboard() {
  const supabase = createClient();
  const { loading: authLoading, team, profile } = useAuth();
  const [weekends, setWeekends] = useState<Weekend[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [opponentNames, setOpponentNames] = useState<Record<string, string>>({});
  const [allTeams, setAllTeams] = useState<Team[]>([]);
  const [joinRequests, setJoinRequests] = useState<(TeamJoinRequest & { requester?: Profile })[]>([]);
  const [loading, setLoading] = useState(true);

  const [newDate, setNewDate] = useState("");
  const [newStatus, setNewStatus] = useState<WeekendStatus>("open");
  const [newPref, setNewPref] = useState<Preference>("either");
  const [newOpponentTeamId, setNewOpponentTeamId] = useState(""); // "" = unset, "other" = off-platform
  const [newOpponentOther, setNewOpponentOther] = useState("");
  const [newIsHome, setNewIsHome] = useState(true);
  const [newTime, setNewTime] = useState("");
  const [newLocation, setNewLocation] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  function reload() {
    if (!team) return;
    setLoading(true);
    Promise.all([
      supabase.from("weekends").select("*").eq("team_id", team.id).order("date"),
      supabase
        .from("game_requests")
        .select("id", { count: "exact", head: true })
        .eq("to_team_id", team.id)
        .eq("status", "pending"),
      supabase.from("teams").select("*"),
      supabase
        .from("team_join_requests")
        .select("*")
        .eq("team_id", team.id)
        .eq("status", "pending"),
    ]).then(async ([w, r, t, jr]) => {
      setWeekends((w.data as Weekend[]) ?? []);
      setPendingCount(r.count ?? 0);
      const teamList = (t.data as Team[]) ?? [];
      setAllTeams(teamList);
      const map: Record<string, string> = {};
      teamList.forEach((tm) => (map[tm.id] = tm.short_name));
      setOpponentNames(map);

      const requests = (jr.data as TeamJoinRequest[]) ?? [];
      if (requests.length > 0) {
        const { data: requesterProfiles } = await supabase
          .from("profiles")
          .select("*")
          .in("id", requests.map((r) => r.profile_id));
        const pMap: Record<string, Profile> = {};
        ((requesterProfiles as Profile[]) ?? []).forEach((p) => (pMap[p.id] = p));
        setJoinRequests(requests.map((r) => ({ ...r, requester: pMap[r.profile_id] })));
      } else {
        setJoinRequests([]);
      }

      setLoading(false);
    });
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [team, supabase]);

  async function handleAddWeekend(e: React.FormEvent) {
    e.preventDefault();
    if (!team || !newDate) return;
    setSaving(true);
    setAddError(null);

    const isPlatformOpponent =
      newStatus === "scheduled" && newOpponentTeamId && newOpponentTeamId !== "other";

    const { data: inserted, error } = await supabase
      .from("weekends")
      .insert({
        team_id: team.id,
        date: newDate,
        status: newStatus,
        preference: newStatus === "open" ? newPref : null,
        opponent_team_id: isPlatformOpponent ? newOpponentTeamId : null,
        opponent_name:
          newStatus === "scheduled" && newOpponentTeamId === "other" && newOpponentOther
            ? newOpponentOther
            : null,
        is_home: newStatus === "scheduled" ? newIsHome : null,
        game_time: newStatus === "scheduled" && newTime ? newTime : null,
        game_location: newStatus === "scheduled" && newLocation ? newLocation : null,
        game_notes: newStatus === "scheduled" && newNotes ? newNotes : null,
      })
      .select()
      .single();

    if (error || !inserted) {
      setSaving(false);
      setAddError(
        error?.code === "23505" ? "You already have that weekend on your board." : error?.message ?? "Something went wrong."
      );
      return;
    }

    // If the opponent is on the platform, send them a confirmation request
    // instead of silently marking the game scheduled — they need to accept it
    // before it shows up on their own board.
    if (isPlatformOpponent) {
      const { error: reqError } = await supabase.from("game_requests").insert({
        from_team_id: team.id,
        to_team_id: newOpponentTeamId,
        source_weekend_id: inserted.id,
        kind: "confirmation",
        from_wants_to_host: newIsHome,
      });
      if (reqError) {
        setSaving(false);
        setAddError(reqError.message);
        return;
      }
    }

    setSaving(false);
    setNewDate("");
    setNewOpponentTeamId("");
    setNewOpponentOther("");
    setNewTime("");
    setNewLocation("");
    setNewNotes("");
    reload();
  }

  async function handleDeleteWeekend(w: Weekend) {
    const hasPlatformOpponent = !!w.opponent_team_id;
    if (!confirm(hasPlatformOpponent
      ? "Delete this game? It will be removed from both teams' schedules."
      : w.status === "scheduled"
      ? "Delete this game from your schedule?"
      : "Delete this weekend from your schedule?")) {
      return;
    }
    if (hasPlatformOpponent) {
      // Remove the mirrored entry on the opponent's board too, matched by date.
      await supabase
        .from("weekends")
        .delete()
        .eq("team_id", w.opponent_team_id!)
        .eq("date", w.date);
    }
    await supabase.from("weekends").delete().eq("id", w.id);
    reload();
  }

  async function handleApproveJoin(req: TeamJoinRequest) {
    if (!team) return;
    await supabase
      .from("profiles")
      .update({ team_id: team.id, role: req.requested_role })
      .eq("id", req.profile_id);
    await supabase.from("team_join_requests").update({ status: "approved" }).eq("id", req.id);
    reload();
  }

  async function handleDeclineJoin(req: TeamJoinRequest) {
    await supabase.from("team_join_requests").update({ status: "declined" }).eq("id", req.id);
    reload();
  }

  if (authLoading || loading) {
    return <p className="text-ice-dim">Loading...</p>;
  }

  if (!team) {
    return <p className="text-ice-dim">No team found. Try refreshing.</p>;
  }

  const today = new Date().toISOString().slice(0, 10);
  const scheduledGames = weekends
    .filter((w) => w.status === "scheduled")
    .sort((a, b) => a.date.localeCompare(b.date));
  const nextGame = scheduledGames.find((w) => w.date >= today);

  function opponentLabel(w: Weekend) {
    if (w.opponent_team_id) return opponentNames[w.opponent_team_id] ?? "TBD";
    if (w.opponent_name) return w.opponent_name;
    return "TBD";
  }

  return (
    <div className="space-y-10">
      <div>
        <p className="text-xs uppercase tracking-widest text-faceoff-blue font-mono">
          Team profile
        </p>
        <h1 className="font-display text-3xl font-semibold mt-1">{team.name}</h1>
        <p className="text-ice-dim mt-1">
          {team.city} · {team.conference}
        </p>
      </div>

      {pendingCount > 0 && (
        <div className="rounded-lg border border-board-red/50 bg-board-red/5 px-5 py-4 flex items-center justify-between">
          <p className="text-sm">
            <span className="font-medium">
              {pendingCount} game request{pendingCount > 1 ? "s" : ""}
            </span>{" "}
            waiting on your approval.
          </p>
          <Link href="/requests" className="text-sm font-medium text-board-red hover:underline">
            Review →
          </Link>
        </div>
      )}

      {profile?.is_team_admin && joinRequests.length > 0 && (
        <div className="rounded-lg border border-faceoff-blue/50 bg-faceoff-blue/5 px-5 py-4 space-y-3">
          <p className="text-sm font-medium">
            {joinRequests.length} {joinRequests.length > 1 ? "people want" : "person wants"} to
            join {team.short_name}
          </p>
          <div className="space-y-2">
            {joinRequests.map((req) => (
              <div
                key={req.id}
                className="flex items-center justify-between gap-3 bg-rink-2/40 rounded-md px-3 py-2"
              >
                <p className="text-sm">
                  <span className="font-medium">{req.requester?.full_name ?? "Someone"}</span>{" "}
                  <span className="text-ice-dim">
                    ({req.requested_role}) · {req.requester?.email}
                  </span>
                </p>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => handleApproveJoin(req)}
                    className="px-3 py-1 text-xs font-medium rounded-md bg-faceoff-blue text-ice hover:bg-faceoff-blue/90"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => handleDeclineJoin(req)}
                    className="px-3 py-1 text-xs text-ice-dim hover:text-ice"
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid sm:grid-cols-3 gap-4">
        <div className="rounded-lg border border-line-white bg-rink-2/40 p-4">
          <p className="text-2xl font-display font-semibold">
            {weekends.filter((w) => w.status === "open").length}
          </p>
          <p className="text-xs text-ice-dim mt-1">Open weekends</p>
        </div>
        <div className="rounded-lg border border-line-white bg-rink-2/40 p-4">
          <p className="text-2xl font-display font-semibold">{scheduledGames.length}</p>
          <p className="text-xs text-ice-dim mt-1">Games on the books</p>
        </div>
        <div className="rounded-lg border border-line-white bg-rink-2/40 p-4">
          <p className="text-2xl font-display font-semibold">
            {scheduledGames.filter((w) => w.date >= today).length}
          </p>
          <p className="text-xs text-ice-dim mt-1">Still to play</p>
        </div>
      </div>

      {nextGame && (
        <div className="rounded-lg border border-faceoff-blue/50 bg-faceoff-blue/10 px-5 py-4">
          <p className="text-xs uppercase tracking-widest text-faceoff-blue font-mono mb-1">
            Next game
          </p>
          <p className="text-sm">
            <span className="font-medium">
              {nextGame.is_home ? "vs" : "at"} {opponentLabel(nextGame)}
            </span>{" "}
            — {fmtDate(nextGame.date)}
            {nextGame.game_time && ` at ${nextGame.game_time}`}
          </p>
          {nextGame.game_location && (
            <p className="text-xs text-ice-dim mt-1">{nextGame.game_location}</p>
          )}
        </div>
      )}

      <section>
        <h2 className="font-display text-lg font-semibold mb-4">Your games</h2>
        {scheduledGames.length === 0 ? (
          <p className="text-sm text-ice-dim">No games on the books yet.</p>
        ) : (
          <div className="space-y-2">
            {scheduledGames.map((w) => (
              <GameRow
                key={w.id}
                weekend={w}
                opponentLabel={opponentLabel(w)}
                onSaved={reload}
                onDelete={handleDeleteWeekend}
                allTeams={allTeams}
                myTeamId={team.id}
              />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="font-display text-lg font-semibold mb-4">Open &amp; busy weekends</h2>
        {weekends.filter((w) => w.status !== "scheduled").length === 0 ? (
          <p className="text-sm text-ice-dim mb-4">Nothing marked yet — add a weekend below.</p>
        ) : (
          <div className="mb-4">
            <ScheduleGrid
              weekends={weekends.filter((w) => w.status !== "scheduled")}
              opponentName={(id) => opponentNames[id] ?? id}
              onDelete={handleDeleteWeekend}
            />
          </div>
        )}

        <form
          onSubmit={handleAddWeekend}
          className="rounded-lg border border-line-white bg-rink-2/40 p-4 space-y-3"
        >
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-xs text-ice-dim mb-1">Weekend date</label>
              <input
                type="date"
                required
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                className="bg-rink border border-line-white rounded-md px-3 py-2 text-sm outline-none focus:border-faceoff-blue"
              />
            </div>
            <div>
              <label className="block text-xs text-ice-dim mb-1">Status</label>
              <select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value as WeekendStatus)}
                className="bg-rink border border-line-white rounded-md px-3 py-2 text-sm outline-none focus:border-faceoff-blue"
              >
                <option value="open">Open</option>
                <option value="busy">Busy</option>
                <option value="scheduled">Already scheduled</option>
              </select>
            </div>
            {newStatus === "open" && (
              <div>
                <label className="block text-xs text-ice-dim mb-1">Preference</label>
                <select
                  value={newPref}
                  onChange={(e) => setNewPref(e.target.value as Preference)}
                  className="bg-rink border border-line-white rounded-md px-3 py-2 text-sm outline-none focus:border-faceoff-blue"
                >
                  <option value="home">Host</option>
                  <option value="away">Travel</option>
                  <option value="either">Either</option>
                </select>
              </div>
            )}
          </div>

          {newStatus === "scheduled" && (
            <div className="flex flex-wrap items-end gap-3 pt-1 border-t border-line-white/50">
              <p className="w-full text-xs text-ice-dim pt-3">
                All optional — fill in what you know now, edit the rest later. Picking a team
                already on ClubSync sends them a request to confirm the game.
              </p>
              <div>
                <label className="block text-xs text-ice-dim mb-1">Opponent</label>
                <select
                  value={newOpponentTeamId}
                  onChange={(e) => setNewOpponentTeamId(e.target.value)}
                  className="bg-rink border border-line-white rounded-md px-3 py-2 text-sm outline-none focus:border-faceoff-blue"
                >
                  <option value="">Select opponent</option>
                  {allTeams
                    .filter((t) => t.id !== team.id)
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.short_name}
                      </option>
                    ))}
                  <option value="other">Other (not on ClubSync)</option>
                </select>
              </div>
              {newOpponentTeamId === "other" && (
                <div>
                  <label className="block text-xs text-ice-dim mb-1">Opponent name</label>
                  <input
                    value={newOpponentOther}
                    onChange={(e) => setNewOpponentOther(e.target.value)}
                    placeholder="e.g. Furman"
                    className="bg-rink border border-line-white rounded-md px-3 py-2 text-sm outline-none focus:border-faceoff-blue"
                  />
                </div>
              )}
              <div>
                <label className="block text-xs text-ice-dim mb-1">Home or away</label>
                <select
                  value={newIsHome ? "home" : "away"}
                  onChange={(e) => setNewIsHome(e.target.value === "home")}
                  className="bg-rink border border-line-white rounded-md px-3 py-2 text-sm outline-none focus:border-faceoff-blue"
                >
                  <option value="home">Home</option>
                  <option value="away">Away</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-ice-dim mb-1">Time</label>
                <input
                  value={newTime}
                  onChange={(e) => setNewTime(e.target.value)}
                  placeholder="7:00 PM"
                  className="bg-rink border border-line-white rounded-md px-3 py-2 text-sm outline-none focus:border-faceoff-blue"
                />
              </div>
              <div>
                <label className="block text-xs text-ice-dim mb-1">Location</label>
                <input
                  value={newLocation}
                  onChange={(e) => setNewLocation(e.target.value)}
                  placeholder="Rink name"
                  className="bg-rink border border-line-white rounded-md px-3 py-2 text-sm outline-none focus:border-faceoff-blue"
                />
              </div>
              <div className="flex-1 min-w-[160px]">
                <label className="block text-xs text-ice-dim mb-1">Notes</label>
                <input
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  placeholder="Optional"
                  className="w-full bg-rink border border-line-white rounded-md px-3 py-2 text-sm outline-none focus:border-faceoff-blue"
                />
              </div>
            </div>
          )}

          <div className="flex items-center gap-3 pt-1">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm font-medium rounded-md bg-faceoff-blue text-ice hover:bg-faceoff-blue/90 disabled:opacity-50"
            >
              {saving ? "Adding..." : "Add to schedule"}
            </button>
            {addError && <p className="text-sm text-board-red">{addError}</p>}
          </div>
        </form>
      </section>
    </div>
  );
}

function GameRow({
  weekend,
  opponentLabel,
  onSaved,
  onDelete,
  allTeams,
  myTeamId,
}: {
  weekend: Weekend;
  opponentLabel: string;
  onSaved: () => void;
  onDelete: (weekend: Weekend) => void;
  allTeams: Team[];
  myTeamId: string;
}) {
  const supabase = createClient();
  const [editing, setEditing] = useState(false);
  const [opponentTeamId, setOpponentTeamId] = useState(
    weekend.opponent_team_id ?? (weekend.opponent_name ? "other" : "")
  );
  const [opponentOther, setOpponentOther] = useState(weekend.opponent_name ?? "");
  const [isHome, setIsHome] = useState(weekend.is_home ?? true);
  const [time, setTime] = useState(weekend.game_time ?? "");
  const [location, setLocation] = useState(weekend.game_location ?? "");
  const [notes, setNotes] = useState(weekend.game_notes ?? "");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setSaveError(null);

    const isPlatformOpponent = opponentTeamId && opponentTeamId !== "other";
    const opponentChangedToNewTeam =
      isPlatformOpponent && opponentTeamId !== weekend.opponent_team_id;

    const { error: err1 } = await supabase
      .from("weekends")
      .update({
        opponent_team_id: isPlatformOpponent ? opponentTeamId : null,
        opponent_name: !isPlatformOpponent && opponentOther ? opponentOther : null,
        is_home: isHome,
        game_time: time || null,
        game_location: location || null,
        game_notes: notes || null,
      })
      .eq("id", weekend.id);

    if (err1) {
      setSaving(false);
      setSaveError(err1.message);
      return;
    }

    // If you just pointed this game at a team that's now on the platform
    // (and it wasn't already linked to them), send a confirmation request.
    if (opponentChangedToNewTeam) {
      const { error: err2 } = await supabase.from("game_requests").insert({
        from_team_id: myTeamId,
        to_team_id: opponentTeamId,
        source_weekend_id: weekend.id,
        kind: "confirmation",
        from_wants_to_host: isHome,
      });
      if (err2) {
        setSaving(false);
        setSaveError(err2.message);
        return;
      }
    }

    setSaving(false);
    setEditing(false);
    onSaved();
  }

  if (!editing) {
    return (
      <div className="rounded-lg border border-line-white bg-rink-2/40 p-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium">
            {weekend.is_home ? "vs" : "at"} {opponentLabel}
          </p>
          <p className="text-xs text-ice-dim mt-0.5">
            {fmtDate(weekend.date)}
            {weekend.game_time && ` · ${weekend.game_time}`}
            {weekend.game_location && ` · ${weekend.game_location}`}
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => setEditing(true)}
            className="text-xs text-ice-dim hover:text-ice border border-line-white rounded-md px-3 py-1.5"
          >
            Edit
          </button>
          <button
            onClick={() => onDelete(weekend)}
            className="text-xs text-ice-dim hover:text-board-red border border-line-white hover:border-board-red/50 rounded-md px-3 py-1.5"
          >
            Delete
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-faceoff-blue/50 bg-faceoff-blue/5 p-4 space-y-3">
      <p className="text-xs text-ice-dim">{fmtDate(weekend.date)}</p>
      <div className="flex flex-wrap gap-3">
        <div>
          <label className="block text-xs text-ice-dim mb-1">Opponent</label>
          <select
            value={opponentTeamId}
            onChange={(e) => setOpponentTeamId(e.target.value)}
            className="bg-rink border border-line-white rounded-md px-3 py-2 text-sm outline-none focus:border-faceoff-blue"
          >
            <option value="">Select opponent</option>
            {allTeams
              .filter((t) => t.id !== myTeamId)
              .map((t) => (
                <option key={t.id} value={t.id}>
                  {t.short_name}
                </option>
              ))}
            <option value="other">Other (not on ClubSync)</option>
          </select>
        </div>
        {opponentTeamId === "other" && (
          <div>
            <label className="block text-xs text-ice-dim mb-1">Opponent name</label>
            <input
              value={opponentOther}
              onChange={(e) => setOpponentOther(e.target.value)}
              placeholder="e.g. Furman"
              className="bg-rink border border-line-white rounded-md px-3 py-2 text-sm outline-none focus:border-faceoff-blue"
            />
          </div>
        )}
        <select
          value={isHome ? "home" : "away"}
          onChange={(e) => setIsHome(e.target.value === "home")}
          className="bg-rink border border-line-white rounded-md px-3 py-2 text-sm outline-none focus:border-faceoff-blue"
        >
          <option value="home">Home</option>
          <option value="away">Away</option>
        </select>
        <input
          value={time}
          onChange={(e) => setTime(e.target.value)}
          placeholder="Time"
          className="bg-rink border border-line-white rounded-md px-3 py-2 text-sm outline-none focus:border-faceoff-blue"
        />
        <input
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="Location"
          className="bg-rink border border-line-white rounded-md px-3 py-2 text-sm outline-none focus:border-faceoff-blue"
        />
        <input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes"
          className="flex-1 min-w-[140px] bg-rink border border-line-white rounded-md px-3 py-2 text-sm outline-none focus:border-faceoff-blue"
        />
      </div>
      {opponentTeamId && opponentTeamId !== "other" && opponentTeamId !== weekend.opponent_team_id && (
        <p className="text-xs text-faceoff-blue">
          This will send {allTeams.find((t) => t.id === opponentTeamId)?.short_name} a request to confirm the game.
        </p>
      )}
      {saveError && <p className="text-sm text-board-red">{saveError}</p>}
      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-3 py-1.5 text-sm font-medium rounded-md bg-faceoff-blue text-ice hover:bg-faceoff-blue/90 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save"}
        </button>
        <button
          onClick={() => setEditing(false)}
          className="px-3 py-1.5 text-sm text-ice-dim hover:text-ice"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
