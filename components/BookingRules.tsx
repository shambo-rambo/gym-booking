import { Clock, Calendar, Users, Ban, ListOrdered, AlertCircle, Zap } from "lucide-react"

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
          <Rule>Sessions are <strong>30 or 60 minutes</strong></Rule>
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
            <strong>Within 3 hours of a session</strong>, all personal limits are waived — you can book directly even if you'd normally be blocked.
          </p>
        </div>
      </Section>

      {/* Facilities */}
      <Section icon={<Users className="w-5 h-5" />} title="Shared vs Private">
        <div className="space-y-3">
          <div className="rounded-lg bg-surface-container-low p-4">
            <p className="text-sm font-semibold text-primary mb-1">Shared Gym</p>
            <ul className="space-y-1.5">
              <Rule>Max <strong>2 people</strong> at the same time</Rule>
              <Rule>Select which equipment you'll use — up to <strong>3 items</strong> per session</Rule>
            </ul>
          </div>
          <div className="rounded-lg bg-surface-container-low p-4">
            <p className="text-sm font-semibold text-primary mb-1">Shared Sauna</p>
            <ul className="space-y-1.5">
              <Rule>Max <strong>2 people</strong> at the same time</Rule>
            </ul>
          </div>
          <div className="rounded-lg bg-surface-container-low p-4">
            <p className="text-sm font-semibold text-primary mb-1">Private (Exclusive)</p>
            <ul className="space-y-1.5">
              <Rule>Blocks the entire facility for your session — no one else can book that slot</Rule>
              <Rule>Not available if any shared bookings already overlap the time window</Rule>
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
          You can join the queue when a slot is full, or when you've hit your personal limits and the session is more than 3 hours away.
        </p>
        <ol className="space-y-2 mb-3">
          {[
            "When someone cancels, the first person in the queue is notified by email",
            "You have 30 minutes to claim the slot before the next person is notified",
            "Users not blocked by personal limits are prioritised over limit-blocked users",
            "If a slot is still open within 3 hours of the session, it's automatically offered to the first person in the queue",
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
            <strong>Within 3 hours</strong>, the 30-minute claim window is waived and personal limits don't apply — you can claim directly even if you're normally limit-blocked.
          </p>
        </div>
      </Section>

      {/* Registration */}
      <Section icon={<Calendar className="w-5 h-5" />} title="Account & Registration">
        <ul className="space-y-2">
          <Rule>Register with your <strong>building code</strong> to get verified immediately</Rule>
          <Rule>Without a building code your account is <strong>pending manager approval</strong></Rule>
          <Rule>Maximum <strong>6 residents</strong> per apartment unit</Rule>
        </ul>
      </Section>

    </div>
  )
}
