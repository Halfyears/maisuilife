-- ============================================================
-- 麦穗喜乐 — 002 Row Level Security Policies
-- ============================================================

-- ──────────────────────────────────────────────
-- users
-- ──────────────────────────────────────────────
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Anyone can read their own profile
CREATE POLICY "users: self read"
  ON public.users FOR SELECT
  USING (auth.uid() = id);

-- Self-update only
CREATE POLICY "users: self update"
  ON public.users FOR UPDATE
  USING (auth.uid() = id);

-- Leaders can read members in their fellowships (for pastoral view)
CREATE POLICY "users: leader reads members"
  ON public.users FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.fellowship_members fm
      JOIN public.fellowships f ON f.id = fm.fellowship_id
      WHERE fm.user_id = public.users.id
        AND f.leader_id = auth.uid()
    )
  );

-- ──────────────────────────────────────────────
-- fellowships
-- ──────────────────────────────────────────────
ALTER TABLE public.fellowships ENABLE ROW LEVEL SECURITY;

-- Members and leaders can read their own fellowship
CREATE POLICY "fellowships: member read"
  ON public.fellowships FOR SELECT
  USING (
    leader_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.fellowship_members
      WHERE fellowship_id = public.fellowships.id AND user_id = auth.uid()
    )
  );

-- Only leaders can create/update
CREATE POLICY "fellowships: leader insert"
  ON public.fellowships FOR INSERT
  WITH CHECK (leader_id = auth.uid());

CREATE POLICY "fellowships: leader update"
  ON public.fellowships FOR UPDATE
  USING (leader_id = auth.uid());

-- ──────────────────────────────────────────────
-- fellowship_members
-- ──────────────────────────────────────────────
ALTER TABLE public.fellowship_members ENABLE ROW LEVEL SECURITY;

-- Member sees only their own rows; leader sees all rows in their fellowship
CREATE POLICY "fellowship_members: self or leader read"
  ON public.fellowship_members FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.fellowships
      WHERE id = fellowship_id AND leader_id = auth.uid()
    )
  );

-- Users join by invite code (handled via RPC, but INSERT must be self)
CREATE POLICY "fellowship_members: self insert"
  ON public.fellowship_members FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Leaders can update layer2_label
CREATE POLICY "fellowship_members: leader update label"
  ON public.fellowship_members FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.fellowships
      WHERE id = fellowship_id AND leader_id = auth.uid()
    )
  );

-- ──────────────────────────────────────────────
-- daily_alignments
-- ──────────────────────────────────────────────
ALTER TABLE public.daily_alignments ENABLE ROW LEVEL SECURITY;

-- Owner reads their own (all time)
CREATE POLICY "daily_alignments: self read"
  ON public.daily_alignments FOR SELECT
  USING (user_id = auth.uid());

-- Owner writes their own
CREATE POLICY "daily_alignments: self insert"
  ON public.daily_alignments FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "daily_alignments: self update"
  ON public.daily_alignments FOR UPDATE
  USING (user_id = auth.uid());

-- Leader reads ONLY visible records of their fellowship members
-- (after midnight purge, is_visible=FALSE rows become invisible to leaders)
CREATE POLICY "daily_alignments: leader reads visible"
  ON public.daily_alignments FOR SELECT
  USING (
    is_visible = TRUE
    AND EXISTS (
      SELECT 1 FROM public.fellowship_members fm
      JOIN public.fellowships f ON f.id = fm.fellowship_id
      WHERE fm.user_id = public.daily_alignments.user_id
        AND f.leader_id = auth.uid()
    )
  );

-- ──────────────────────────────────────────────
-- journeys
-- ──────────────────────────────────────────────
ALTER TABLE public.journeys ENABLE ROW LEVEL SECURITY;

-- Strictly private — owner only
CREATE POLICY "journeys: self read"
  ON public.journeys FOR SELECT
  USING (user_id = auth.uid() AND expires_at > NOW());

CREATE POLICY "journeys: self insert"
  ON public.journeys FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "journeys: self delete"
  ON public.journeys FOR DELETE
  USING (user_id = auth.uid());
