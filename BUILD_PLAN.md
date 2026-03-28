# Gym & Sauna Booking System - Technical Build Plan

**Last Updated:** 2026-01-13
**Purpose:** Complete technical specification with zero ambiguity. Follow this to build the entire system.

---

## 1. Final Tech Stack

```
Frontend:     Next.js 14 (App Router) + React 18 + TypeScript 5
Database:     PostgreSQL (via Neon)
ORM:          Prisma 5
Auth:         NextAuth.js v5 (credentials provider)
Styling:      Tailwind CSS + shadcn/ui
Email:        Resend
SMS:          Twilio
Hosting:      Vercel
```

**Rationale:**
- Next.js App Router for server components, API routes, and SSR
- PostgreSQL for ACID compliance (critical for booking race conditions)
- Prisma for type-safe database access and automatic migrations
- Neon for serverless Postgres (free tier, scales automatically)
- Resend for email (simpler API than SendGrid, $0 for 3k emails/month)
- Vercel for zero-config deployment

---

## 2. Database Schema (Prisma)

Create `prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id                     String   @id @default(cuid())
  email                  String   @unique
  name                   String
  password               String   // bcrypt hashed
  phoneNumber            String?
  apartmentNumber        Int
  role                   Role     @default(RESIDENT)
  status                 Status   @default(PENDING)
  notificationPreference NotificationPreference @default(EMAIL_ONLY)
  createdAt              DateTime @default(now())
  updatedAt              DateTime @updatedAt

  bookings               Booking[]
  queueEntries           QueueEntry[]
  blockedSlotsCreated    BlockedSlot[]
  announcementsCreated   Announcement[]

  @@index([apartmentNumber])
  @@index([status])
}

enum Role {
  RESIDENT
  MANAGER
}

enum Status {
  PENDING    // waiting for manager approval
  VERIFIED   // approved, can book
  DEACTIVATED // account disabled
}

enum NotificationPreference {
  EMAIL_ONLY
  SMS_ONLY
  BOTH
}

model Booking {
  id            String   @id @default(cuid())
  userId        String
  user          User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  facilityType  FacilityType
  equipmentType EquipmentType? // null for exclusive bookings
  bookingType   BookingType

  date          DateTime @db.Date // stored as date only
  startTime     String   // "05:00", "05:30", "06:00", etc.
  duration      Int      // 30 or 60 (minutes)

  createdAt     DateTime @default(now())

  @@index([userId])
  @@index([facilityType, date, startTime])
  @@index([date, startTime]) // for calendar queries
}

enum FacilityType {
  GYM
  SAUNA
}

enum EquipmentType {
  WEIGHTS_MACHINE
  FREE_DUMBBELLS
  TREADMILL
  ROWING_MACHINE
  EXERCISE_BIKE
}

enum BookingType {
  EXCLUSIVE  // whole gym or whole sauna
  SHARED     // specific equipment or shared sauna
}

model QueueEntry {
  id            String   @id @default(cuid())
  userId        String
  user          User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  facilityType  FacilityType
  equipmentType EquipmentType? // null for exclusive or sauna queues
  bookingType   BookingType
  date          DateTime @db.Date
  startTime     String
  duration      Int

  position      Int      // 1 = first in queue
  notifiedAt    DateTime? // when we sent "slot available" notification
  expiresAt     DateTime? // when their claim window expires (30 min after notifiedAt)

  createdAt     DateTime @default(now())

  @@index([facilityType, date, startTime])
  @@index([userId])
  @@index([expiresAt]) // for cleanup jobs
}

model BlockedSlot {
  id          String   @id @default(cuid())
  facilityType FacilityType
  date        DateTime @db.Date
  startTime   String
  duration    Int      // minutes
  reason      String
  recurring   Boolean  @default(false)
  createdBy   String
  creator     User     @relation(fields: [createdBy], references: [id])
  createdAt   DateTime @default(now())

  @@index([facilityType, date])
}

model Announcement {
  id        String   @id @default(cuid())
  title     String
  message   String   @db.Text
  createdBy String
  creator   User     @relation(fields: [createdBy], references: [id])
  createdAt DateTime @default(now())
  expiresAt DateTime?

  @@index([expiresAt])
}

model NotificationLog {
  id        String   @id @default(cuid())
  userId    String?  // null for system notifications
  type      NotificationType
  channel   NotificationChannel
  content   String   @db.Text
  sentAt    DateTime @default(now())
  success   Boolean
  error     String?
  cost      Float?   // for SMS cost tracking

  @@index([userId])
  @@index([sentAt])
  @@index([type])
}

enum NotificationType {
  BOOKING_CONFIRMATION
  BOOKING_REMINDER
  QUEUE_SLOT_AVAILABLE
  QUEUE_POSITION_UPDATE
  ACCOUNT_VERIFIED
  BOOKING_CANCELLED_BY_ADMIN
}

enum NotificationChannel {
  EMAIL
  SMS
}
```

