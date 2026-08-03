export type Team = {
  id: string;
  name: string;
  short_name: string;
  city: string;
  conference: string;
  color_primary: string;
  school: string | null;
  sport: string | null;
  division: "D1" | "D2" | "D3";
  invite_code: string | null;
  created_at: string;
};

export type School = { name: string; city: string | null; state: string | null };
export type Sport = { name: string };

export type Profile = {
  id: string;
  team_id: string | null;
  full_name: string;
  role: string;
  phone: string | null;
  email: string;
  is_commissioner: boolean;
  is_team_admin: boolean;
  member_type: "staff" | "player";
  created_at: string;
};

export type TeamJoinRequest = {
  id: string;
  team_id: string;
  profile_id: string;
  requested_role: string;
  requested_member_type: "staff" | "player";
  status: "pending" | "approved" | "declined";
  created_at: string;
};

export type WeekendStatus = "open" | "busy" | "scheduled";
export type Preference = "home" | "away" | "either";

export type Weekend = {
  id: string;
  team_id: string;
  date: string;
  status: WeekendStatus;
  preference: Preference | null;
  opponent_team_id: string | null;
  opponent_name: string | null;
  game_time: string | null;
  game_location: string | null;
  game_notes: string | null;
  is_home: boolean | null;
  created_at: string;
};

export type GameRequest = {
  id: string;
  from_team_id: string;
  to_team_id: string;
  weekend_id: string | null;
  source_weekend_id: string | null;
  kind: "availability" | "confirmation";
  from_wants_to_host: boolean;
  status: "pending" | "approved" | "declined";
  created_at: string;
};

export type Message = {
  id: string;
  team_a_id: string;
  team_b_id: string;
  sender_team_id: string;
  sender_profile_id: string;
  body: string;
  created_at: string;
};

export type MessageRead = {
  team_id: string;
  other_team_id: string;
  last_read_at: string;
};
