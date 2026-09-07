import { SupabaseClient } from "@supabase/supabase-js";

export function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

// Returns e.g. "Clemson Ice Hockey (2nd team)" — but only appends the
// "(Nth team)" suffix when the school actually has more than one team
// in that sport. A lone team just shows its plain name.
export async function teamDisplayName(
  supabase: SupabaseClient,
  team: { name: string; school: string | null; sport: string | null; team_number: number }
): Promise<string> {
  if (!team.school || !team.sport) return team.name;

  const { count } = await supabase
    .from("teams")
    .select("id", { count: "exact", head: true })
    .eq("school", team.school)
    .eq("sport", team.sport);

  if (!count || count <= 1) return team.name;

  return `${team.name} (${ordinal(team.team_number)} team)`;
}
