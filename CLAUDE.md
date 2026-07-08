# Apartment Gym & Sauna Booking App

when working create a to-do list to remain on track

## Project Overview

A web-based booking system for a residential apartment building's shared gym and sauna facilities. The app manages bookings for 65 apartments with multiple residents each, enforcing fair-use rules to prevent any single user from monopolising popular timeslots.

## Tech Stack

- **Frontend**: React with Next.js
- **Database**: Choose the most appropriate option (PostgreSQL, SQLite, or Firebase) based on deployment simplicity and the app's needs
- **Authentication**: Email-based accounts with apartment association
- **Notifications**: Email + SMS via Twilio (confirmation, reminders, queue alerts)

## Design Direction

Create a clean, modern interface that feels welcoming and easy to use for residents of all ages. The primary use case is quick booking on mobile devices, so prioritise mobile-first responsive design. Use a calming, residential aesthetic rather than a commercial gym vibe. Week calendar view should be scannable at a glance.

---

## User Types

### Residents
- Self-register with email and apartment number (1-65)
- Account requires manager verification before full access
- Maximum 4 user accounts per apartment

### Managers (2 accounts)
- Pre-created admin accounts
- Full system access and override capabilities

---

## Facilities

### Gym
Contains the following equipment:
- Weights machine
- Free dumbbells
- Treadmill
- Rowing machine
- Exercise bike

### Sauna
Single sauna room, bookable as a unit.

---

## Booking Types

### Exclusive Booking
User books the entire gym OR the entire sauna. No one else can use that facility during the timeslot.

### Shared Booking
User books a specific piece of gym equipment OR shares the sauna. Other users can book different equipment or share the space during the same timeslot.

**Capacity limits:**
- Gym (shared): Maximum 2 people at once
- Sauna (shared): Maximum 2 people at once

---

## Booking Rules

### Universal Rules
- Operating hours: 5am to 10pm daily
- Booking durations: 30 minutes or 1 hour
- Booking window: Up to 1 week in advance
- Cancellation: Allowed up to 5 minutes before start time

### Maximum Active Bookings (per user)
- Exclusive gym bookings: 3
- Exclusive sauna bookings: 3
- Shared equipment bookings: 5

### Anti-Hoarding Rules

These rules prevent users from locking in the same convenient timeslot repeatedly.

**For Exclusive Bookings (whole gym or whole sauna):**
1. Cannot book the same timeslot on consecutive days. Example: If you book 6pm Monday, you cannot book 6pm Tuesday.
2. The same timeslot for next week only becomes visible/available 24 hours before. Example: If it's Monday 10am, you can see next Monday's 10am slot, but you cannot book it until Sunday 10am.

**For Shared Bookings (equipment-level or shared sauna):**
1. Can book the same timeslot on consecutive days (no restriction)
2. Maximum 3 bookings of the same timeslot per week. Example: You can book the treadmill at 7am on Monday, Wednesday, and Friday, but not also on Tuesday.

---

## Queue System

When a timeslot is fully booked, users can join a queue.

**How it works:**
1. User clicks "Join Queue" on a booked slot
2. If someone cancels, the first person in queue receives an email alert
3. The queued user has a reasonable window to claim the slot (e.g., 30 minutes) before it goes to the next person or becomes publicly available
4. Current booking holder can see how many people are queued (e.g., "2 people waiting")
5. If a holder has people queued and their booking is approaching, send a gentle reminder: "Your 6pm gym booking is in 2 hours. 2 people are waiting - if you can't make it, please release your slot."

---

## Notifications (Email + SMS)

Users can choose their notification preference: email only, SMS only, or both. SMS sent via Twilio.

### User Preferences
- During registration or in settings, user selects notification preference
- Phone number required if SMS is enabled
- Phone number format: Australian mobile (+61)

### Booking Confirmation
Sent immediately when a booking is made. Include: facility, date, time, duration.

