"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const supabase = createClient();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // Supabase establishes a temporary recovery session from the emailed link.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });
    // Also check immediately in case the event already fired before mount.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => subscription.unsubscribe();
  }, [supabase]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setDone(true);
    setTimeout(() => router.push("/"), 1500);
  }

  if (done) {
    return (
      <div className="max-w-sm mx-auto mt-12 text-center space-y-3">
        <h1 className="font-display text-2xl font-semibold">Password updated</h1>
        <p className="text-ice-dim text-sm">Taking you to your dashboard...</p>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="max-w-sm mx-auto mt-12 text-center space-y-3">
        <p className="text-ice-dim text-sm">
          Open this page from the password reset link in your email.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-sm mx-auto mt-12">
      <h1 className="font-display text-2xl font-semibold">Set a new password</h1>

      <form onSubmit={handleSubmit} className="mt-6 space-y-3">
        <input
          type="password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="New password (min 6 characters)"
          className="w-full bg-rink-2 border border-line-white rounded-md px-3 py-2 text-sm outline-none focus:border-faceoff-blue"
        />
        <input
          type="password"
          required
          minLength={6}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Confirm new password"
          className="w-full bg-rink-2 border border-line-white rounded-md px-3 py-2 text-sm outline-none focus:border-faceoff-blue"
        />
        {error && <p className="text-sm text-board-red">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-2 text-sm font-medium rounded-md bg-faceoff-blue text-ice hover:bg-faceoff-blue/90 disabled:opacity-50"
        >
          {loading ? "Updating..." : "Update password"}
        </button>
      </form>
    </div>
  );
}