**Key Design Decisions:**
- `date` stored as Date type (no time component)
- `startTime` as string ("HH:MM") for easy slot matching
- `duration` in minutes (30 or 60)
- Cascade deletes on user removal
- Indexes on all query-heavy fields
- NotificationLog for debugging and cost tracking

---

## 3. API Routes (Next.js App Router)

All routes in `app/api/`:

### Authentication Routes

**POST `/api/auth/register`**
```typescript
// Request
{
  email: string
  password: string
  name: string
  apartmentNumber: number (1-65)
  phoneNumber?: string
  notificationPreference: "EMAIL_ONLY" | "SMS_ONLY" | "BOTH"
}

// Response
{
  success: boolean
  message: string
  userId?: string
}

// Validation
- Email must be valid and unique
- Password min 8 chars
- Apartment 1-65
- Check if apartment has <4 verified users
- Phone required if notificationPreference includes SMS
- Australian mobile format: +61...
```

**POST `/api/auth/login`** (handled by NextAuth)

**POST `/api/auth/logout`** (handled by NextAuth)

---

### Booking Routes

**GET `/api/bookings/availability`**
```typescript
// Query params
?facilityType=GYM&date=2026-01-15

// Response
{
  date: "2026-01-15",
  facilityType: "GYM",
  slots: [
    {
      startTime: "05:00",
      duration: 30,
      availability: {
        exclusive: "available" | "booked" | "blocked",
        shared: {
          WEIGHTS_MACHINE: "available" | "booked",
          TREADMILL: "available" | "booked",
          // ... all equipment
        },
        sharedCapacity: { used: 1, max: 2 }, // for sauna
        queueCount: 3
      }
    },
    // ... all slots 05:00 to 22:00
  ]
}

// Business Logic
- Check BlockedSlots
- Check existing Bookings
- Apply anti-hoarding rules (hide/disable slots user can't book)
- For exclusive: if 1 booking exists, mark as booked
- For shared gym: if 2 bookings exist, mark as full
- For shared sauna: if 2 bookings exist, mark as full
```

**POST `/api/bookings/create`**
```typescript
// Request
{
  facilityType: "GYM" | "SAUNA"
  bookingType: "EXCLUSIVE" | "SHARED"
  equipmentType?: "TREADMILL" | ... // required if shared gym
  date: "2026-01-15"
  startTime: "06:00"
  duration: 30 | 60
}

// Response
{ success: boolean, bookingId?: string, error?: string }

// Validation (in order)
1. User is verified
2. Slot is within 1 week window
3. Slot is not in the past
4. Slot is within operating hours (5am-10pm)
5. Slot is not blocked
6. User hasn't hit max active bookings:
   - Exclusive gym: 3
   - Exclusive sauna: 3
   - Shared: 5
7. Check anti-hoarding rules:
   - Exclusive: not same timeslot as yesterday
   - Exclusive: can only see next week's same slot 24h before
   - Shared: max 3 same timeslots per week
8. Check capacity:
   - Exclusive: no other bookings for that facility/slot
   - Shared gym: <2 bookings for same slot
   - Shared sauna: <2 bookings for same slot
   - Shared gym: equipment not already booked
9. Create booking in transaction
10. Send confirmation notification

// Use Prisma transaction to handle race conditions
```

**DELETE `/api/bookings/:id`**
```typescript
// Response
{ success: boolean }

// Business Logic
1. Verify user owns booking or is manager
2. Check booking hasn't started yet (5min grace allowed)
3. Delete booking
4. Check if anyone queued for this slot
5. If yes, notify first in queue
6. Set their expiresAt to now + 30 minutes
```

