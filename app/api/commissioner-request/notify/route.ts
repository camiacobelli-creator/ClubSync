import { NextRequest, NextResponse } from "next/server";
import { signCommissionerToken } from "@/lib/commissioner-token";

type ProfileRow = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  commissioner_league: string | null;
  commissioner_sport: string | null;
  commissioner_status: "none" | "pending" | "approved" | "denied";
};

type WebhookPayload = {
  type: "INSERT" | "UPDATE" | "DELETE";
  table: string;
  record: ProfileRow;
  old_record: ProfileRow | null;
};

export async function POST(req: NextRequest) {
  // Shared secret so only our Supabase Database Webhook can hit this route.
  const incomingSecret = req.headers.get("x-webhook-secret");
  if (incomingSecret !== process.env.COMMISSIONER_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const payload = (await req.json()) as WebhookPayload;
  const { record, old_record } = payload;

  const justBecamePending =
    record?.commissioner_status === "pending" && old_record?.commissioner_status !== "pending";

  if (!justBecamePending) {
    return NextResponse.json({ skipped: true });
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? req.nextUrl.origin;
  const approveToken = signCommissionerToken(record.id, "approve");
  const denyToken = signCommissionerToken(record.id, "deny");
  const approveUrl = `${siteUrl}/api/commissioner-request/action?token=${approveToken}`;
  const denyUrl = `${siteUrl}/api/commissioner-request/action?token=${denyToken}`;

  const html = `
    <div style="font-family: sans-serif; max-width: 480px;">
      <h2 style="margin-bottom: 4px;">New commissioner request</h2>
      <p style="color: #555; margin-top: 0;">Clubslate</p>
      <table style="margin: 16px 0; font-size: 14px;">
        <tr><td style="padding: 2px 8px 2px 0; color: #888;">Name</td><td>${record.full_name}</td></tr>
        <tr><td style="padding: 2px 8px 2px 0; color: #888;">Email</td><td>${record.email}</td></tr>
        <tr><td style="padding: 2px 8px 2px 0; color: #888;">Phone</td><td>${record.phone ?? "—"}</td></tr>
        <tr><td style="padding: 2px 8px 2px 0; color: #888;">League</td><td>${record.commissioner_league ?? "—"}</td></tr>
        <tr><td style="padding: 2px 8px 2px 0; color: #888;">Sport</td><td>${record.commissioner_sport ?? "—"}</td></tr>
      </table>
      <div>
        <a href="${approveUrl}" style="display:inline-block; margin-right:12px; padding:10px 20px; background:#1a73e8; color:#fff; text-decoration:none; border-radius:6px; font-weight:600;">Approve</a>
        <a href="${denyUrl}" style="display:inline-block; padding:10px 20px; background:#e53935; color:#fff; text-decoration:none; border-radius:6px; font-weight:600;">Decline</a>
      </div>
      <p style="color: #999; font-size: 12px; margin-top: 24px;">This link expires in 7 days. You can also handle this from the admin page at ${siteUrl}/admin/commissioners.</p>
    </div>
  `;

  const resendResp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM_EMAIL ?? "Clubslate <onboarding@resend.dev>",
      to: process.env.ADMIN_NOTIFY_EMAIL,
      subject: `Commissioner request: ${record.full_name} (${record.commissioner_league ?? ""} ${record.commissioner_sport ?? ""})`,
      html,
    }),
  });

  if (!resendResp.ok) {
    const errText = await resendResp.text();
    console.error("Resend send failed:", errText);
    return NextResponse.json({ error: "email send failed" }, { status: 502 });
  }

  return NextResponse.json({ sent: true });
}
