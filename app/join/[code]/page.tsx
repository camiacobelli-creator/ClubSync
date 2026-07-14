"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/client";
import { Team } from "@/lib/types";

const ROLE_OPTIONS = [
  "President",
  "Vice President",
  "Head Coach",
  "Assistant Coach",
  "Treasurer",
  "Staff",
];

export default function JoinByInvitePage() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();
  const supabase = createClient();
  const { userId, profile, refresh } = useAuth();

  const [team, setTeam] = useState<Team | null>(null);
  const [role, setRole] = useState("Staff");
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!userId) return; // wait for auth to resolve (post-signup redirect lands here)
    supabase
      .from("teams")
      .select("*")
      .eq("invite_code", code)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) {
          setNotFound(true);
        } else {
          setTeam(data as Team);
        }
        setLoading(false);
      });
  }, [code, userId, supabase]);

  async function handleJoin() {
    if (!userId || !team) return;
    setJoining(true);
    setError(null);
    const { error: err } = await supabase
      .from("profiles")
      .update({ team_id: team.id, role })
      .eq("id", userId);
    setJoining(false);
    if (err) {
      setError(err.message);
      return;
    }
    await refresh();
    router.push("/");
  }

  if (!userId || loading) {
    return <p className="text-ice-dim">Loading...</p>;
  }

  if (notFound) {
    return (
      <div className="max-w-md mx-auto mt-12 text-center space-y-3">
        <h1 className="font-display text-2xl font-semibold">Invite not found</h1>
        <p className="text-ice-dim text-sm">
          This invite link isn&apos;t valid anymore — it may have been regenerated. Ask
          whoever sent it for a fresh link.
        </p>
      </div>
    );
  }

  if (profile?.team_id) {
    return (
      <div className="max-w-md mx-auto mt-12 text-center space-y-3">
        <h1 className="font-display text-2xl font-semibold">You&apos;re already on a team</h1>
        <p className="text-ice-dim text-sm">
          Your account is already linked to a team. If you meant to join{" "}
          <span className="text-ice">{team?.short_name}</span> instead, contact ClubSync
          support or use a different account.
        </p>
      </div>
    );
  }

  if (profile?.is_commissioner) {
    return (
      <div className="max-w-md mx-auto mt-12 text-center space-y-3">
        <h1 className="font-display text-2xl font-semibold">Commissioner accounts don&apos;t join teams</h1>
        <p className="text-ice-dim text-sm">Use a different account to join {team?.short_name}.</p>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto mt-12 text-center space-y-6">
      <div>
        <p className="text-xs uppercase tracking-widest text-faceoff-blue font-mono mb-2">
          You&apos;re invited
        </p>
        <h1 className="font-display text-2xl font-semibold">Join {team?.short_name}</h1>
        <p className="text-ice-dim text-sm mt-1">
          {team?.name} · {team?.city}
        </p>
      </div>

      <div className="text-left space-y-2">
        <label className="block text-xs text-ice-dim">Your role on this team</label>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="w-full bg-rink-2 border border-line-white rounded-md px-3 py-2 text-sm outline-none focus:border-faceoff-blue"
        >
          {ROLE_OPTIONS.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
      </div>

      {error && <p className="text-sm text-board-red">{error}</p>}

      <button
        onClick={handleJoin}
        disabled={joining}
        className="w-full py-2.5 text-sm font-medium rounded-md bg-faceoff-blue text-ice hover:bg-faceoff-blue/90 disabled:opacity-50"
      >
        {joining ? "Joining..." : `Join ${team?.short_name}`}
      </button>
    </div>
  );
}