**GET `/api/bookings/my-bookings`**
```typescript
// Response
{
  upcoming: Booking[]
  past: Booking[] // optional, for history
}
```

---

### Queue Routes

**POST `/api/queue/join`**
```typescript
// Request
{
  facilityType: "GYM" | "SAUNA"
  bookingType: "EXCLUSIVE" | "SHARED"
  equipmentType?: string
  date: "2026-01-15"
  startTime: "06:00"
  duration: 30 | 60
}

// Response
{ success: boolean, position: number }

// Business Logic
1. Verify slot is actually full
2. Check user not already in queue for this exact slot
3. Find highest position number, add user as position+1
4. Return their position
```

**POST `/api/queue/claim/:queueEntryId`**
```typescript
// Response
{ success: boolean, bookingId?: string }

// Business Logic
1. Verify queueEntry belongs to user
2. Check user was notified (notifiedAt exists)
3. Check claim window not expired (expiresAt > now)
4. Check slot still available
5. Create booking (with same validation as create)
6. Delete this queue entry
7. Return booking ID
```

**DELETE `/api/queue/:id`**
```typescript
// Leave queue
{ success: boolean }
```

**GET `/api/queue/my-queues`**
```typescript
{
  active: QueueEntry[]
}
```

---

### Manager Routes

**GET `/api/manager/users`**
```typescript
// Response
{
  pending: User[]
  verified: User[]
  deactivated: User[]
}

// Middleware: require role=MANAGER
```

**PATCH `/api/manager/users/:id/verify`**
```typescript
// Request
{ status: "VERIFIED" | "DEACTIVATED" }

// Business Logic
1. Update user status
2. If VERIFIED, send welcome email
3. If DEACTIVATED, cancel all their bookings
```

**GET `/api/manager/bookings`**
```typescript
// Query: ?date=2026-01-15&facilityType=GYM

// Response
{
  bookings: Array<Booking & { user: { name, apartmentNumber } }>
}
```

**DELETE `/api/manager/bookings/:id`**
```typescript
// Request
{ reason?: string, notifyUser: boolean }

// Business Logic
1. Delete booking
2. If notifyUser, send cancellation email with reason
3. Process queue (same as regular cancellation)
```

**POST `/api/manager/blocked-slots`**
```typescript
// Request
{
  facilityType: "GYM" | "SAUNA"
  date: "2026-01-15"
  startTime: "06:00"
  duration: 60
  reason: "Maintenance"
  recurring: false
}

// Response
{ success: boolean, conflictingBookings?: Booking[] }

// Business Logic
1. Check if any bookings exist in this slot
2. If yes, return them for manager to confirm
3. If confirmed, cancel those bookings with notification
4. Create blocked slot
```

**DELETE `/api/manager/blocked-slots/:id`**

**POST `/api/manager/announcements`**
```typescript
// Request
{
  title: string
  message: string
  expiresAt?: string
  sendEmail: boolean
}

// Business Logic
1. Create announcement
2. If sendEmail, send to all verified users
```

---

## 4. Business Logic Validation Functions

Create `lib/booking-rules.ts`:

