"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/client";

export default function HelpPage() {
  const supabase = createClient();
  const { profile, team } = useAuth();
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!profile || !body.trim()) return;
    setSending(true);
    setError(null);
    const { error: err } = await supabase.from("support_messages").insert({
      sender_profile_id: profile.id,
      sender_name: profile.full_name,
      sender_email: profile.email,
      sender_role: profile.role,
      team_name: team?.short_name ?? null,
      is_commissioner: profile.is_commissioner,
      body: body.trim(),
    });
    setSending(false);
    if (err) {
      setError(err.message);
      return;
    }
    setBody("");
    setSent(true);
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div>
        <p className="text-xs uppercase tracking-widest text-faceoff-blue font-mono">Support</p>
        <h1 className="font-display text-3xl font-semibold mt-1">Help</h1>
        <p className="text-ice-dim mt-1">
          Run into a bug or have a question? Send a message directly to the ClubSync team.
        </p>
      </div>
      {sent ? (
        <div className="rounded-lg border border-faceoff-blue/50 bg-faceoff-blue/10 px-5 py-4 text-sm">
          Thanks — your message has been sent. We&apos;ll get back to you.
          <button
            onClick={() => setSent(false)}
            className="block mt-2 text-xs underline text-faceoff-blue"
          >
            Send another message
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={6}
            placeholder="What's going on?"
            className="w-full bg-rink-2 border border-line-white rounded-md px-3 py-2 text-sm outline-none focus:border-faceoff-blue resize-none"
          />
          {error && <p className="text-sm text-board-red">{error}</p>}
          <button
            type="submit"
            disabled={sending || !body.trim()}
            className="rounded-lg border border-faceoff-blue bg-faceoff-blue/10 px-4 py-2 text-sm font-medium hover:bg-faceoff-blue/20 disabled:opacity-50"
          >
            {sending ? "Sending..." : "Send message"}
          </button>
        </form>
      )}
    </div>
  );
}
