// Wire shapes for Reports (PRD §30.3 "report functionality", §30.8's
// AI-assisted moderation). POST /reports is the only endpoint — there's no
// human moderation queue in this codebase to list/review reports through;
// Gemini's decision applies immediately and is returned in the same response.

export type ReportTargetType = 'message' | 'review' | 'user' | 'event'

export type ModerationCategory =
  | 'sexual-solicitation'
  | 'harassment'
  | 'private-content-sharing'
  | 'grooming'
  | 'spam-or-scam'
  | 'legitimate-discussion'
  | 'other'

export type ContentAction = 'none' | 'remove'

export type AccountAction = 'none' | 'warn' | 'restrict' | 'suspend_temporary' | 'suspend_permanent'

export interface ModerationDecision {
  violates: boolean
  category: ModerationCategory
  contentAction: ContentAction
  accountAction: AccountAction
  suspensionDays: number | null
  confidence: number
  rationale: string
  resolvedAt: string | null
}

export interface CreateReportResult {
  reportId: string
  status: 'pending' | 'actioned' | 'dismissed' | 'error'
  decision: ModerationDecision | null
}