```typescript
// Anti-hoarding validation for exclusive bookings
export async function canBookExclusiveSlot(
  userId: string,
  facilityType: FacilityType,
  date: Date,
  startTime: string
): Promise<{ allowed: boolean; reason?: string }> {

  // Rule 1: Cannot book same timeslot as yesterday
  const yesterday = new Date(date)
  yesterday.setDate(yesterday.getDate() - 1)

  const yesterdayBooking = await prisma.booking.findFirst({
    where: {
      userId,
      facilityType,
      bookingType: BookingType.EXCLUSIVE,
      date: yesterday,
      startTime
    }
  })

  if (yesterdayBooking) {
    return {
      allowed: false,
      reason: "You booked this timeslot yesterday. Please choose a different time."
    }
  }

  // Rule 2: Next week's same slot only visible 24h before
  const now = new Date()
  const slotDateTime = parseSlotDateTime(date, startTime)
  const hoursDiff = (slotDateTime.getTime() - now.getTime()) / (1000 * 60 * 60)

  // Check if this is "next week same timeslot"
  const daysAhead = Math.floor(hoursDiff / 24)
  if (daysAhead === 7) {
    // Exactly 1 week ahead - must be within 24h
    if (hoursDiff > 24) {
      return {
        allowed: false,
        reason: "This slot becomes available 24 hours before the booking time."
      }
    }
  }

  return { allowed: true }
}

// Anti-hoarding validation for shared bookings
export async function canBookSharedSlot(
  userId: string,
  facilityType: FacilityType,
  equipmentType: EquipmentType | null,
  date: Date,
  startTime: string
): Promise<{ allowed: boolean; reason?: string }> {

  // Get all bookings for this user in the same week
  const weekStart = getWeekStart(date) // Monday
  const weekEnd = getWeekEnd(date)     // Sunday

  const sameSlotBookingsThisWeek = await prisma.booking.findMany({
    where: {
      userId,
      facilityType,
      bookingType: BookingType.SHARED,
      equipmentType, // null for sauna, specific equipment for gym
      startTime,
      date: {
        gte: weekStart,
        lte: weekEnd
      }
    }
  })

  if (sameSlotBookingsThisWeek.length >= 3) {
    return {
      allowed: false,
      reason: "You've already booked this timeslot 3 times this week. Try a different time."
    }
  }

  return { allowed: true }
}

// Check user booking limits
export async function checkBookingLimits(
  userId: string,
  bookingType: BookingType,
  facilityType: FacilityType
): Promise<{ allowed: boolean; reason?: string }> {

  const now = new Date()

  if (bookingType === BookingType.EXCLUSIVE) {
    const count = await prisma.booking.count({
      where: {
        userId,
        facilityType,
        bookingType: BookingType.EXCLUSIVE,
        date: { gte: now }
      }
    })

    const limit = 3
    if (count >= limit) {
      return {
        allowed: false,
        reason: `You have ${limit} active exclusive ${facilityType.toLowerCase()} bookings (limit reached).`
      }
    }
  } else {
    // Shared bookings
    const count = await prisma.booking.count({
      where: {
        userId,
        bookingType: BookingType.SHARED,
        date: { gte: now }
      }
    })

    const limit = 5
    if (count >= limit) {
      return {
        allowed: false,
        reason: `You have ${limit} active shared bookings (limit reached).`
      }
    }
  }

  return { allowed: true }
}

// Check slot capacity
export async function isSlotAvailable(
  facilityType: FacilityType,
  bookingType: BookingType,
  equipmentType: EquipmentType | null,
  date: Date,
  startTime: string
): Promise<{ available: boolean; reason?: string }> {

  // Check if slot is blocked
  const blocked = await prisma.blockedSlot.findFirst({
    where: { facilityType, date, startTime }
  })

  if (blocked) {
    return { available: false, reason: blocked.reason }
  }

  const existingBookings = await prisma.booking.findMany({
    where: { facilityType, date, startTime }
  })

  if (bookingType === BookingType.EXCLUSIVE) {
    if (existingBookings.length > 0) {
      return { available: false, reason: "Slot is already booked." }
    }
  } else {
    // Shared booking
    if (facilityType === FacilityType.SAUNA) {
      if (existingBookings.length >= 2) {
        return { available: false, reason: "Sauna is full (2 people max)." }
      }
    } else {
      // Gym shared
      if (existingBookings.length >= 2) {
        return { available: false, reason: "Gym is full (2 people max)." }
      }

      // Check if this specific equipment is taken
      const equipmentBooked = existingBookings.some(
        b => b.equipmentType === equipmentType
      )
      if (equipmentBooked) {
        return { available: false, reason: "This equipment is already booked." }
      }
    }
  }

  return { available: true }
}
```

---

## 5. Notification System

Create `lib/notifications.ts`:

