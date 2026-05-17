export interface PendingFellowship {
  id:              string
  name:            string
  meeting_address: string | null
  leader_contact:  string | null
  created_at:      string
  users:           { display_name: string } | null
}

export interface ActiveFellowship {
  id:              string
  name:            string
  invite_code:     string
  meeting_address: string | null
  leader_contact:  string | null
  users:           { id: string; display_name: string } | null
  fellowship_members: { user_id: string }[]
}

export interface SelectableMember {
  id:           string
  display_name: string
  role:         string
}
