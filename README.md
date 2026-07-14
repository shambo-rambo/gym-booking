# Gym & Sauna Booking System

A web-based booking system for apartment building gym and sauna facilities.

## Stack

- **Framework:** Next.js 14 (App Router) · TypeScript
- **Database:** PostgreSQL via [Neon](https://neon.tech) (serverless) · Prisma ORM
- **Auth:** NextAuth.js v5
- **UI:** Tailwind CSS · shadcn/ui
- **Email:** Resend
- **Hosting:** Firebase App Hosting (project: `watertower-gym`)
- **Cron jobs:** Google Cloud Scheduler

---

## Getting Started (Local Development)

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Copy `.env.example` to `.env` and fill in the values:

```bash
cp .env.example .env
```

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Neon connection string (pooled) |
| `DIRECT_URL` | Neon direct connection string (for Prisma migrations) |
| `AUTH_SECRET` | Random secret for NextAuth — generate with `openssl rand -base64 32` |
| `AUTH_URL` | Full URL of the app (e.g. `http://localhost:3000` for local) |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `RESEND_API_KEY` | Resend API key for email notifications |
| `RESEND_FROM_EMAIL` | From address for outgoing emails |
| `BUILDING_CODE` | Secret code residents use to self-verify at registration |
| `CRON_SECRET` | Bearer token for cron job routes — generate with `openssl rand -base64 32` |

### 3. Set up the database

```bash
npx prisma generate
npx prisma db push
npm run db:seed
```

The seed script creates two manager accounts:
- `manager1@gym.local` / `manager123`
- `manager2@gym.local` / `manager123`

### 4. Run the dev server

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000)

---

## Deployment (Firebase App Hosting)

The app is deployed on **Firebase App Hosting** (project `watertower-gym`, region `asia-southeast1`).

Live URL: `https://gym-booking--watertower-gym.asia-southeast1.hosted.app`

### 1. Fix the failing build (first-time setup)

The current build fails because `GOOGLE_CLIENT_ID` hasn't been granted to the App Hosting backend. Run:

```bash
firebase apphosting:secrets:grantaccess GOOGLE_CLIENT_ID --backend gym-booking
```

Repeat for any other secrets that fail:

```bash
firebase apphosting:secrets:grantaccess GOOGLE_CLIENT_SECRET --backend gym-booking
```

### 2. Add or update secrets

All secrets are managed via Firebase Secret Manager. To add or update a value:

```bash
firebase apphosting:secrets:set SECRET_NAME
```

Secrets currently wired in `apphosting.yaml`:

| Secret | Purpose |
|--------|---------|
| `DATABASE_URL` | Neon pooled connection |
| `DIRECT_URL` | Neon direct connection (Prisma migrations) |
| `AUTH_SECRET` | NextAuth signing secret |
| `GOOGLE_CLIENT_ID` | Google OAuth |
| `GOOGLE_CLIENT_SECRET` | Google OAuth |
| `RESEND_API_KEY` | Email notifications |
| `BUILDING_CODE` | Resident self-verification code |
| `CRON_SECRET` | Cron job authentication |
| `INCEPTION_API_USERNAME` | Inner Range Inception REST API user (amenity audit) |
| `INCEPTION_API_PASSWORD` | Inner Range Inception REST API password (amenity audit) |

### 3. Deploy

Firebase App Hosting deploys automatically on push to the connected branch. To trigger manually:

```bash
firebase apphosting:backends:get gym-booking
```

Then push to the connected Git branch.

---

## Cron Jobs (Google Cloud Scheduler)

Firebase App Hosting does not have built-in cron support. Cron jobs run via **Google Cloud Scheduler**, which calls the app's cron API routes on a schedule.

The four jobs and their schedules:

| Job | Route | Schedule | Purpose |
|-----|-------|----------|---------|
| `booking-reminders` | `/api/cron/booking-reminders` | Hourly | Sends reminder notifications 2 hours before upcoming bookings |
| `expire-queue-claims` | `/api/cron/expire-queue-claims` | Every 5 min | Expires unclaimed queue notifications, notifies next person |
| `release-waitlisted-slots` | `/api/cron/release-waitlisted-slots` | Hourly | Auto-releases slots 3 hours before session if queue exists |
| `amenity-audit` | `/api/cron/amenity-audit` | Weekly, Monday 3am | Reconciles Inception fob access logs against bookings for the past week |

All routes require `Authorization: Bearer {CRON_SECRET}` — Cloud Scheduler sends this header.

### First-time setup

Run the setup script once after deploying:

```bash
# Get your CRON_SECRET value from Firebase Secret Manager
export CRON_SECRET="your-cron-secret-value"
bash scripts/setup-cloud-scheduler.sh
```

The script creates (or updates) all four Cloud Scheduler jobs. Verify them at:
`https://console.cloud.google.com/cloudscheduler?project=watertower-gym`

---

## Project Structure

```
app/
├── api/
│   ├── auth/           # Registration and onboarding
│   ├── bookings/       # Booking CRUD and availability
│   ├── cron/           # Scheduled job endpoints
│   ├── manager/        # Manager-only endpoints
│   ├── queue/          # Waitlist/queue management
│   └── user/           # User settings
├── book/               # Booking calendar
├── login/
├── manager/            # Manager dashboard
├── onboarding/         # Google OAuth onboarding flow
├── queue/              # Waitlist page
├── register/
└── settings/

components/
├── ui/                 # shadcn/ui components
├── BookingRules.tsx
├── LoadingSpinner.tsx
└── Navbar.tsx

lib/
├── auth.ts             # NextAuth configuration
├── booking-rules.ts    # Anti-hoarding validation logic
├── equipment.ts        # Equipment labels and booking type formatters
├── prisma.ts           # Prisma client
└── utils.ts

scripts/
├── setup-cloud-scheduler.sh  # Creates Google Cloud Scheduler jobs
└── db:seed (via package.json)

prisma/
├── schema.prisma
└── seed.ts
```

---

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run db:push` | Push Prisma schema to database |
| `npm run db:seed` | Seed database with manager accounts |

---

## Manager Access

1. Log in with a manager account (seeded: `manager1@gym.local` / `manager123`)
2. Navigate to `/manager`
3. From the dashboard: approve registrations, manage bookings, block slots, post announcements