```typescript
import { Resend } from 'resend'
import twilio from 'twilio'

const resend = new Resend(process.env.RESEND_API_KEY)
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
)

export async function sendNotification(
  user: User,
  type: NotificationType,
  data: any
) {
  const { notificationPreference } = user

  const content = generateNotificationContent(type, data)

  // Send via email
  if (
    notificationPreference === 'EMAIL_ONLY' ||
    notificationPreference === 'BOTH'
  ) {
    await sendEmail(user.email, content.subject, content.emailBody)
    await logNotification(user.id, type, 'EMAIL', content.emailBody, true)
  }

  // Send via SMS
  if (
    (notificationPreference === 'SMS_ONLY' || notificationPreference === 'BOTH') &&
    user.phoneNumber
  ) {
    const cost = await sendSMS(user.phoneNumber, content.smsBody)
    await logNotification(user.id, type, 'SMS', content.smsBody, true, cost)
  }
}

async function sendEmail(to: string, subject: string, html: string) {
  await resend.emails.send({
    from: 'Gym Booking <noreply@yourdomain.com>',
    to,
    subject,
    html
  })
}

async function sendSMS(to: string, body: string): Promise<number> {
  const message = await twilioClient.messages.create({
    body,
    from: process.env.TWILIO_PHONE_NUMBER,
    to
  })

  // Twilio pricing: ~$0.0075 per SMS in Australia
  return 0.0075
}

function generateNotificationContent(type: NotificationType, data: any) {
  switch (type) {
    case 'BOOKING_CONFIRMATION':
      return {
        subject: 'Booking Confirmed',
        emailBody: `
          <h2>Your booking is confirmed!</h2>
          <p><strong>${data.facilityType}</strong> - ${data.bookingType}</p>
          <p>${data.date} at ${data.startTime} (${data.duration} minutes)</p>
          ${data.equipmentType ? `<p>Equipment: ${data.equipmentType}</p>` : ''}
          <p><a href="${data.manageUrl}">Manage booking</a></p>
        `,
        smsBody: `Booking confirmed: ${data.facilityType} ${data.date} ${data.startTime}. Manage: ${data.shortUrl}`
      }

    case 'BOOKING_REMINDER':
      const queueInfo = data.queueCount > 0 ? ` ${data.queueCount} people waiting.` : ''
      return {
        subject: 'Booking Reminder',
        emailBody: `
          <h2>Reminder: You have a booking soon</h2>
          <p>${data.facilityType} - ${data.date} at ${data.startTime}</p>
          ${queueInfo ? `<p><strong>${queueInfo}</strong> If you can't make it, please cancel.</p>` : ''}
          <p><a href="${data.manageUrl}">Manage booking</a></p>
        `,
        smsBody: `Reminder: ${data.facilityType} ${data.date} ${data.startTime}.${queueInfo} ${data.shortUrl}`
      }

    case 'QUEUE_SLOT_AVAILABLE':
      return {
        subject: 'Slot Available!',
        emailBody: `
          <h2>A slot you queued for is now available!</h2>
          <p>${data.facilityType} - ${data.date} at ${data.startTime}</p>
          <p><strong>Claim it now - you have 30 minutes.</strong></p>
          <p><a href="${data.claimUrl}">Claim Slot</a></p>
        `,
        smsBody: `SLOT AVAILABLE! ${data.facilityType} ${data.date} ${data.startTime}. Claim in 30min: ${data.claimUrl}`
      }

    // ... other types
  }
}

async function logNotification(
  userId: string,
  type: NotificationType,
  channel: NotificationChannel,
  content: string,
  success: boolean,
  cost?: number
) {
  await prisma.notificationLog.create({
    data: {
      userId,
      type,
      channel,
      content,
      success,
      cost
    }
  })
}
```

---

## 6. Frontend Component Structure

```
app/
├── (auth)/
│   ├── login/
│   │   └── page.tsx
│   └── register/
│       └── page.tsx
├── (app)/
│   ├── layout.tsx              // Main app layout with nav
│   ├── page.tsx                 // Dashboard/Calendar view
│   ├── my-bookings/
│   │   └── page.tsx
│   ├── queue/
│   │   └── page.tsx
│   └── manager/
│       ├── users/
│       │   └── page.tsx
│       ├── bookings/
│       │   └── page.tsx
│       ├── blocked-slots/
│       │   └── page.tsx
│       └── announcements/
│           └── page.tsx
├── api/                         // API routes (detailed above)
└── layout.tsx                   // Root layout

components/
├── ui/                          // shadcn components
│   ├── button.tsx
│   ├── calendar.tsx
│   ├── dialog.tsx
│   ├── select.tsx
│   └── ...
├── calendar/
│   ├── WeekView.tsx            // Main calendar grid
│   ├── TimeSlot.tsx            // Individual slot component
│   ├── DayView.tsx             // Detailed day view
│   └── BookingDialog.tsx       // Booking creation modal
├── bookings/
│   ├── BookingCard.tsx
│   └── CancelBookingDialog.tsx
├── queue/
│   ├── QueueList.tsx
│   └── ClaimSlotDialog.tsx
└── manager/
    ├── UserApprovalTable.tsx
    ├── BookingManagementTable.tsx
    └── BlockSlotDialog.tsx

lib/
├── prisma.ts                    // Prisma client singleton
├── auth.ts                      // NextAuth config
├── booking-rules.ts             // Validation logic (detailed above)
├── notifications.ts             // Email/SMS (detailed above)
└── utils.ts                     // Helper functions
```

