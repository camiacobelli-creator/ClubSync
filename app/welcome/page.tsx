import Link from "next/link";

export const metadata = {
  title: "ClubSync — Scheduling for club sports",
};

export default function WelcomePage() {
  return (
    <div className="space-y-24 pb-16">
      {/* ============ HERO ============ */}
      <section className="pt-8 sm:pt-16 grid lg:grid-cols-2 gap-12 items-center">
        <div>
          <p className="text-xs uppercase tracking-widest text-faceoff-blue font-mono mb-4">
            Built for club sports · starting with ACC club hockey
          </p>
          <h1 className="font-display text-4xl sm:text-5xl font-semibold leading-tight">
            Stop scheduling games over email.
          </h1>
          <p className="text-ice-dim text-lg mt-5 max-w-lg">
            ClubSync is where club sports teams post their open weekends, request games
            against other teams, and message each other — all in one shared place your
            whole staff can see. No more two people from the same team emailing the same
            contact without knowing it.
          </p>
          <div className="flex flex-wrap items-center gap-3 mt-8">
            <Link
              href="/signup"
              className="px-6 py-3 text-sm font-medium rounded-md bg-faceoff-blue text-ice hover:bg-faceoff-blue/90"
            >
              Sign up your team
            </Link>
            <Link
              href="/login"
              className="px-6 py-3 text-sm font-medium rounded-md border border-line-white text-ice-dim hover:text-ice hover:border-ice-dim"
            >
              Log in
            </Link>
          </div>
          <p className="text-xs text-ice-dim mt-4">Free to use. Takes about two minutes to set up.</p>
        </div>

        <RinkHero />
      </section>

      {/* ============ THE PROBLEM ============ */}
      <section className="grid lg:grid-cols-2 gap-12 items-center">
        <EmailChaosGraphic />
        <div>
          <p className="text-xs uppercase tracking-widest text-board-red font-mono mb-3">
            You know this problem
          </p>
          <h2 className="font-display text-3xl font-semibold">
            Somewhere in a Gmail thread, your season is being planned.
          </h2>
          <p className="text-ice-dim mt-4">
            Your president emails a team. Your coach, not knowing, emails the same team
            separately. Replies get buried. Nobody&apos;s sure which weekends are actually still
            open, or who already said yes to what. It&apos;s slow, it&apos;s easy to lose track of, and
            it&apos;s the same broken process every club team is stuck with.
          </p>
        </div>
      </section>

      {/* ============ HOW IT WORKS ============ */}
      <section>
        <div className="text-center max-w-xl mx-auto mb-12">
          <p className="text-xs uppercase tracking-widest text-faceoff-blue font-mono mb-3">
            How it works
          </p>
          <h2 className="font-display text-3xl font-semibold">Three steps, one shared board.</h2>
        </div>
        <div className="grid sm:grid-cols-3 gap-6">
          <HowItWorksStep
            n="01"
            title="Post your open weekends"
            body="Mark which weekends you're free, and whether you'd rather host or travel. Mark the rest busy."
            icon={<CalendarIcon />}
          />
          <HowItWorksStep
            n="02"
            title="Request or get requested"
            body="Browse other teams, click an open weekend, send a request. They confirm — it locks onto both schedules automatically."
            icon={<CheckIcon />}
          />
          <HowItWorksStep
            n="03"
            title="Message as one team"
            body="One shared thread per matchup, visible to everyone with access on both sides. No more parallel conversations."
            icon={<ChatIcon />}
          />
        </div>
      </section>

      {/* ============ WHO IT'S FOR ============ */}
      <section className="grid sm:grid-cols-2 gap-6">
        <div className="rounded-xl border border-line-white bg-rink-2/40 p-8">
          <p className="text-xs uppercase tracking-widest text-faceoff-blue font-mono mb-3">
            Team officers
          </p>
          <h3 className="font-display text-2xl font-semibold">
            Presidents, coaches, VPs, treasurers.
          </h3>
          <p className="text-ice-dim mt-3">
            Whoever runs the club&apos;s day-to-day. Create your team once, add your staff, and
            everyone with access sees the same schedule, requests, and messages — no more
            forwarding emails around.
          </p>
        </div>
        <div className="rounded-xl border border-line-white bg-rink-2/40 p-8">
          <p className="text-xs uppercase tracking-widest text-board-red font-mono mb-3">
            League commissioners
          </p>
          <h3 className="font-display text-2xl font-semibold">
            See every confirmed game, league-wide.
          </h3>
          <p className="text-ice-dim mt-3">
            One view of every game every team has locked in — no more chasing down
            individual teams to piece together the season.
          </p>
        </div>
      </section>

      {/* ============ FINAL CTA ============ */}
      <section className="rounded-2xl border border-faceoff-blue/40 bg-faceoff-blue/5 px-6 sm:px-12 py-14 text-center">
        <h2 className="font-display text-3xl font-semibold">Get your team on ClubSync.</h2>
        <p className="text-ice-dim mt-3 max-w-md mx-auto">
          Free, and set up in a couple minutes — pick your school, invite your staff, and post
          your first open weekend.
        </p>
        <div className="flex items-center justify-center gap-3 mt-8">
          <Link
            href="/signup"
            className="px-6 py-3 text-sm font-medium rounded-md bg-faceoff-blue text-ice hover:bg-faceoff-blue/90"
          >
            Sign up your team
          </Link>
          <Link
            href="/login"
            className="px-6 py-3 text-sm font-medium text-ice-dim hover:text-ice"
          >
            Already have an account? Log in →
          </Link>
        </div>
      </section>
    </div>
  );
}

