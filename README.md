# Gym & Sauna Booking System

A web-based booking system for apartment building gym and sauna facilities.

## All Phases Complete ✓

### Phase 1: Authentication & Infrastructure ✓
- Authentication system with NextAuth
- Database setup with Prisma + PostgreSQL
- User registration and login
- Basic navigation and layouts

### Phase 2: Booking System ✓
- Full booking calendar (week view)
- Create bookings (exclusive and shared)
- Anti-hoarding rules working
- Booking limits enforcement
- Capacity checks
- My Bookings page with cancellation
- All validation rules implemented

### Phase 3: Queue System ✓
- Queue system for full slots
- Join queue when slot is full
- Automatic notification when slot becomes available
- 30-minute claim window
- Queue page with claim/leave functionality
- Position tracking
- Auto-refresh queue status

### Phase 4: Notifications ✓
- Email notifications via Resend
- SMS notifications via Twilio
- Booking confirmations and reminders
- Queue alerts with 30-minute claim windows
- User notification preferences
- Automated cron jobs for reminders and queue expiry

### Phase 5: Manager Features ✓
- Manager dashboard with role-based access
- User management (approve/reject/deactivate)
- Booking management (view all, cancel with reason)
- Facility management (block slots for maintenance)
- Announcements system with email broadcast
- All admin controls with comprehensive UI

## Getting Started

### Prerequisites

- Node.js 20.7.0 or higher
- PostgreSQL database (use [Neon](https://neon.tech) for free serverless Postgres)

### Setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Set up your database**
   - Create a PostgreSQL database (recommended: [Neon](https://neon.tech))
   - Copy your connection string

3. **Configure environment variables**

   Edit `.env` and update the `DATABASE_URL`:
   ```env
   DATABASE_URL="postgresql://user:password@host/database"
   ```

4. **Generate Prisma client and push schema**
   ```bash
   npx prisma generate
   npx prisma db push
   ```

5. **Seed the database with manager accounts**
   ```bash
   npm run db:seed
   ```

   This creates 2 manager accounts:
   - Email: `manager1@gym.local` / Password: `manager123`
   - Email: `manager2@gym.local` / Password: `manager123`

6. **Run the development server**
   ```bash
   npm run dev
   ```

7. **Open the app**

   Visit [http://localhost:3000](http://localhost:3000)

## Testing the App

1. **Register and verify a user:**
   ```sql
   -- After registering, manually verify your account:
   UPDATE "User" SET status = 'VERIFIED' WHERE email = 'your@email.com';
   ```

2. **Book facilities:**
   - Visit the calendar
   - Toggle between Gym and Sauna
   - Click on time slots to book
   - Try both exclusive and shared bookings
   - For shared gym: select equipment

3. **Test anti-hoarding rules:**
   - Book exclusive slot on Monday 6pm
   - Try to book Tuesday 6pm (will be blocked)
   - Book shared slot 3 times in one week
   - 4th time will fail

4. **View and cancel bookings:**
   - Go to "My Bookings"
   - See all upcoming bookings
   - Cancel any booking

5. **Test queue system:**
   - Book a slot with User 1
   - Try to book same slot with User 2 → "Join Queue"
   - User 2 joins queue
   - Check Queue page → shows position
   - User 1 cancels booking
   - User 2 sees notification on Queue page
   - User 2 claims the slot

## Deployment to Vercel

### 1. Set Environment Variables

In your Vercel project settings, add the following environment variables:

```env
DATABASE_URL="postgresql://user:password@host/database"
NEXTAUTH_SECRET="your-random-secret-here"
NEXTAUTH_URL="https://your-domain.vercel.app"
RESEND_API_KEY="re_xxxxxxxxxxxx"
TWILIO_ACCOUNT_SID="ACxxxxxxxxxxxx"
TWILIO_AUTH_TOKEN="your-twilio-auth-token"
TWILIO_PHONE_NUMBER="+1234567890"
```

Generate a random secret for NEXTAUTH_SECRET:
```bash
openssl rand -base64 32
```

### 2. Deploy to Vercel

```bash
vercel --prod
```

### 3. Initialize Database

After deployment, run these commands to set up your database:

```bash
npx prisma db push
npx prisma db seed
```

The seed command creates two manager accounts:
- Email: `manager1@gym.local` / Password: `manager123`
- Email: `manager2@gym.local` / Password: `manager123`

### 4. Cron Jobs

The project includes `vercel.json` with cron job configuration:
- Booking reminders: Every hour
- Queue claim expiry: Every 5 minutes

These will run automatically on Vercel.

See `PHASE5_COMPLETE.md` for detailed Phase 5 documentation.

## Project Structure

```
app/
├── api/auth/           # Auth endpoints
├── login/              # Login page
├── register/           # Registration page
├── my-bookings/        # User bookings (Phase 2)
├── queue/              # Queue management (Phase 3)
└── manager/            # Manager dashboard (Phase 5)

components/
├── ui/                 # shadcn/ui components
├── Navbar.tsx          # Main navigation
└── SessionProvider.tsx # Auth session wrapper

lib/
├── auth.ts             # NextAuth configuration
├── prisma.ts           # Prisma client
└── utils.ts            # Utility functions

prisma/
├── schema.prisma       # Database schema
└── seed.ts             # Seed script
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run db:push` - Push schema to database
- `npm run db:seed` - Seed database with manager accounts

## Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Database:** PostgreSQL with Prisma ORM
- **Auth:** NextAuth.js v5
- **UI:** Tailwind CSS + shadcn/ui
- **Language:** TypeScript

## Manager Access

To access the manager dashboard:

1. Login with a manager account (see seed data above)
2. Navigate to `/manager` or click "Manager Dashboard" in the navbar
3. From the dashboard you can:
   - Approve/reject pending user registrations
   - View and cancel all bookings
   - Block time slots for maintenance
   - Post building-wide announcements

## Testing User Flow

1. **Register a new user** at `/register`
2. **Login as manager** (manager1@gym.local / manager123)
3. **Approve the user** at `/manager/users`
4. **Login as the new user** and start booking!
