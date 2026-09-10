import { NextRequest, NextResponse } from "next/server";
import { verifyCommissionerToken } from "@/lib/commissioner-token";
import { createAdminClient } from "@/lib/supabase/admin";

function page(title: string, message: string) {
  return `
    <html>
      <body style="font-family: sans-serif; display:flex; align-items:center; justify-content:center; height:100vh; margin:0; background:#0b1220; color:#fff;">
        <div style="text-align:center; max-width: 420px; padding: 24px;">
          <h1 style="font-size: 22px; margin-bottom: 8px;">${title}</h1>
          <p style="color: #aab; font-size: 15px;">${message}</p>
        </div>
      </body>
    </html>
  `;
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) {
    return new NextResponse(page("Missing link", "This approval link is incomplete."), {
      status: 400,
      headers: { "Content-Type": "text/html" },
    });
  }

  const verified = verifyCommissionerToken(token);
  if (!verified) {
    return new NextResponse(
      page("Link expired or invalid", "This approval link has already been used, expired, or isn't valid. You can still handle this from the admin page."),
      { status: 400, headers: { "Content-Type": "text/html" } }
    );
  }

  const { profileId, action } = verified;
  const supabase = createAdminClient();

  const { data: profile, error: fetchErr } = await supabase
    .from("profiles")
    .select("full_name, commissioner_status")
    .eq("id", profileId)
    .single();

  if (fetchErr || !profile) {
    return new NextResponse(page("Not found", "This commissioner request no longer exists."), {
      status: 404,
      headers: { "Content-Type": "text/html" },
    });
  }

  if (profile.commissioner_status !== "pending") {
    return new NextResponse(
      page(
        "Already handled",
        `${profile.full_name}'s request was already marked "${profile.commissioner_status}".`
      ),
      { headers: { "Content-Type": "text/html" } }
    );
  }

  if (action === "approve") {
    await supabase
      .from("profiles")
      .update({ is_commissioner: true, commissioner_status: "approved" })
      .eq("id", profileId);
    return new NextResponse(
      page("Approved ✅", `${profile.full_name} is now an approved commissioner.`),
      { headers: { "Content-Type": "text/html" } }
    );
  }

  await supabase
    .from("profiles")
    .update({
      is_commissioner: false,
      commissioner_status: "none",
      commissioner_league: null,
      commissioner_sport: null,
    })
    .eq("id", profileId);
  return new NextResponse(
    page("Declined", `${profile.full_name}'s commissioner request was declined.`),
    { headers: { "Content-Type": "text/html" } }
  );
}