function HowItWorksStep({
  n,
  title,
  body,
  icon,
}: {
  n: string;
  title: string;
  body: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-line-white bg-rink-2/40 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="w-9 h-9 rounded-md bg-faceoff-blue/15 text-faceoff-blue flex items-center justify-center">
          {icon}
        </div>
        <span className="font-mono text-xs text-ice-dim/60">{n}</span>
      </div>
      <h3 className="font-display text-lg font-semibold">{title}</h3>
      <p className="text-sm text-ice-dim mt-2">{body}</p>
    </div>
  );
}

function CalendarIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" strokeLinecap="round" />
      <circle cx="12" cy="15" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20 7L10 18l-6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path
        d="M4 5h16v11H8l-4 4V5z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function RinkHero() {
  return (
    <div className="relative w-full aspect-[4/3] max-w-lg mx-auto">
      <svg viewBox="0 0 480 360" className="w-full h-full">
        <defs>
          <clipPath id="rinkClip">
            <rect x="10" y="10" width="460" height="340" rx="60" />
          </clipPath>
        </defs>
        <rect
          x="10"
          y="10"
          width="460"
          height="340"
          rx="60"
          fill="none"
          stroke="#2E7DD7"
          strokeOpacity="0.35"
          strokeWidth="3"
        />
        <g clipPath="url(#rinkClip)">
          <line x1="240" y1="10" x2="240" y2="350" stroke="#C8102E" strokeOpacity="0.3" strokeWidth="3" />
          <line x1="150" y1="10" x2="150" y2="350" stroke="#2E7DD7" strokeOpacity="0.2" strokeWidth="2" />
          <line x1="330" y1="10" x2="330" y2="350" stroke="#2E7DD7" strokeOpacity="0.2" strokeWidth="2" />
          <circle cx="240" cy="180" r="55" fill="none" stroke="#2E7DD7" strokeOpacity="0.3" strokeWidth="2" />
          <circle cx="240" cy="180" r="3" fill="#2E7DD7" fillOpacity="0.5" />
          <circle cx="90" cy="95" r="38" fill="none" stroke="#C8102E" strokeOpacity="0.2" strokeWidth="2" />
          <circle cx="90" cy="265" r="38" fill="none" stroke="#C8102E" strokeOpacity="0.2" strokeWidth="2" />
          <circle cx="390" cy="95" r="38" fill="none" stroke="#C8102E" strokeOpacity="0.2" strokeWidth="2" />
          <circle cx="390" cy="265" r="38" fill="none" stroke="#C8102E" strokeOpacity="0.2" strokeWidth="2" />
        </g>

        {/* floating schedule cards, echoing the real product UI */}
        <g>
          <rect x="30" y="40" width="110" height="56" rx="8" fill="#122A44" stroke="#2E7DD7" strokeOpacity="0.5" />
          <circle cx="48" cy="58" r="5" fill="none" stroke="#2E7DD7" strokeWidth="1.5" />
          <circle cx="48" cy="58" r="2" fill="#2E7DD7" />
          <text x="62" y="62" fill="#F2F7FA" fontSize="11" fontFamily="monospace">Sep 26</text>
          <text x="48" y="80" fill="#B9C6D4" fontSize="9" fontFamily="monospace">Open · Home</text>
        </g>

        <g>
          <rect x="340" y="230" width="112" height="58" rx="8" fill="#122A44" stroke="#C8102E" strokeOpacity="0.5" />
          <text x="354" y="252" fill="#F2F7FA" fontSize="11" fontFamily="monospace">vs Tennessee</text>
          <text x="354" y="270" fill="#B9C6D4" fontSize="9" fontFamily="monospace">7:00 PM · Home</text>
        </g>

        <g>
          <rect x="300" y="30" width="100" height="50" rx="8" fill="#122A44" stroke="#2E7DD7" strokeOpacity="0.5" />
          <circle cx="317" cy="47" r="5" fill="none" stroke="#2E7DD7" strokeWidth="1.5" />
          <circle cx="317" cy="47" r="2" fill="#2E7DD7" />
          <text x="330" y="51" fill="#F2F7FA" fontSize="11" fontFamily="monospace">Oct 3</text>
          <text x="317" y="68" fill="#B9C6D4" fontSize="9" fontFamily="monospace">Open · Away</text>
        </g>
      </svg>
    </div>
  );
}

