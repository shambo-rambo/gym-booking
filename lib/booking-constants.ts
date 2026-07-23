// Within this many minutes of a session, personal booking limits (session cap, daily
// limit, consecutive-day rule) are waived so the slot can be booked directly, and
// queued users get notified so the slot can be claimed or released to the public.
// No server-only dependencies here so client components can import it directly.
export const LAST_MINUTE_BYPASS_MINUTES = 60

// How long a notified queue entry has to claim a freed-up slot before it passes to
// the next person in line (or is released publicly, once within LAST_MINUTE_BYPASS_MINUTES).
export const QUEUE_CLAIM_WINDOW_MINUTES = 10