---

## 7. Key React Components

### WeekView.tsx
```typescript
'use client'

import { useState } from 'react'
import { format, addDays, startOfWeek } from 'date-fns'

export function WeekView() {
  const [currentWeek, setCurrentWeek] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }))
  const [facilityType, setFacilityType] = useState<'GYM' | 'SAUNA'>('GYM')

  const days = Array.from({ length: 7 }, (_, i) => addDays(currentWeek, i))
  const timeSlots = generateTimeSlots() // 05:00 to 22:00 in 30min intervals

  // Fetch availability for all slots in this week
  const { data: availability, isLoading } = useAvailability(facilityType, days)

  return (
    <div className="calendar-grid">
      {/* Header: Days of week */}
      <div className="grid grid-cols-8 gap-2">
        <div></div>
        {days.map(day => (
          <div key={day.toISOString()} className="text-center font-semibold">
            {format(day, 'EEE d')}
          </div>
        ))}
      </div>

      {/* Grid: Time slots */}
      {timeSlots.map(time => (
        <div key={time} className="grid grid-cols-8 gap-2">
          <div className="text-sm text-gray-500">{time}</div>
          {days.map(day => (
            <TimeSlot
              key={`${day.toISOString()}-${time}`}
              facilityType={facilityType}
              date={day}
              startTime={time}
              availability={availability?.[format(day, 'yyyy-MM-dd')]?.[time]}
              onClick={() => openBookingDialog(day, time)}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

function generateTimeSlots(): string[] {
  const slots = []
  for (let hour = 5; hour <= 21; hour++) {
    slots.push(`${hour.toString().padStart(2, '0')}:00`)
    if (hour < 21 || (hour === 21 && 30 <= 30)) { // last slot is 21:30 (ends at 22:00)
      slots.push(`${hour.toString().padStart(2, '0')}:30`)
    }
  }
  return slots
}
```

### TimeSlot.tsx
```typescript
interface TimeSlotProps {
  facilityType: 'GYM' | 'SAUNA'
  date: Date
  startTime: string
  availability: SlotAvailability
  onClick: () => void
}

export function TimeSlot({ availability, onClick }: TimeSlotProps) {
  const status = getSlotStatus(availability)

  return (
    <button
      onClick={onClick}
      className={cn(
        "h-12 rounded border text-xs",
        status === 'available' && "bg-green-50 border-green-200 hover:bg-green-100",
        status === 'partial' && "bg-yellow-50 border-yellow-200 hover:bg-yellow-100",
        status === 'full' && "bg-red-50 border-red-200 hover:bg-red-100",
        status === 'yours' && "bg-blue-100 border-blue-300",
        status === 'blocked' && "bg-gray-100 border-gray-300 cursor-not-allowed"
      )}
      disabled={status === 'blocked'}
    >
      {status === 'yours' && '✓'}
      {status === 'full' && availability.queueCount > 0 && `${availability.queueCount} queued`}
    </button>
  )
}

function getSlotStatus(availability: SlotAvailability): string {
  if (availability.isBlocked) return 'blocked'
  if (availability.isYourBooking) return 'yours'
  if (availability.exclusive === 'available' || availability.hasSharedCapacity) return 'available'
  if (availability.hasPartialCapacity) return 'partial'
  return 'full'
}
```

---

## 8. Build Phases

### Phase 1: Core Infrastructure (Week 1)
**Goal:** Get basic app running with auth and database

