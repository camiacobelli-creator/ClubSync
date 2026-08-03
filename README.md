# ClubSync

A real, multi-user club hockey scheduling app. Every team gets a login,
a shared schedule, game requests, and team-to-team messaging — backed by a
real database (Supabase), so changes made by one team's staff show up for
everyone, on any device.

## What's built

- **Sign up / log in** — real accounts (email + password) via Supabase Auth
- **Onboarding** — create a new team or join an existing one, with a role (President, Coach, VP, etc.)
- **Dashboard** (`/`) — your team's schedule, staff roster, pending-request banner; add open/busy weekends
- **Browse Teams** (`/teams`) — search every team on the platform
- **Team page** (`/teams/[id]`) — see another team's open/busy weekends and preference; click an open weekend to request a game (host or travel)
- **Requests** (`/requests`) — approve (enter time/location, which writes the game onto both teams' schedules) or decline; track requests you've sent
- **Messages** (`/messages/[teamId]`) — one shared, live-updating thread per team pairing

All data lives in Supabase (Postgres), with Row Level Security so teams can
only edit their own schedule and only see messages/requests they're part of.

## One-time setup

### 1. Create the database tables

In your Supabase project: left sidebar → **SQL Editor** → **New query**.
Open `supabase/schema.sql` from this project, copy the whole file, paste it
in, and click **Run**. This creates all 5 tables and their permission rules.
You only need to do this once, ever.

### 2. Connect the app to your Supabase project

In Supabase: **Project Settings** (gear icon) → **API**. You'll need the
**Project URL** and the **anon public** key.

In this project folder, make a copy of the example env file:

```
cp .env.local.example .env.local
```

Open `.env.local` in any text editor and paste in your two values:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-public-key
```

Save the file. `.env.local` is already git-ignored — it will never get
pushed to GitHub, so it's safe to put real keys here.

## Running it locally

You'll need [Node.js](https://nodejs.org) (the "LTS" version). Check with:

```
node -v
```

Then, from inside the `clubsync` folder:

```
npm install
npm run dev
```

Open `http://localhost:3000`. Sign up, create your team, and you're in.
Open the same URL in a different browser (or incognito window) and sign up
as a second team to test the multi-team flow — requests and messages will
sync between them for real.

## Deploying so anyone can use it

1. Push this project to a GitHub repo (see prior instructions, or ask me).
2. On [vercel.com](https://vercel.com), import that repo.
3. Before clicking Deploy, open **Environment Variables** and add the same
   two values from your `.env.local`: `NEXT_PUBLIC_SUPABASE_URL` and
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
4. Click **Deploy**. You'll get a real URL any team can sign up at.

## Making changes

- **Database structure**: `supabase/schema.sql` (re-run pieces of it in the Supabase SQL Editor if you add new fields)
- **Colors, fonts**: `app/globals.css` and `app/layout.tsx`
- **Pages**: everything under `app/` — each folder is a URL route
- **Reusable UI pieces**: `components/`
- **Data types**: `lib/types.ts` — keep in sync with the database columns

## Business model (future)

Not built into the app yet: billing. When you're ready, the natural spot for
this is a `subscriptions` or `conference_licenses` table plus Stripe — happy
to scope that whenever you get there.
