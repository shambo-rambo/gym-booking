// Read-only client for the Inner Range Inception Review API. Used by the weekly
// amenity audit (lib/amenity-audit.ts) to reconcile fob access against bookings.
//
// Safety: this module deliberately exposes only two functions and never wraps a
// generic request() helper, so nothing in the codebase can use it to issue a
// POST/PUT/PATCH/DELETE against Inception (config or otherwise) — reconciliation
// is a read-only concern.

const BASE_URL = process.env.INCEPTION_BASE_URL
const API_USERNAME = process.env.INCEPTION_API_USERNAME
const API_PASSWORD = process.env.INCEPTION_API_PASSWORD

const REVIEW_PAGE_LIMIT = 100

// "Door Access Granted for User" — see Inception REST API docs, "Monitoring specific
// Review Event types". Filtering server-side on this message type ID means we only
// ever receive successful swipes, so there's no need to guess at denial wording.
const DOOR_ACCESS_GRANTED_MESSAGE_TYPE_ID = "2006"

export interface InceptionReviewEvent {
  ID?: string
  Description?: string
  MessageCategory?: number
  When?: string
  WhenTicks?: number
  Who?: string
  WhoID?: string
  What?: string
  WhatID?: string
  Where?: string
  WhereID?: string
  [key: string]: unknown
}

let cachedSessionCookie: string | null = null

function requireConfig() {
  if (!BASE_URL || !API_USERNAME || !API_PASSWORD) {
    throw new Error(
      "Inception is not configured: set INCEPTION_BASE_URL, INCEPTION_API_USERNAME, INCEPTION_API_PASSWORD"
    )
  }
  return { baseUrl: BASE_URL, username: API_USERNAME, password: API_PASSWORD }
}

// Inception's login response carries the session ID as a "UserID" field in the JSON
// body (not a Set-Cookie header) — the caller is responsible for constructing the
// "LoginSessId=[UserID]" Cookie header on subsequent requests. Session IDs are valid
// for 10 minutes from last use.
export async function authenticate(): Promise<string> {
  const { baseUrl, username, password } = requireConfig()

  const response = await fetch(`${baseUrl}/api/v1/authentication/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ Username: username, Password: password }),
  })

  if (!response.ok) {
    throw new Error(`Inception authentication failed: ${response.status} ${response.statusText}`)
  }

  const data = await response.json()
  if (data?.Response?.Result !== "Success" || !data?.UserID) {
    throw new Error(`Inception authentication failed: ${data?.Response?.Message ?? "no session returned"}`)
  }

  cachedSessionCookie = `LoginSessId=${data.UserID}`
  return cachedSessionCookie
}

async function fetchReviewPage(
  baseUrl: string,
  start: Date,
  end: Date,
  offset: number,
  sessionCookie: string
): Promise<{ events: InceptionReviewEvent[]; count: number; status: number }> {
  const params = new URLSearchParams({
    categoryFilter: "Access",
    messageTypeIdFilter: DOOR_ACCESS_GRANTED_MESSAGE_TYPE_ID,
    start: start.toISOString(),
    end: end.toISOString(),
    limit: String(REVIEW_PAGE_LIMIT),
    offset: String(offset),
  })

  const response = await fetch(`${baseUrl}/api/v1/review?${params.toString()}`, {
    method: "GET",
    headers: { Cookie: sessionCookie },
  })

  if (response.status === 401) {
    return { events: [], count: 0, status: 401 }
  }
  if (!response.ok) {
    throw new Error(`Inception review request failed: ${response.status} ${response.statusText}`)
  }

  const data = await response.json()
  const events: InceptionReviewEvent[] = Array.isArray(data?.Data) ? data.Data : []
  const count: number = typeof data?.Count === "number" ? data.Count : events.length

  return { events, count, status: 200 }
}

// Fetches all granted door-access review events between start and end, paginating via
// offset while a page returns a full page (Count === limit). Re-authenticates once
// on a 401 mid-pagination; a second 401 is treated as a hard failure.
export async function fetchAccessReviewEvents(start: Date, end: Date): Promise<InceptionReviewEvent[]> {
  const { baseUrl } = requireConfig()

  if (!cachedSessionCookie) {
    await authenticate()
  }

  const allEvents: InceptionReviewEvent[] = []
  let offset = 0
  let retriedAuth = false

  while (true) {
    const page = await fetchReviewPage(baseUrl, start, end, offset, cachedSessionCookie!)

    if (page.status === 401) {
      if (retriedAuth) {
        throw new Error("Inception session expired and re-authentication did not resolve it")
      }
      retriedAuth = true
      await authenticate()
      continue
    }

    allEvents.push(...page.events)

    if (page.count < REVIEW_PAGE_LIMIT) {
      break
    }
    offset += REVIEW_PAGE_LIMIT
  }

  return allEvents
}
