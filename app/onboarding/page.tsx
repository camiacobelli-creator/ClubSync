"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth";
import { Team, TeamJoinRequest, School, Sport } from "@/lib/types";

export default function OnboardingPage() {
  const supabase = createClient();
  const router = useRouter();
  const { userId, profile, refresh } = useAuth();
  const [mode, setMode] = useState<"choose" | "create" | "join" | "checking">("checking");
  const [teams, setTeams] = useState<Team[]>([]);
  const [pendingRequest, setPendingRequest] = useState<TeamJoinRequest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Create-team fields
  const [schools, setSchools] = useState<School[]>([]);
  const [sports, setSports] = useState<Sport[]>([]);
  const [school, setSchool] = useState("");
  const [addingSchool, setAddingSchool] = useState(false);
  const [newSchoolName, setNewSchoolName] = useState("");
  const [sport, setSport] = useState("Ice Hockey");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [role, setRole] = useState("President");

  useEffect(() => {
    if (profile?.team_id || profile?.is_commissioner) {
      router.push("/");
      return;
    }
    if (!userId) return;

    Promise.all([
      supabase.from("teams").select("*").order("name"),
      supabase
        .from("team_join_requests")
        .select("*")
        .eq("profile_id", userId)
        .eq("status", "pending")
        .maybeSingle(),
      supabase.from("schools").select("*").order("name"),
      supabase.from("sports").select("*").order("name"),
    ]).then(([t, r, sc, sp]) => {
      setTeams((t.data as Team[]) ?? []);
      const req = r.data as TeamJoinRequest | null;
      setPendingRequest(req);
      setMode(req ? "checking" : "choose");
      setSchools((sc.data as School[]) ?? []);
      const sportList = (sp.data as Sport[]) ?? [];
      setSports(sportList);
      if (sportList.length > 0) setSport(sportList[0].name);
    });
  }, [profile, userId, router, supabase]);

  function handleSchoolChange(name: string) {
    setSchool(name);
    const found = schools.find((s) => s.name === name);
    if (found) {
      setCity(found.city ?? "");
      setState(found.state ?? "");
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;

    let finalSchool = school;

    if (addingSchool) {
      if (!newSchoolName.trim()) return;
      finalSchool = newSchoolName.trim();
      setLoading(true);
      setError(null);
      const { error: schoolErr } = await supabase
        .from("schools")
        .insert({ name: finalSchool, city: city || null, state: state || null });
      if (schoolErr && schoolErr.code !== "23505") {
        setLoading(false);
        setError(schoolErr.message);
        return;
      }
    } else if (!school) {
      return;
    }

    setLoading(true);
    setError(null);

    const { data: team, error: teamErr } = await supabase
      .from("teams")
      .insert({
        name: `${finalSchool} Club ${sport}`,
        short_name: finalSchool,
        city: state ? `${city}, ${state}` : city,
        conference: "ACC",
        school: finalSchool,
        sport,
      })
      .select()
      .single();

    if (teamErr || !team) {
      setLoading(false);
      setError(
        teamErr?.code === "23505"
          ? `There's already a ${sport} team for ${finalSchool}. Try requesting to join it instead.`
          : teamErr?.message ?? "Couldn't create team."
      );
      return;
    }

    const { error: profileErr } = await supabase
      .from("profiles")
      .update({ team_id: team.id, role, is_team_admin: true })
      .eq("id", userId);

    setLoading(false);
    if (profileErr) {
      setError(profileErr.message);
      return;
    }
    await refresh();
    router.push("/");
  }

  async function handleCommissioner() {
    if (!userId) return;
    setLoading(true);
    setError(null);
    const { error: profileErr } = await supabase
      .from("profiles")
      .update({ is_commissioner: true, role: "Commissioner" })
      .eq("id", userId);
    setLoading(false);
    if (profileErr) {
      setError(profileErr.message);
      return;
    }
    await refresh();
    router.push("/commissioner");
  }

  async function handleRequestToJoin(teamId: string) {
    if (!userId) return;
    setLoading(true);
    setError(null);
    const { data, error: reqErr } = await supabase
      .from("team_join_requests")
      .insert({ team_id: teamId, profile_id: userId, requested_role: role })
      .select()
      .single();
    setLoading(false);
    if (reqErr) {
      setError(
        reqErr.code === "23505"
          ? "You've already requested to join this team."
          : reqErr.message
      );
      return;
    }
    setPendingRequest(data as TeamJoinRequest);
    setMode("checking");
  }

  if (mode === "checking" && pendingRequest) {
    const team = teams.find((t) => t.id === pendingRequest.team_id);
    return (
      <div className="max-w-md mx-auto mt-12 text-center space-y-4">
        <h1 className="font-display text-2xl font-semibold">Request sent</h1>
        <p className="text-ice-dim text-sm">
          Your request to join {team?.short_name ?? "the team"} as {pendingRequest.requested_role}{" "}
          is waiting on approval from one of their admins. Check back soon, or refresh this page.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="text-sm text-faceoff-blue hover:underline"
        >
          Refresh
        </button>
      </div>
    );
  }

  if (mode === "checking") {
    return <p className="text-ice-dim">Loading...</p>;
  }

  if (mode === "choose") {
    return (
      <div className="max-w-md mx-auto mt-12 text-center space-y-6">
        <div>
          <h1 className="font-display text-2xl font-semibold">One more step</h1>
          <p className="text-ice-dim text-sm mt-1">
            Create your team&apos;s profile, or request to join one that&apos;s already on
            ClubSync.
          </p>
        </div>
        <div className="grid gap-3">
          <button
            onClick={() => setMode("create")}
            className="rounded-lg border border-faceoff-blue bg-faceoff-blue/10 px-4 py-3 text-sm font-medium hover:bg-faceoff-blue/20"
          >
            Create a new team
          </button>
          <button
            onClick={() => setMode("join")}
            className="rounded-lg border border-line-white px-4 py-3 text-sm font-medium hover:border-ice-dim"
          >
            Request to join an existing team
          </button>
          <button
            onClick={handleCommissioner}
            disabled={loading}
            className="rounded-lg border border-line-white px-4 py-3 text-sm font-medium text-ice-dim hover:text-ice hover:border-ice-dim disabled:opacity-50"
          >
            I&apos;m the league commissioner
          </button>
        </div>
        {error && <p className="text-sm text-board-red mt-3">{error}</p>}
      </div>
    );
  }

  if (mode === "join") {
    return (
      <div className="max-w-md mx-auto mt-12 space-y-6">
        <div>
          <h1 className="font-display text-2xl font-semibold">Request to join</h1>
          <p className="text-ice-dim text-sm mt-1">
            Pick your team and role. Their admin will need to approve you.
          </p>
        </div>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="w-full bg-rink-2 border border-line-white rounded-md px-3 py-2 text-sm outline-none focus:border-faceoff-blue"
        >
          <option>President</option>
          <option>Vice President</option>
          <option>Head Coach</option>
          <option>Assistant Coach</option>
          <option>Staff</option>
        </select>
        <div className="space-y-2">
          {teams.map((t) => (
            <button
              key={t.id}
              disabled={loading}
              onClick={() => handleRequestToJoin(t.id)}
              className="w-full text-left rounded-lg border border-line-white bg-rink-2/40 px-4 py-3 text-sm hover:border-faceoff-blue disabled:opacity-50"
            >
              <span className="font-medium">{t.name}</span>
              <span className="text-ice-dim"> · {t.city}</span>
            </button>
          ))}
          {teams.length === 0 && (
            <p className="text-sm text-ice-dim">No teams yet — be the first to create one.</p>
          )}
        </div>
        {error && <p className="text-sm text-board-red">{error}</p>}
        <button onClick={() => setMode("choose")} className="text-sm text-ice-dim hover:text-ice">
          ← Back
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto mt-12 space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Create your team</h1>
        <p className="text-ice-dim text-sm mt-1">
          You&apos;ll be the team admin — you approve everyone else who joins.
        </p>
      </div>
      <form onSubmit={handleCreate} className="space-y-3">
        <div>
          <label className="block text-xs text-ice-dim mb-1">School</label>
          {!addingSchool ? (
            <>
              <select
                required
                value={school}
                onChange={(e) => {
                  if (e.target.value === "__add__") {
                    setAddingSchool(true);
                    setSchool("");
                  } else {
                    handleSchoolChange(e.target.value);
                  }
                }}
                className="w-full bg-rink-2 border border-line-white rounded-md px-3 py-2 text-sm outline-none focus:border-faceoff-blue"
              >
                <option value="">Select your school</option>
                {schools.map((s) => (
                  <option key={s.name} value={s.name}>
                    {s.name}
                  </option>
                ))}
                <option value="__add__">+ My school isn&apos;t listed</option>
              </select>
            </>
          ) : (
            <div className="space-y-2">
              <input
                required
                value={newSchoolName}
                onChange={(e) => setNewSchoolName(e.target.value)}
                placeholder="School name"
                className="w-full bg-rink-2 border border-line-white rounded-md px-3 py-2 text-sm outline-none focus:border-faceoff-blue"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="City"
                  className="bg-rink-2 border border-line-white rounded-md px-3 py-2 text-sm outline-none focus:border-faceoff-blue"
                />
                <input
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  placeholder="State"
                  className="bg-rink-2 border border-line-white rounded-md px-3 py-2 text-sm outline-none focus:border-faceoff-blue"
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  setAddingSchool(false);
                  setNewSchoolName("");
                }}
                className="text-xs text-ice-dim hover:text-ice"
              >
                ← Choose from the list instead
              </button>
            </div>
          )}
        </div>
        <div>
          <label className="block text-xs text-ice-dim mb-1">Sport</label>
          <select
            required
            value={sport}
            onChange={(e) => setSport(e.target.value)}
            className="w-full bg-rink-2 border border-line-white rounded-md px-3 py-2 text-sm outline-none focus:border-faceoff-blue"
          >
            {sports.map((s) => (
              <option key={s.name} value={s.name}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="w-full bg-rink-2 border border-line-white rounded-md px-3 py-2 text-sm outline-none focus:border-faceoff-blue"
        >
          <option>President</option>
          <option>Vice President</option>
          <option>Head Coach</option>
        </select>
        {error && <p className="text-sm text-board-red">{error}</p>}
        <button
          type="submit"
          disabled={loading || (addingSchool ? !newSchoolName.trim() : !school)}
          className="w-full py-2 text-sm font-medium rounded-md bg-faceoff-blue text-ice hover:bg-faceoff-blue/90 disabled:opacity-50"
        >
          {loading ? "Creating..." : "Create team"}
        </button>
      </form>
      <button onClick={() => setMode("choose")} className="text-sm text-ice-dim hover:text-ice">
        ← Back
      </button>
    </div>
  );
}
