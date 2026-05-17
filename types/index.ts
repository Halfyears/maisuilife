export type UserRole = 'member' | 'leader' | 'group_leader' | 'church_admin' | 'super_admin'

export interface SystemConfig {
  id:         string
  key:        string
  value:      Record<string, unknown>
  updated_at: string
  updated_by: string | null
}

export interface UserSettings {
  elder_mode: boolean
}

export interface User {
  id:           string
  display_name: string
  role:         UserRole
  settings:     UserSettings
  created_at:   string
  updated_at:   string
}

export interface Fellowship {
  id:              string
  name:            string
  invite_code:     string
  leader_id:       string
  status:          string
  meeting_address: string | null
  leader_contact:  string | null
  church_id:       string | null
  approved_at:     string | null
  meeting_mode:    string | null
  yt_link:         string | null
  created_at:      string
}

export interface SpiritualLog {
  id:          string
  user_id:     string
  mood:        string | null
  ai_comfort:  string | null
  bible_verse: string | null
  bible_ref:   string | null
  client_date: string
  created_at:  string
}

export interface FellowshipMember {
  fellowship_id: string
  user_id:       string
  layer2_label:  string
  joined_at:     string
}

export type StatusTag = '感恩' | '平安' | '疲惫' | '干渴' | '混乱'

export interface DailyAlignment {
  id:         string
  user_id:    string
  status_tag: StatusTag
  theme_tags: string[]
  // ai_summary_enc is never returned to client; server decrypts and returns plain text
  ai_summary?: string
  is_visible:  boolean
  is_silent:   boolean
  is_urgent:   boolean
  react_nian:  number
  react_amen:  number
  date:        string
  created_at:  string
}

export interface Journey {
  id:           string
  user_id:      string
  alignment_id: string | null
  // content_enc is never returned to client; server decrypts and returns plain text
  content?:     string
  expires_at:   string
  created_at:   string
}

export interface UrgentFlag {
  id:            string
  alignment_id:  string
  fellowship_id: string
  user_id:       string
  flagged_at:    string
}

export interface PastoralRequest {
  id:            string
  flag_id:       string
  fellowship_id: string
  member_id:     string   // never surface in API responses
  status:        'PENDING' | 'APPROVED' | 'DENIED'
  requested_at:  string
  responded_at:  string | null
}

// ── API payloads ──────────────────────────────

export interface CreateAlignmentPayload {
  status_tag:  StatusTag
  theme_tags:  string[]
  audio_blob?: Blob  // destroyed after STT; never persisted
  transcript?: string
}

export interface CreateJourneyPayload {
  alignment_id?: string
  content:       string  // encrypted by server before storage
}

// ── Supabase DB types ─────────────────────────
// Hand-maintained. Run `supabase gen types typescript` to regenerate from schema.
// The exact shape required by @supabase/supabase-js v2 + @supabase/ssr.

// DB-level row: has ai_summary_enc (BYTEA as hex string) instead of ai_summary
interface DailyAlignmentRow {
  id:             string
  user_id:        string
  status_tag:     string
  theme_tags:     string[]
  ai_summary_enc: string | null
  is_visible:     boolean
  is_silent:      boolean
  is_urgent:      boolean
  react_nian:     number
  react_amen:     number
  date:           string
  created_at:     string
}

// DB-level journey row: has content_enc, not content
interface JourneyRow {
  id:           string
  user_id:      string
  alignment_id: string | null
  content_enc:  string | null
  expires_at:   string
  created_at:   string
}

export type Database = {
  public: {
    Tables: {
      users: {
        Row:           User
        Insert:        Omit<User, 'created_at' | 'updated_at'>
        Update:        Partial<User>
        Relationships: []
      }
      fellowships: {
        Row:           Fellowship
        Insert:        Omit<Fellowship, 'id' | 'created_at' | 'invite_code'>
        Update:        Partial<Fellowship>
        Relationships: []
      }
      fellowship_members: {
        Row:           FellowshipMember
        Insert:        FellowshipMember
        Update:        Partial<FellowshipMember>
        Relationships: []
      }
      daily_alignments: {
        Row:           DailyAlignmentRow
        Insert:        Omit<DailyAlignmentRow, 'id' | 'created_at' | 'ai_summary_enc'>
        Update:        Partial<DailyAlignmentRow>
        Relationships: []
      }
      journeys: {
        Row:           JourneyRow
        Insert:        Omit<JourneyRow, 'id' | 'created_at' | 'expires_at' | 'content_enc'>
        Update:        Partial<JourneyRow>
        Relationships: []
      }
      urgent_flags: {
        Row:           UrgentFlag
        Insert:        Omit<UrgentFlag, 'id' | 'flagged_at'>
        Update:        Partial<UrgentFlag>
        Relationships: []
      }
      pastoral_requests: {
        Row:           PastoralRequest
        Insert:        Omit<PastoralRequest, 'id' | 'requested_at' | 'responded_at'>
        Update:        Partial<PastoralRequest>
        Relationships: []
      }
      system_configs: {
        Row:           SystemConfig
        Insert:        Omit<SystemConfig, 'id'>
        Update:        Partial<SystemConfig>
        Relationships: []
      }
      spiritual_logs: {
        Row:    SpiritualLog
        Insert: Omit<SpiritualLog, 'id' | 'created_at'>
        Update: Partial<SpiritualLog>
        Relationships: []
      }
    }
    Views: {
      admin_spiritual_weather: {
        Row: { status_tag: string; count: number; pct: number }
        Relationships: []
      }
      admin_cost_basis: {
        Row: { month: string; billable: number }
        Relationships: []
      }
      visible_alignments: {
        Row: DailyAlignmentRow
        Relationships: []
      }
    }
    Functions: {
      join_fellowship_by_code: {
        Args:    { p_invite_code: string }
        Returns: undefined
      }
      increment_reaction: {
        Args:    { p_alignment_id: string; p_reaction_type: string }
        Returns: undefined
      }
      flag_urgent: {
        Args:    { p_alignment_id: string; p_fellowship_id: string }
        Returns: undefined
      }
    }
    Enums:          Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
