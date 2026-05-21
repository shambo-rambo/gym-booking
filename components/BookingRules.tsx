import { Clock, Calendar, Users, Dumbbell, Ban, ListOrdered, AlertCircle } from "lucide-react"

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
          <Rule>Facilities open <strong>5:00 AM – 11:00 PM</strong> every day</Rule>
          <Rule>Book up to <strong>7 days in advance</strong></Rule>
          <Rule>Sessions are <strong>30 or 60 minutes</strong></Rule>
        </ul>
      </Section>

      {/* Personal limits */}
      <Section icon={<AlertCircle className="w-5 h-5" />} title="Your Personal Limits">
        <p className="text-xs text-on-surface-variant mb-3">
          These limits apply separately to Gym and Sauna. Hitting any limit shows the slot as <strong>Limit reached</strong> — you can still click it to join the waitlist.
        </p>
        <div className="bg-surface-container-low rounded-lg px-4">
          <Limit label="Upcoming sessions" value="Max 3 per facility" />
          <Limit label="Time per day" value="Max 1 hour per facility" />
          <Limit label="Consecutive days" value="Same start time 2 days in a row — not allowed" />
        </div>
      </Section>

      {/* Facilities */}
      <Section icon={<Users className="w-5 h-5" />} title="Shared vs Private">
        <div className="space-y-3">
          <div className="rounded-lg bg-surface-container-low p-4">
            <p className="text-sm font-semibold text-primary mb-1">Shared Gym</p>
            <ul className="space-y-1.5">
              <Rule>Max <strong>2 people</strong> at the same time</Rule>
              <Rule>Select which equipment you'll use (up to 3 items)</Rule>
              <Rule>Each piece of equipment can only be booked by one person per slot</Rule>
              <Rule>Need more than 3 pieces? Book a <strong>Private Gym</strong> session instead</Rule>
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
          <Rule>Cancellations are <strong>not allowed</strong> within 30 minutes of start or once the session has begun</Rule>
          <Rule>When you cancel, the first person in the queue is automatically notified</Rule>
        </ul>
      </Section>

      {/* Queue */}
      <Section icon={<ListOrdered className="w-5 h-5" />} title="Queue & Waitlist">
        <p className="text-xs text-on-surface-variant mb-3">
          Join the queue when a slot is fully booked, or join the waitlist when you've hit your personal limits.
        </p>
        <ol className="space-y-2">
          {[
            "When someone cancels, the first person in the queue is notified by email",
            "You have 30 minutes to claim the slot",
            "If you don't claim it, the next person is notified",
            "People who are free to book (not limit-blocked) are prioritised over waitlisted users",
            "If a slot is still open 3 hours before the session, it's automatically released to the first person in the queue",
          ].map((step, i) => (
            <li key={i} className="flex items-start gap-3 text-sm text-on-surface-variant">
              <span className="w-5 h-5 rounded-full bg-secondary/20 text-secondary font-bold text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                {i + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
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
