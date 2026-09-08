"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/client";
import { Profile } from "@/lib/types";

export default function AdminCommissionersPage() {
  const supabase = createClient();
  const { profile } = useAuth();
  const [pending, setPending] = useState<Profile[]>([]);
  const [approved, setApproved] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  function load() {
    Promise.all([
      supabase
        .from("profiles")
        .select("*")
        .eq("commissioner_status", "pending")
        .order("created_at", { ascending: true }),
      supabase
        .from("profiles")
        .select("*")
        .eq("is_commissioner", true)
        .order("commissioner_league"),
    ]).then(([p, a]) => {
      setPending((p.data as Profile[]) ?? []);
      setApproved((a.data as Profile[]) ?? []);
      setLoading(false);
    });
  }

  useEffect(() => {
    if (profile?.is_site_admin) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.is_site_admin]);

  async function handleApprove(p: Profile) {
    setBusyId(p.id);
    await supabase
      .from("profiles")
      .update({ is_commissioner: true, commissioner_status: "approved" })
      .eq("id", p.id);
    setBusyId(null);
    load();
  }

  async function handleDeny(p: Profile) {
    setBusyId(p.id);
    await supabase
      .from("profiles")
      .update({
        is_commissioner: false,
        commissioner_status: "none",
        commissioner_league: null,
        commissioner_sport: null,
      })
      .eq("id", p.id);
    setBusyId(null);
    load();
  }

  async function handleRevoke(p: Profile) {
    if (!confirm(`Revoke commissioner access for ${p.full_name}?`)) return;
    setBusyId(p.id);
    await supabase
      .from("profiles")
      .update({
        is_commissioner: false,
        commissioner_status: "none",
        commissioner_league: null,
        commissioner_sport: null,
      })
      .eq("id", p.id);
    setBusyId(null);
    load();
  }

  if (!profile) return <p className="text-ice-dim">Loading...</p>;

  if (!profile.is_site_admin) {
    return <p className="text-ice-dim">You don&apos;t have access to this page.</p>;
  }

  return (
    <div className="space-y-10 max-w-3xl">
      <div>
        <p className="text-xs uppercase tracking-widest text-faceoff-blue font-mono">Admin</p>
        <h1 className="font-display text-3xl font-semibold mt-1">Commissioner Requests</h1>
      </div>

      <section>
        <h2 className="font-display text-lg font-semibold mb-4">
          Pending ({pending.length})
        </h2>
        {loading ? (
          <p className="text-sm text-ice-dim">Loading...</p>
        ) : pending.length === 0 ? (
          <p className="text-sm text-ice-dim">No pending requests.</p>
        ) : (
          <div className="space-y-2">
            {pending.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-line-white bg-rink-2/40 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium">{p.full_name}</p>
                  <p className="text-xs text-ice-dim mt-0.5">
                    {p.commissioner_league} · {p.commissioner_sport} · {p.email}
                    {p.phone && ` · ${p.phone}`}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => handleApprove(p)}
                    disabled={busyId === p.id}
                    className="px-3 py-1.5 text-xs font-medium rounded-md border border-faceoff-blue/40 text-faceoff-blue hover:bg-faceoff-blue/10 disabled:opacity-50"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => handleDeny(p)}
                    disabled={busyId === p.id}
                    className="px-3 py-1.5 text-xs font-medium rounded-md border border-board-red/40 text-board-red hover:bg-board-red/10 disabled:opacity-50"
                  >
                    Deny
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="font-display text-lg font-semibold mb-4">
          Active commissioners ({approved.length})
        </h2>
        {approved.length === 0 ? (
          <p className="text-sm text-ice-dim">None yet.</p>
        ) : (
          <div className="space-y-2">
            {approved.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-line-white bg-rink-2/40 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium">{p.full_name}</p>
                  <p className="text-xs text-ice-dim mt-0.5">
                    {p.commissioner_league} · {p.commissioner_sport} · {p.email}
                  </p>
                </div>
                <button
                  onClick={() => handleRevoke(p)}
                  disabled={busyId === p.id}
                  className="px-3 py-1.5 text-xs font-medium rounded-md border border-board-red/40 text-board-red hover:bg-board-red/10 shrink-0 disabled:opacity-50"
                >
                  Revoke
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