function EmailChaosGraphic() {
  return (
    <div className="relative w-full aspect-square max-w-sm mx-auto">
      <svg viewBox="0 0 320 320" className="w-full h-full">
        {[
          { x: 20, y: 40, r: -6, w: 200, subject: "Re: Re: game this weekend?" },
          { x: 60, y: 90, r: 4, w: 210, subject: "Re: scheduling — did you see this?" },
          { x: 10, y: 145, r: -3, w: 205, subject: "Fwd: Re: Fwd: open weekends" },
          { x: 70, y: 200, r: 5, w: 200, subject: "Re: Re: Re: any update?" },
          { x: 30, y: 250, r: -5, w: 210, subject: "Sorry, missed this — resending" },
        ].map((card, i) => (
          <g key={i} transform={`translate(${card.x} ${card.y}) rotate(${card.r})`}>
            <rect
              width={card.w}
              height="52"
              rx="6"
              fill="#122A44"
              stroke="#6B7C8F"
              strokeOpacity="0.4"
            />
            <circle cx="18" cy="18" r="7" fill="none" stroke="#C8102E" strokeOpacity="0.6" strokeWidth="1.5" />
            <path d="M13 18l4 4l7-8" stroke="#C8102E" strokeOpacity="0.6" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            <text x="34" y="16" fill="#F2F7FA" fontSize="9" fontFamily="monospace" opacity="0.85">
              {card.subject}
            </text>
            <rect x="34" y="26" width={card.w - 60} height="4" rx="2" fill="#6B7C8F" opacity="0.3" />
            <rect x="34" y="34" width={card.w - 100} height="4" rx="2" fill="#6B7C8F" opacity="0.25" />
          </g>
        ))}
      </svg>
    </div>
  );
}