1. Project setup
   - `npx create-next-app@latest gym-booking --typescript --tailwind --app`
   - Install dependencies: `prisma`, `@prisma/client`, `next-auth`, `bcryptjs`, `zod`
   - Set up Neon database
   - Initialize Prisma: `npx prisma init`

2. Database setup
   - Copy schema from section 2
   - Run `npx prisma migrate dev --name init`
   - Seed with 2 manager accounts

3. Authentication
   - Set up NextAuth.js with credentials provider
   - Create login/register pages
   - Implement session management

4. Basic UI
   - Install shadcn/ui: `npx shadcn-ui@latest init`
   - Add components: button, input, card, dialog
   - Create basic layout with nav

**Deliverable:** Can register, login, and see empty dashboard

---

### Phase 2: Booking System (Week 2)
**Goal:** Create, view, and cancel bookings

1. Booking API routes
   - `/api/bookings/availability` - read availability
   - `/api/bookings/create` - create booking with all validation
   - `/api/bookings/my-bookings` - user's bookings
   - DELETE booking endpoint

2. Business logic implementation
   - Implement all validation functions from `lib/booking-rules.ts`
   - Anti-hoarding rule checks
   - Capacity checks
   - Time window checks

3. Calendar UI
   - WeekView component with 7-day grid
   - TimeSlot component with color coding
   - BookingDialog for creating bookings
   - My Bookings page with cancel functionality

**Deliverable:** Users can book, view, and cancel gym/sauna slots

---

### Phase 3: Queue System (Week 3)
**Goal:** Queue for full slots and claim when available

1. Queue API routes
   - POST `/api/queue/join`
   - POST `/api/queue/claim/:id`
   - GET `/api/queue/my-queues`

2. Queue notification logic
   - When booking cancelled, find first in queue
   - Send notification (email for now)
   - Set 30-minute claim window

3. Queue UI
   - "Join Queue" button on full slots
   - Queue page showing all queues
   - Claim dialog with countdown timer

4. Background job setup
   - Cron job (Vercel Cron) to expire unclaimed queue slots
   - Run every 5 minutes, check `expiresAt < now`

**Deliverable:** Users can queue and claim released slots

---

### Phase 4: Notifications (Week 4)
**Goal:** Email and SMS notifications working

1. Email setup (Resend)
   - Create Resend account
   - Verify domain
   - Implement email templates
   - Test all notification types

2. SMS setup (Twilio)
   - Create Twilio account
   - Get Australian phone number
   - Implement SMS sending
   - Add cost tracking

3. Notification triggers
   - Booking confirmation (immediate)
   - Booking reminder (2 hours before via cron)
   - Queue slot available (immediate)
   - Account verified (immediate)

4. User preferences
   - Add notification preference to registration
   - Add settings page to update preferences

**Deliverable:** All notifications working via email and SMS

---

### Phase 5: Manager Features (Week 5)
**Goal:** Full admin control panel

1. User management
   - Pending users table with approve/reject
   - User list with deactivate option
   - Auto-email on approval

2. Booking management
   - View all bookings with user details
   - Cancel bookings with reason
   - Override booking limits (special flag)

3. Facility management
   - Block slots for maintenance
   - View blocked slots
   - Delete blocked slots

4. Announcements
   - Create announcement with optional expiry
   - Send to all users via email
   - Display on dashboard

**Deliverable:** Managers can fully administer the system

---

### Phase 6: Polish & Deploy (Week 6)
**Goal:** Production-ready

1. Error handling
   - Proper error messages for all API routes
   - User-friendly error displays
   - Logging for debugging

2. Loading states
   - Skeleton loaders for calendar
   - Loading spinners for actions
   - Optimistic UI updates

3. Mobile optimization
   - Test all views on mobile
   - Adjust calendar grid for small screens
   - Touch-friendly buttons

4. Testing
   - Test all booking rules manually
   - Test race conditions (two users booking simultaneously)
   - Test queue system end-to-end
   - Test all notification types

5. Deployment
   - Deploy to Vercel
   - Set up environment variables
   - Configure custom domain
   - Set up Vercel Cron for reminders and queue expiry

**Deliverable:** Live production app

---

## 9. Environment Variables

