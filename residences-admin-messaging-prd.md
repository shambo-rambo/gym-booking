# The Residences: Admin Mode and Building Messaging (PRD v1)

Plain-language build instructions for Claude Code. No code is included on purpose. Field and model names are given so implementation is unambiguous, but wording and exact schema choices are yours to finalise.

## Purpose and scope

Two capabilities plus the data to support them:

1. A mode switch so the building manager, who is both an admin and a resident on one account, can move between a Resident view and an Admin view.
2. A building messaging system that always posts an in-app notice to a targeted group of residents and optionally sends email and/or text on top, respecting each resident's channel preference.

It also adds the profile fields needed for targeting and for a future door-access feature.

## Design principles (older user, mobile first)

- Large tap targets, roughly 60px minimum. Base text 18px or larger. High contrast.
- One decision per screen. A Back button on every step. Plain-language confirmation before anything is sent.
- No icon-only controls, no gestures, no small toggles. Every control has a text label.

## 1. Data model changes (prisma/schema.prisma)

**User model additions**

- `residencyType`: one of `TENANT`, `OWNER_OCCUPIER`, `NON_RESIDENT_OWNER`. This is separate from the existing `role` field, which stays as the permission (RESIDENT or MANAGER). Set it during import. Since existing rows have no value, add it as nullable first, backfill during import, then treat it as required in the app layer.
- `fobNumber`: optional text. Stored now for a future feature that reads the security door log to see who accesses the gym after hours or without a booking. Not used anywhere in v1. (Note for later: a resident may hold more than one fob. If that turns out to be true we revisit this then.)

**Floor is not stored.** It is derived from the apartment number: floor equals the apartment number divided by 100, rounded down. So 0 to 99 is Ground, 100 to 199 is level 1, 200 to 299 is level 2, and so on. Ground displays as the word "Ground", not "0". Build one shared helper for this and use it everywhere floor is shown or targeted (residents list, floor picker, message targeting).

**Notice model** (extend the existing `Announcement` model, which already holds title, message, createdBy, createdAt and expiresAt)

Add:
- `category`: one of `AMENITY`, `MAINTENANCE`, `URGENT`, `GENERAL`.
- `targetType`: one of `ALL`, `RESIDENCY`, `FLOOR`, `APARTMENT`.
- `targetValues`: the selected values for that type. For RESIDENCY it is one of the residency groups. For FLOOR it is one or more floor numbers. For APARTMENT it is one or more apartment numbers. For ALL it is empty.
- `sentEmail` and `sentSms`: booleans recording whether those channels were attempted for this message. In-app is always true and does not need a flag.

**NoticeRecipient model** (new join table)

- Links a notice to a user, created at send time by resolving the target into the matching set of users.
- Fields: noticeId, userId, and `readAt` (nullable). `readAt` is set when the resident opens that notice. It drives the unread badge only. We are not building an admin-facing read-receipt screen in v1.

**NotificationLog and NotificationType**

- Add a new `NotificationType` value, `BUILDING_MESSAGE`, and log each individual email and text fan-out in the existing `NotificationLog` (which already tracks channel, success, error and cost).

## 2. Mode switching

- A persistent, colour-coded banner sits at the top of every screen. It names the current mode and switches with a single tap. Admin uses one accent colour, Resident uses a clearly different one. Colours are a placeholder, to be set to your brand.
- Only users with `role = MANAGER` see the banner and the Admin mode. A normal RESIDENT never sees the banner and only ever gets the Resident view.
- Switching changes the bottom navigation and the home screen. It does not change permissions. A manager always has admin rights, the toggle only changes which view is on screen.
- The app remembers the last mode used. On a fresh login it opens in Resident mode, since booking is the daily task.

## 3. Resident mode (also what the manager sees in Resident view)

- **Home is the Notices feed.** A bell shows the unread count. Urgent notices are pinned to the top and visually highlighted. Newest first below them. Opening a notice marks it read (sets `readAt` on that recipient row). There is no acknowledgement step.
- The feed shows only notices where this resident is a recipient.
- **Bottom nav:** Home (Notices), Book, My Bookings, Profile.

## 4. Admin mode

- **Bottom nav:** Home (Dashboard), Residents, Messages, Profile.
- **Dashboard:** large stacked cards, one clear job each: "Send a message", "Residents", "Manage bookings", "Block a facility". The last two surface existing admin functions here so the nav stays to four buttons.
- **Residents screen:** a searchable list showing name, apartment, floor (derived), residency type, email, phone and notification preference. Tapping a resident opens a large-field edit form for residency type, contact details, notification preference and fob number. This is how the manager fixes imports, handles move-ins and corrects details by hand.

## 5. Message composer (the core), a four-step wizard

Each step is its own screen with a Back button and a "Step N of 4" hint.

**Step 1, What kind?** Four large buttons: Amenity, Maintenance, Urgent, General. The choice sets the default channels:
- Amenity: in-app only.
- General: in-app only.
- Maintenance: in-app plus email.
- Urgent: in-app plus email plus text.

**Step 2, Who?** Pick one dimension only (single-dimension targeting):
- Everyone
- Tenants (residency type TENANT)
- Owners (OWNER_OCCUPIER and NON_RESIDENT_OWNER combined)
- Owner-occupiers (OWNER_OCCUPIER only)
- By floor
- By apartment

For By floor and By apartment, allow multi-select (tick several floors, or several apartments) with large checkboxes. The residency options and Everyone are single choices.

**Step 3, Message.** A Title (always) and a Message body (always), both large fields. The Title is the headline in the in-app feed and also the email subject, so there is no separate subject step.

**Step 4, Review and send.** A plain summary, for example: "Goes to 42 residents. In-app: all 42. Email: 39 (those who allow email). Text: 27 (those who allow texts and have a mobile). Estimated text cost: $X." The channels are shown as set by the category, with a clear Change control to toggle email or text on or off. A large Send button, then a final confirm.

On send:
1. Create the notice.
2. Resolve the target into the matching users and create a NoticeRecipient row for each. Everyone gets the in-app notice.
3. Send email only to recipients whose notification preference is EMAIL_ONLY or BOTH.
4. Send text only to recipients whose notification preference is SMS_ONLY or BOTH and who have a mobile number.
5. Log each email and text in NotificationLog as BUILDING_MESSAGE.

After sending, show a confirmation, and add the message to a Sent history in Admin mode that the manager can scroll.

**Channel and preference rules (important):** the manager's category and channel choice only decides whether email and text are attempted at all. It never overrides a resident's own preference. A resident set to SMS_ONLY will not get an email even if email is on, and will always still get the in-app notice, so nobody is ever missed.

## 6. Import (run by the manager)

Imported per resident: name, email, apartment number, mobile (optional), residency type (tenant, owner-occupier or non-resident owner) and fob number (optional). Floor is derived, not imported. The import checks that the apartment number is a whole number and the residency type is one of the three allowed values. Anything can be corrected afterwards in the Residents screen.

## 7. Out of scope for v1 (parked, on the record)

- Resident replies. Residents contact the manager directly by his email or phone.
- Urgent read-acknowledgement and any admin-facing read receipts.
- Cross-dimension targeting, for example tenants on one floor only. Single dimension covers real building messages.
- The door-access log integration itself. The fob number is stored now so it is ready.
- Saved message templates.

## Open items

- Brand colours for the two modes.
- Twilio per-text cost, to make the estimate on the review screen accurate.
- Whether multiple fobs per resident are needed, to be decided when the door-log feature is built.
