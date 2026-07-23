import { Clock, Calendar, Users, Ban, ListOrdered, AlertCircle, Zap } from "lucide-react"
import { LAST_MINUTE_BYPASS_MINUTES, QUEUE_CLAIM_WINDOW_MINUTES } from "@/lib/booking-constants"

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-outline-variant/20 p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
          {icon}
        </div>
        <h3 className="text-base font-bold text-primary">{title}</h3>
      </div>
      {children}
    </div>
  )
}

function Rule({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2 text-sm text-on-surface-variant">
      <span className="w-1.5 h-1.5 rounded-full bg-secondary mt-2 flex-shrink-0" />
      <span>{children}</span>
    </li>
  )
}

function Limit({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-outline-variant/20 last:border-0">
      <span className="text-sm text-on-surface-variant">{label}</span>
      <span className="text-sm font-bold text-primary">{value}</span>
    </div>
  )
}

export function BookingRules() {
  return (
    <div className="space-y-4">

      {/* Hours */}
      <Section icon={<Clock className="w-5 h-5" />} title="Hours & Booking Window">
        <ul className="space-y-2">
          <Rule>Facilities open <strong>6:00 AM – 11:00 PM</strong> every day</Rule>
          <Rule>Book up to <strong>7 days in advance</strong></Rule>
          <Rule>Sessions are <strong>30 or 60 minutes</strong> — 60-minute sessions must start <strong>on the hour</strong></Rule>
          <Rule><strong className="text-orange-600">Peak hours (3:00 – 9:00 PM)</strong> are highlighted in orange on the calendar — a Shared, 30-minute session is suggested so more residents get a turn, but it's not required</Rule>
          <Rule>The current hour's slot stays bookable <strong>for the whole hour</strong> — e.g. the 3:00 slot can still be booked at 3:45 if no one's taken it</Rule>
        </ul>
      </Section>

      {/* Personal limits */}
      <Section icon={<AlertCircle className="w-5 h-5" />} title="Your Personal Limits">
        <p className="text-xs text-on-surface-variant mb-3">
          These limits apply separately to Gym and Sauna. Slots where you've hit a limit show as <strong>Limit reached</strong> — you can still click them to join the waitlist.
        </p>
        <div className="bg-surface-container-low rounded-lg px-4 mb-3">
          <Limit label="Upcoming sessions" value="Max 3 per facility" />
          <Limit label="Time per day" value="Max 1 hour per facility" />
          <Limit label="Consecutive days" value="Same start time 2 days in a row — not allowed" />
        </div>
        <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3">
          <Zap className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700">
            <strong>Within {LAST_MINUTE_BYPASS_MINUTES} minutes of a session</strong>, the upcoming-sessions and consecutive-day limits are waived — you can book directly even if you'd normally be blocked. The <strong>1-hour-per-day limit still always applies</strong>, so it can't be used to stack extra time onto an already-maxed-out day.
          </p>
        </div>
      </Section>

      {/* Facilities */}
      <Section icon={<Users className="w-5 h-5" />} title="Shared vs Private vs Exclusive">
        <div className="space-y-3">
          <div className="rounded-lg bg-surface-container-low p-4">
            <p className="text-sm font-semibold text-primary mb-1">Shared Gym</p>
            <ul className="space-y-1.5">
              <Rule>Max <strong>2 people</strong> at the same time</Rule>
              <Rule>Select which equipment you'll use — up to <strong>3 items</strong> per session</Rule>
              <Rule>Each piece of equipment can only be held by <strong>one person at a time</strong> — once someone's booked it, it shows as Taken, not joinable</Rule>
            </ul>
          </div>
          <div className="rounded-lg bg-surface-container-low p-4">
            <p className="text-sm font-semibold text-primary mb-1">Shared Sauna</p>
            <ul className="space-y-1.5">
              <Rule>Max <strong>2 people</strong> at the same time, genuinely sharing the room</Rule>
            </ul>
          </div>
          <div className="rounded-lg bg-surface-container-low p-4">
            <p className="text-sm font-semibold text-primary mb-1">Private</p>
            <ul className="space-y-1.5">
              <Rule>Blocks the whole Gym <strong>or</strong> whole Sauna — your choice — for you only</Rule>
              <Rule>The other facility stays bookable by other residents</Rule>
              <Rule>Not available if any shared bookings already overlap the time window</Rule>
            </ul>
          </div>
          <div className="rounded-lg bg-surface-container-low p-4">
            <p className="text-sm font-semibold text-primary mb-1">Exclusive</p>
            <ul className="space-y-1.5">
              <Rule>Blocks the whole Gym <strong>and</strong> Sauna together, as one linked booking — no one else can use either</Rule>
            </ul>
          </div>
        </div>
      </Section>

      {/* Cancellations */}
      <Section icon={<Ban className="w-5 h-5" />} title="Cancellations">
        <ul className="space-y-2">
          <Rule>You can cancel any time up to <strong>30 minutes before</strong> the start time</Rule>
          <Rule>Cancellations are <strong>not allowed</strong> within 30 minutes of start</Rule>
          <Rule>When you cancel, the first person in the queue is automatically notified</Rule>
        </ul>
      </Section>

      {/* Queue */}
      <Section icon={<ListOrdered className="w-5 h-5" />} title="Queue & Waitlist">
        <p className="text-xs text-on-surface-variant mb-3">
          You can join the queue when a slot is full, or when you've hit your personal limits and the session is more than {LAST_MINUTE_BYPASS_MINUTES} minutes away.
        </p>
        <ol className="space-y-2 mb-3">
          {[
            "When someone cancels, the first person in the queue is notified",
            `You have ${QUEUE_CLAIM_WINDOW_MINUTES} minutes to claim the slot before the next person is notified`,
            "Users not blocked by personal limits are prioritised over limit-blocked users",
            `If a slot is still open within ${LAST_MINUTE_BYPASS_MINUTES} minutes of the session, it's automatically offered to the first person in the queue`,
          ].map((step, i) => (
            <li key={i} className="flex items-start gap-3 text-sm text-on-surface-variant">
              <span className="w-5 h-5 rounded-full bg-secondary/20 text-secondary font-bold text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                {i + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
        <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3">
          <Zap className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700">
            <strong>Within {LAST_MINUTE_BYPASS_MINUTES} minutes</strong>, the {QUEUE_CLAIM_WINDOW_MINUTES}-minute claim window is waived, along with the upcoming-sessions and consecutive-day limits — you can claim directly even if you're normally limit-blocked. The 1-hour-per-day limit still always applies.
          </p>
        </div>
      </Section>

      {/* Registration */}
      <Section icon={<Calendar className="w-5 h-5" />} title="Account & Registration">
        <ul className="space-y-2">
          <Rule>A valid <strong>building code</strong> is required to register</Rule>
          <Rule>Every new account still needs <strong>manager approval</strong> before you can log in and book — even with a correct code</Rule>
          <Rule>Maximum <strong>6 residents</strong> per apartment unit</Rule>
        </ul>
      </Section>

    </div>
  )
}