Create `.env.local`:

```bash
# Database
DATABASE_URL="postgresql://..."

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="generate-with-openssl-rand-base64-32"

# Resend
RESEND_API_KEY="re_..."

# Twilio
TWILIO_ACCOUNT_SID="AC..."
TWILIO_AUTH_TOKEN="..."
TWILIO_PHONE_NUMBER="+61..."

# App
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

---

## 10. Critical Implementation Notes

### Race Condition Handling
When two users try to book the last spot simultaneously:

```typescript
// Use Prisma transaction with retry
await prisma.$transaction(async (tx) => {
  // Check availability again inside transaction
  const existing = await tx.booking.findMany({
    where: { facilityType, date, startTime }
  })

  if (existing.length >= capacity) {
    throw new Error('Slot just filled')
  }

  // Create booking
  return tx.booking.create({ data: bookingData })
}, {
  maxWait: 5000,
  timeout: 10000,
})
```

### Anti-Hoarding Rule: "Same slot next week"
This is tricky. Example:
- Today is Monday 10am
- User can SEE next Monday's 10am slot (it's in the 7-day window)
- But they can only BOOK it after Sunday 10am (24h before)

Implementation:
```typescript
// In availability API, mark slot as "visible but disabled"
if (daysAhead === 7 && hoursDiff > 24) {
  return {
    visible: true,
    bookable: false,
    reason: "Available in 24 hours"
  }
}
```

### Notification Timing
- **Confirmation**: Send immediately after booking created
- **Reminder**: Cron job runs every hour, sends to bookings starting in 2 hours
- **Queue alert**: Send immediately when booking cancelled
- **Queue expiry**: Cron job runs every 5 minutes, expires old claims and notifies next in line

### Phone Number Validation
Australian mobiles: +61 4XX XXX XXX
```typescript
const phoneRegex = /^\+61\d{9}$/
```

---

## 11. Testing Checklist

Before launch, manually test:

- [ ] Register with all validation errors (bad email, weak password, etc.)
- [ ] Register 4 users for same apartment, 5th gets rejected
- [ ] Manager approves/rejects pending users
- [ ] Login/logout
- [ ] Create exclusive gym booking
- [ ] Create shared gym booking (specific equipment)
- [ ] Create exclusive sauna booking
- [ ] Create shared sauna booking
- [ ] Try to book same exclusive slot on consecutive days (should fail)
- [ ] Try to book same shared slot 4 times in one week (should fail on 4th)
- [ ] Try to book more than 7 days ahead (should fail)
- [ ] Try to book more than 3 exclusive gym slots (should fail)
- [ ] Two users try to book last spot (one should fail)
- [ ] Cancel booking 10 minutes before (should work)
- [ ] Join queue for full slot
- [ ] Cancel booking, check if queued user gets notified
- [ ] Claim queued slot within 30 minutes
- [ ] Don't claim, check if it expires and goes to next person
- [ ] Manager blocks slot
- [ ] Manager blocks slot with existing booking (should warn)
- [ ] Manager cancels user's booking
- [ ] Manager creates announcement
- [ ] Check email notifications arrive
- [ ] Check SMS notifications arrive (with Twilio test account)
- [ ] Mobile: view calendar on phone
- [ ] Mobile: book slot on phone

---

## 12. Future Enhancements (Post-Launch)

Not in scope for initial build, but easy to add later:

1. **Analytics Dashboard** (for managers)
   - Most popular time slots
   - Equipment usage stats
   - Booking trends over time

2. **Recurring Bookings**
   - "Book every Monday at 7am" (but still subject to anti-hoarding)

3. **Waitlist Notifications**
   - "Notify me when Thursday 7pm becomes available"

4. **User Ratings**
   - No-show tracking
   - Gentle reminders to serial cancellers

5. **Equipment Maintenance Log**
   - Track when equipment last serviced

---

## Summary

**You now have:**
- ✅ Complete database schema (Prisma)
- ✅ All API endpoints specified
- ✅ Business logic validation functions
- ✅ Component architecture
- ✅ 6-week build plan
- ✅ Environment setup guide
- ✅ Testing checklist

**Next step:** Start Phase 1 and build systematically through to Phase 6.

No more guesswork - everything is specified. Ready to build.