### Booking Reminder
Sent before the booking (suggest 1 hour before, or 2 hours if there's a queue). If people are queued, include: "X people are waiting for this slot."

### Cancellation Alert (for queued users)
When a slot opens up: "A 6pm Gym slot just became available! Claim it now." — SMS is ideal here for urgency.

### Queue Position Updates
Optional: notify when you move up in the queue.

### SMS Content Guidelines
Keep SMS messages short (under 160 characters to avoid splitting). Example:
- "Gym booked: Tomorrow 6pm, 1hr. Manage: [link]"
- "Slot available! 6pm Gym is free. Claim now: [link]"

---

## Calendar Interface

### Week View (Default)
- Display Monday to Sunday
- Show all timeslots from 5am to 10pm
- Each slot shows availability status at a glance:
  - Available (can book)
  - Partially booked (shared slots remaining)
  - Fully booked (can join queue)
  - Your booking (highlighted differently)
- Toggle between Gym and Sauna views
- For gym: option to filter by equipment type

### Day View (Click into from week)
- Detailed view of a single day
- See all timeslots with more detail
- For shared bookings: see which equipment is available
- Book, cancel, or join queue from this view

### Privacy
- Other users see only "Available" or "Booked"
- Users do NOT see which apartment booked a slot
- Managers CAN see booking details

---

## Manager Features

### Account Management
- View all registered accounts
- Verify new accounts (approve/reject)
- Deactivate accounts
- See which apartment each user belongs to

### Booking Management
- View all bookings (with user/apartment details)
- Cancel any booking (with optional notification to user)
- Override booking rules when necessary (e.g., special circumstances)

### Facility Management
- Block out timeslots for maintenance/cleaning
- Set blocked slots as one-off or recurring
- Add a reason that displays to users (e.g., "Sauna maintenance")

### Announcements
- Post building-wide announcements (e.g., "Gym closed Thursday 2-4pm for cleaning")
- Announcements display prominently in the app
- Option to send announcement as email to all users

---

## User Registration Flow

1. User visits app and clicks "Register"
2. User enters: email, password, apartment number (1-65), name
3. Account created in "pending" status
4. Manager receives notification of new registration
5. Manager verifies (checks if person actually lives there)
6. User receives email confirmation when verified
7. User can now log in and make bookings

**Validation:**
- Apartment number must be 1-65
- Check if apartment already has 4 verified users (if so, reject or waitlist)

---

## Database Considerations

### Key Entities
- Users (id, email, name, phone_number, apartment_number, role, status, notification_preference, created_at)
- Bookings (id, user_id, facility_type, equipment_type, date, start_time, duration, booking_type, created_at)
- Queue entries (id, user_id, timeslot reference, position, created_at)
- Blocked slots (id, facility, date, start_time, duration, reason, recurring, created_by)
- Announcements (id, title, message, created_by, created_at, expires_at)

### Important Queries to Optimise
- Get all bookings for a facility on a given day
- Check if user has hit booking limits
- Check anti-hoarding rule violations
- Get queue for a specific timeslot

---

## Edge Cases to Handle

1. **User tries to book a slot that violates anti-hoarding rules**: Show clear error message explaining why (e.g., "You booked this timeslot yesterday. Try a different time.")

2. **Two users try to book the last shared slot simultaneously**: Handle race condition gracefully. One succeeds, one gets offered the queue.

3. **User in queue doesn't claim slot in time**: Automatically offer to next in queue, or release to public.

4. **Manager blocks a slot that has existing bookings**: Warn manager, give option to notify and cancel affected bookings.

5. **Apartment reaches 4-user limit**: New registrations for that apartment go to pending/waitlist, manager notified.

6. **Booking spans across midnight**: Not applicable - operating hours are 5am-10pm, so this won't happen.

7. **User tries to cancel with less than 5 minutes notice**: Allow it (the 5-minute rule is a minimum, not a restriction).

---

## Twilio SMS Integration

Use Twilio (https://www.twilio.com) for SMS notifications.

### Setup Requirements
- Twilio Account SID
- Twilio Auth Token
- Twilio phone number (Australian or with AU sending capability)

### Implementation Notes
- Store credentials in environment variables (never commit to code)
- Use Twilio's Node.js SDK
- Implement rate limiting to avoid excessive SMS costs
- Log all SMS sends for debugging/cost tracking

### Cost Awareness
SMS costs money per message. Consider:
- Default new users to email-only, let them opt into SMS
- Queue alerts via SMS are high-value (time-sensitive), reminders less so
- Managers may want a monthly SMS usage report

---

## Out of Scope (Do Not Build)

- Mobile native app (web responsive is sufficient)
- Payment processing
- No-show tracking or penalties
- Equipment usage tracking/sensors
- Social features (chat, comments)

---

## Success Criteria

The app is successful when:
1. Residents can easily book gym/sauna slots on their phone in under 30 seconds
2. The anti-hoarding rules work invisibly - users just see what's available to them
3. Managers can handle all admin tasks without touching the database
4. The queue system reduces frustration when popular slots are taken
5. Email notifications keep users informed without being spammy
