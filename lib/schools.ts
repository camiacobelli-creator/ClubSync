import { SupabaseClient } from "@supabase/supabase-js";
import { School } from "@/lib/types";

/**
 * Supabase/PostgREST caps any single select() at 1000 rows by default.
 * Since the schools list is larger than that, a plain
 * `.from("schools").select("*")` silently truncates (alphabetically,
 * since we order by name) and cuts off partway through the alphabet.
 * This pages through in batches of 1000 until everything is fetched.
 */
export async function fetchAllSchools(
  supabase: SupabaseClient
): Promise<School[]> {
  const pageSize = 1000;
  let from = 0;
  let all: School[] = [];

  while (true) {
    const { data, error } = await supabase
      .from("schools")
      .select("*")
      .order("name")
      .range(from, from + pageSize - 1);

    if (error) throw error;
    if (!data || data.length === 0) break;

    all = all.concat(data as School[]);

    if (data.length < pageSize) break; // last page
    from += pageSize;
  }

  return all;
}
