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
  // The action actually applied — may be capped below what Gemini itself
  // suggested when confidence was low (see flaggedForReview).
  accountAction: AccountAction
  suspensionDays: number | null
  confidence: number
  rationale: string
  // True when confidence fell below the threshold and accountAction was
  // capped to "warn" rather than whatever severity Gemini suggested. There's
  // no moderator dashboard to route this to yet — it's stored on the report
  // doc and logged server-side for now.
  flaggedForReview: boolean
  resolvedAt: string | null
}

export interface CreateReportResult {
  reportId: string
  status: 'pending' | 'actioned' | 'dismissed' | 'error'
  decision: ModerationDecision | null
}
