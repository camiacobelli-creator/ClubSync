"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

function SignupForm() {
  const supabase = createClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, phone } },
    });
    if (signUpError || !data.user) {
      setLoading(false);
      setError(signUpError?.message ?? "Something went wrong.");
      return;
    }

    setLoading(false);
    router.push(redirect || "/onboarding");
    router.refresh();
  }

  return (
    <div className="max-w-sm mx-auto mt-12">
      <h1 className="font-display text-2xl font-semibold">Create your account</h1>
      <p className="text-ice-dim text-sm mt-1">
        You&apos;ll pick or create your team next.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-3">
        <input
          required
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Full name"
          className="w-full bg-rink-2 border border-line-white rounded-md px-3 py-2 text-sm outline-none focus:border-faceoff-blue"
        />
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Phone (optional)"
          className="w-full bg-rink-2 border border-line-white rounded-md px-3 py-2 text-sm outline-none focus:border-faceoff-blue"
        />
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          className="w-full bg-rink-2 border border-line-white rounded-md px-3 py-2 text-sm outline-none focus:border-faceoff-blue"
        />
        <input
          type="password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password (min 6 characters)"
          className="w-full bg-rink-2 border border-line-white rounded-md px-3 py-2 text-sm outline-none focus:border-faceoff-blue"
        />
        {error && <p className="text-sm text-board-red">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-2 text-sm font-medium rounded-md bg-faceoff-blue text-ice hover:bg-faceoff-blue/90 disabled:opacity-50"
        >
          {loading ? "Creating account..." : "Continue"}
        </button>
      </form>

      <p className="text-sm text-ice-dim mt-4">
        Already have an account?{" "}
        <Link
          href={redirect ? `/login?redirect=${encodeURIComponent(redirect)}` : "/login"}
          className="text-faceoff-blue hover:underline"
        >
          Log in
        </Link>
      </p>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={<p className="text-ice-dim">Loading...</p>}>
      <SignupForm />
    </Suspense>
  );
}
