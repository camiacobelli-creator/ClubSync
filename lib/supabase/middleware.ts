import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  // TEMPORARY DIAGNOSTIC: surface the real error in the browser instead of a
  // generic 500, so we can see exactly what's failing. Remove once fixed.
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return new NextResponse(
      `Missing env vars. URL present: ${!!process.env.NEXT_PUBLIC_SUPABASE_URL}, KEY present: ${!!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
      { status: 500 }
    );
  }

  try {
    let supabaseResponse = NextResponse.next({ request });

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
            supabaseResponse = NextResponse.next({ request });
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, options)
            );
          },
        },
      }
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const publicPaths = ["/login", "/signup", "/welcome", "/forgot-password", "/reset-password"];
    const isPublic = publicPaths.some((p) => request.nextUrl.pathname.startsWith(p));

    if (!user && !isPublic) {
      const url = request.nextUrl.clone();
      if (request.nextUrl.pathname.startsWith("/join/")) {
        url.pathname = "/signup";
        url.searchParams.set("redirect", request.nextUrl.pathname);
      } else {
        url.pathname = "/welcome";
      }
      return NextResponse.redirect(url);
    }

    return supabaseResponse;
  } catch (err) {
    return new NextResponse(`Middleware error: ${err instanceof Error ? err.message : String(err)}`, {
      status: 500,
    });
  }
}
