"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/client";
import { Profile } from "@/lib/types";

const ROLE_OPTIONS = [
  "President",
  "Vice President",
  "Head Coach",
  "Assistant Coach",
  "Treasurer",
  "Staff",
];

const CONFERENCE_OPTIONS = ["ACC", "SEC", "Big Ten", "Big 12", "Independent", "Other"];

export default function TeamProfilePage() {
  const supabase = createClient();
  const router = useRouter();
  const { team, profile, refresh } = useAuth();
  const [roster, setRoster] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  // Personal info form
  const [fullName, setFullName] = useState(profile?.full_name ?? "");
  const [role, setRole] = useState(profile?.role ?? "Staff");
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [email, setEmail] = useState(profile?.email ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Team settings form
  const [teamCity, setTeamCity] = useState(team?.city ?? "");
  const [teamConference, setTeamConference] = useState(team?.conference ?? "ACC");
  const [teamSaving, setTeamSaving] = useState(false);
  const [teamSaved, setTeamSaved] = useState(false);
  const [teamError, setTeamError] = useState<string | null>(null);

  // Leave team
  const [leaving, setLeaving] = useState(false);

  function reload() {
    if (!team) return;
    setLoading(true);
    supabase
      .from("profiles")
      .select("*")
      .eq("team_id", team.id)
      .then(({ data }) => {
        setRoster((data as Profile[]) ?? []);
        setLoading(false);
      });
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [team, supabase]);

  async function handleSaveInfo(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setSaving(true);
    setSaved(false);
    setError(null);
    const { error: err } = await supabase
      .from("profiles")
      .update({ full_name: fullName, role, phone: phone || null, email })
      .eq("id", profile.id);
    setSaving(false);
    if (err) {
      setError(err.message);
      return;
    }
    setSaved(true);
    await refresh();
    reload();
  }

  async function handleSaveTeam(e: React.FormEvent) {
    e.preventDefault();
    if (!team) return;
    setTeamSaving(true);
    setTeamSaved(false);
    setTeamError(null);
    const { error: err } = await supabase
      .from("teams")
      .update({ city: teamCity, conference: teamConference })
      .eq("id", team.id);
    setTeamSaving(false);
    if (err) {
      setTeamError(err.message);
      return;
    }
    setTeamSaved(true);
    await refresh();
  }

  async function handleLeaveTeam() {
    if (!profile || !team) return;
    const admins = roster.filter((p) => p.is_team_admin);
    if (profile.is_team_admin && admins.length <= 1) {
      alert("You're the only admin. Promote someone else before leaving.");
      return;
    }
    if (!confirm(`Leave ${team.short_name}? You'll need to be invited or approved to rejoin.`)) {
      return;
    }
    setLeaving(true);
    await supabase
      .from("profiles")
      .update({ team_id: null, is_team_admin: false })
      .eq("id", profile.id);
    setLeaving(false);
    await refresh();
    router.push("/onboarding");
  }

  async function handleToggleAdmin(member: Profile) {
    const admins = roster.filter((p) => p.is_team_admin);
    if (member.is_team_admin && admins.length <= 1) {
      alert("You can't remove the last admin. Promote someone else first.");
      return;
    }
    await supabase
      .from("profiles")
      .update({ is_team_admin: !member.is_team_admin })
      .eq("id", member.id);
    reload();
  }

  const [copied, setCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  const inviteUrl =
    typeof window !== "undefined" && team ? `${window.location.origin}/join/${team.invite_code}` : "";

  async function handleCopyInvite() {
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleRegenerateInvite() {
    if (!team) return;
    if (!confirm("This will invalidate the current invite link. Anyone with the old link won't be able to use it. Continue?")) {
      return;
    }
    setRegenerating(true);
    const newCode = Math.random().toString(36).slice(2, 10);
    await supabase.from("teams").update({ invite_code: newCode }).eq("id", team.id);
    setRegenerating(false);
    await refresh();
  }

  if (loading || !team || !profile) {
    return <p className="text-ice-dim">Loading...</p>;
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

      <section>
        <h2 className="font-display text-lg font-semibold mb-4">Your info</h2>
        <form
          onSubmit={handleSaveInfo}
          className="rounded-lg border border-line-white bg-rink-2/40 p-4 space-y-3 max-w-md"
        >
          <div>
            <label className="block text-xs text-ice-dim mb-1">Name</label>
            <input
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full bg-rink border border-line-white rounded-md px-3 py-2 text-sm outline-none focus:border-faceoff-blue"
            />
          </div>
          <div>
            <label className="block text-xs text-ice-dim mb-1">Title / role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full bg-rink border border-line-white rounded-md px-3 py-2 text-sm outline-none focus:border-faceoff-blue"
            >
              {ROLE_OPTIONS.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-ice-dim mb-1">Phone</label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(555) 555-5555"
              className="w-full bg-rink border border-line-white rounded-md px-3 py-2 text-sm outline-none focus:border-faceoff-blue"
            />
          </div>
          <div>
            <label className="block text-xs text-ice-dim mb-1">Contact email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-rink border border-line-white rounded-md px-3 py-2 text-sm outline-none focus:border-faceoff-blue"
            />
            <p className="text-xs text-ice-dim mt-1">
              This is the contact info other teams see — separate from your login email.
            </p>
          </div>
          {error && <p className="text-sm text-board-red">{error}</p>}
          {saved && <p className="text-sm text-faceoff-blue">Saved.</p>}
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 text-sm font-medium rounded-md bg-faceoff-blue text-ice hover:bg-faceoff-blue/90 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </form>
      </section>

      {profile.is_team_admin && (
        <section>
          <h2 className="font-display text-lg font-semibold mb-4">Team settings</h2>
          <form
            onSubmit={handleSaveTeam}
            className="rounded-lg border border-line-white bg-rink-2/40 p-4 space-y-3 max-w-md"
          >
            <div>
              <label className="block text-xs text-ice-dim mb-1">School</label>
              <input
                disabled
                value={team.school ?? team.short_name}
                className="w-full bg-rink border border-line-white rounded-md px-3 py-2 text-sm text-ice-dim opacity-60 cursor-not-allowed"
              />
              <p className="text-xs text-ice-dim mt-1">
                Contact ClubSync support to change your school.
              </p>
            </div>
            <div>
              <label className="block text-xs text-ice-dim mb-1">City</label>
              <input
                value={teamCity}
                onChange={(e) => setTeamCity(e.target.value)}
                className="w-full bg-rink border border-line-white rounded-md px-3 py-2 text-sm outline-none focus:border-faceoff-blue"
              />
            </div>
            <div>
              <label className="block text-xs text-ice-dim mb-1">Conference</label>
              <select
                value={teamConference}
                onChange={(e) => setTeamConference(e.target.value)}
                className="w-full bg-rink border border-line-white rounded-md px-3 py-2 text-sm outline-none focus:border-faceoff-blue"
              >
                {CONFERENCE_OPTIONS.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
            {teamError && <p className="text-sm text-board-red">{teamError}</p>}
            {teamSaved && <p className="text-sm text-faceoff-blue">Saved.</p>}
            <button
              type="submit"
              disabled={teamSaving}
              className="px-4 py-2 text-sm font-medium rounded-md bg-faceoff-blue text-ice hover:bg-faceoff-blue/90 disabled:opacity-50"
            >
              {teamSaving ? "Saving..." : "Save"}
            </button>
          </form>
        </section>
      )}

      {profile.is_team_admin && (
        <section>
          <h2 className="font-display text-lg font-semibold mb-2">Invite people</h2>
          <p className="text-sm text-ice-dim mb-4">
            Send this link to your coach or staff — anyone who opens it joins {team.short_name}{" "}
            right away, no approval needed.
          </p>
          <div className="rounded-lg border border-line-white bg-rink-2/40 p-4 flex flex-wrap items-center gap-3">
            <code className="flex-1 min-w-[200px] text-sm font-mono text-ice bg-rink px-3 py-2 rounded-md border border-line-white overflow-x-auto">
              {inviteUrl}
            </code>
            <button
              onClick={handleCopyInvite}
              className="px-3 py-2 text-sm font-medium rounded-md bg-faceoff-blue text-ice hover:bg-faceoff-blue/90 shrink-0"
            >
              {copied ? "Copied!" : "Copy link"}
            </button>
            <button
              onClick={handleRegenerateInvite}
              disabled={regenerating}
              className="px-3 py-2 text-sm text-ice-dim hover:text-ice shrink-0"
            >
              {regenerating ? "..." : "Regenerate link"}
            </button>
          </div>
        </section>
      )}

      <section>
        <h2 className="font-display text-lg font-semibold mb-4">Team roster</h2>
        {!profile.is_team_admin && (
          <p className="text-sm text-ice-dim mb-3">
            Only team admins can promote others. Contact your team admin if you need access.
          </p>
        )}
        <div className="space-y-2">
          {roster.map((member) => (
            <div
              key={member.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-line-white bg-rink-2/40 px-4 py-3"
            >
              <div>
                <p className="text-sm font-medium">
                  {member.full_name}{" "}
                  {member.id === profile.id && <span className="text-ice-dim">(you)</span>}
                </p>
                <p className="text-xs text-ice-dim mt-0.5">
                  {member.role} · {member.email}
                  {member.phone && ` · ${member.phone}`}
                </p>
              </div>
              {profile.is_team_admin ? (
                <button
                  onClick={() => handleToggleAdmin(member)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md shrink-0 ${
                    member.is_team_admin
                      ? "bg-faceoff-blue/15 text-faceoff-blue hover:bg-faceoff-blue/25"
                      : "border border-line-white text-ice-dim hover:text-ice"
                  }`}
                >
                  {member.is_team_admin ? "Admin" : "Make admin"}
                </button>
              ) : (
                member.is_team_admin && (
                  <span className="text-xs font-mono px-2 py-1 rounded-full bg-faceoff-blue/15 text-faceoff-blue shrink-0">
                    Admin
                  </span>
                )
              )}
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="font-display text-lg font-semibold mb-4 text-board-red">Danger zone</h2>
        <div className="rounded-lg border border-board-red/40 bg-board-red/5 p-4 flex items-center justify-between gap-3 flex-wrap">
          <p className="text-sm text-ice-dim">
            Leaving removes you from {team.short_name}. You&apos;ll need a new invite or an
            admin&apos;s approval to rejoin.
          </p>
          <button
            onClick={handleLeaveTeam}
            disabled={leaving}
            className="px-4 py-2 text-sm font-medium rounded-md border border-board-red/50 text-board-red hover:bg-board-red/10 shrink-0 disabled:opacity-50"
          >
            {leaving ? "Leaving..." : `Leave ${team.short_name}`}
          </button>
        </div>
      </section>
    </div>
  );
}
