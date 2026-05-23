#!/bin/bash
# Sets up Google Cloud Scheduler jobs for the gym booking app.
# Run this once after deploying to Firebase App Hosting.
#
# Prerequisites:
#   gcloud auth login
#   gcloud config set project watertower-gym
#
# The CRON_SECRET must already exist in Secret Manager (apphosting.yaml handles this
# for the app, but Cloud Scheduler needs the raw value to send as a Bearer token).
#
# Usage:
#   export CRON_SECRET="your-cron-secret-value"
#   bash scripts/setup-cloud-scheduler.sh

set -e

PROJECT_ID="watertower-gym"
REGION="asia-southeast1"
BASE_URL="https://gym-booking--watertower-gym.asia-southeast1.hosted.app"
TIMEZONE="Australia/Sydney"

if [ -z "$CRON_SECRET" ]; then
  echo "Error: CRON_SECRET environment variable is not set."
  echo "Run: export CRON_SECRET=\"your-cron-secret-value\""
  exit 1
fi

echo "Creating Cloud Scheduler jobs for project: $PROJECT_ID"

# Job 1: Booking reminders (hourly)
gcloud scheduler jobs create http booking-reminders \
  --project="$PROJECT_ID" \
  --location="$REGION" \
  --schedule="0 * * * *" \
  --time-zone="$TIMEZONE" \
  --uri="$BASE_URL/api/cron/booking-reminders" \
  --http-method=GET \
  --headers="Authorization=Bearer $CRON_SECRET" \
  --attempt-deadline=60s \
  --description="Sends reminder notifications 2 hours before upcoming bookings" \
  || gcloud scheduler jobs update http booking-reminders \
       --project="$PROJECT_ID" \
       --location="$REGION" \
       --schedule="0 * * * *" \
       --time-zone="$TIMEZONE" \
       --uri="$BASE_URL/api/cron/booking-reminders" \
       --http-method=GET \
       --headers="Authorization=Bearer $CRON_SECRET" \
       --attempt-deadline=60s

echo "✓ booking-reminders (hourly)"

# Job 2: Expire queue claims (every 5 minutes)
gcloud scheduler jobs create http expire-queue-claims \
  --project="$PROJECT_ID" \
  --location="$REGION" \
  --schedule="*/5 * * * *" \
  --time-zone="$TIMEZONE" \
  --uri="$BASE_URL/api/cron/expire-queue-claims" \
  --http-method=GET \
  --headers="Authorization=Bearer $CRON_SECRET" \
  --attempt-deadline=30s \
  --description="Expires unclaimed queue notifications and notifies the next person" \
  || gcloud scheduler jobs update http expire-queue-claims \
       --project="$PROJECT_ID" \
       --location="$REGION" \
       --schedule="*/5 * * * *" \
       --time-zone="$TIMEZONE" \
       --uri="$BASE_URL/api/cron/expire-queue-claims" \
       --http-method=GET \
       --headers="Authorization=Bearer $CRON_SECRET" \
       --attempt-deadline=30s

echo "✓ expire-queue-claims (every 5 minutes)"

# Job 3: Release waitlisted slots (hourly)
gcloud scheduler jobs create http release-waitlisted-slots \
  --project="$PROJECT_ID" \
  --location="$REGION" \
  --schedule="0 * * * *" \
  --time-zone="$TIMEZONE" \
  --uri="$BASE_URL/api/cron/release-waitlisted-slots" \
  --http-method=GET \
  --headers="Authorization=Bearer $CRON_SECRET" \
  --attempt-deadline=60s \
  --description="Releases slots from cancelled bookings back into the waitlist flow" \
  || gcloud scheduler jobs update http release-waitlisted-slots \
       --project="$PROJECT_ID" \
       --location="$REGION" \
       --schedule="0 * * * *" \
       --time-zone="$TIMEZONE" \
       --uri="$BASE_URL/api/cron/release-waitlisted-slots" \
       --http-method=GET \
       --headers="Authorization=Bearer $CRON_SECRET" \
       --attempt-deadline=60s

echo "✓ release-waitlisted-slots (hourly)"
echo ""
echo "All Cloud Scheduler jobs created. Verify in the console:"
echo "https://console.cloud.google.com/cloudscheduler?project=$PROJECT_ID"
