# The Residences: Strata Roll (PRD v2)

Plain-language build instructions for Claude Code. No code is included on purpose. Field and model names are given so implementation is unambiguous, but wording and exact schema choices are yours to finalise.

This is v2. It corrects v1 on three points that were wrong or stale: the statutory inspection fees (they changed on 1 July 2025), who is legally responsible for the tenancy notice (the landlord, not the tenant), and the codebase names it referenced. It also adds a recommended default to each open item while leaving the final call flagged.

## Purpose and scope

Add the strata roll, the statutory register of owners, lots and their details required under the Strata Schemes Management Act 2015 (NSW), specifically the content set out in section 178. Three parts:

1. A per-lot record of the statutory fields the Act requires (unit entitlement, insurance, agent, original owner, by-laws), maintained by the manager acting as Secretary.
2. Self-service by residents for the fields they own: contact details, notification preference (already live), and, for owners, lodging the tenancy notice when they lease their lot.
3. An inspection-request workflow so current owners can formally request to see the roll, with the prescribed fee and response arrangement the Act sets out.

Legal note worth stating up front: from 11 June 2024, records an owners corporation must keep have to be kept electronically for all new records. That makes an in-app roll the compliant path, not just a convenience, and is part of the reason for building this.

This builds on what already exists. `residencyType` (TENANT, OWNER_OCCUPIER, NON_RESIDENT_OWNER) and `fobNumber` are already on the `User` model. The manager already has an admin area under `app/manager/` with a residents list at `app/manager/users`. This PRD extends those rather than replacing them.

## Design principles

Same as the rest of the app: large tap targets, mobile first, plain language, one decision per screen. This is a plain-English register a volunteer Secretary can keep current from a phone, not a bookkeeping tool for a professional strata manager.

## 1. Data model changes (prisma/schema.prisma)

**Why a new model instead of more fields on `User`.** Unit entitlement, insurance, agent, original owner and by-laws belong to the lot, not the person. Several residents can share one apartment (the building has multi-resident lots today), so storing lot-level statutory data on `User` would duplicate it per resident and let copies drift out of sync. Keep it on a new lot-level model, keyed by apartment number, with an explicit join to owners rather than an implicit filter, since lots can have co-owners.

**Lot number vs apartment number.** The app's `apartmentNumber` is the everyday unit number people use, and it is not a simple 1 to 65 range. It is floor-based, defined in `lib/apartments.ts` as `VALID_UNITS` (1 to 7 on the ground floor, 101 to 115 on level 1, and so on, 65 lots in total). Floor is derived from it by `getFloorFromApartmentNumber`, never stored. The Act requires the roll to record the lot's actual registered number from the strata plan, which is not guaranteed to match the apartment number. Treat these as two distinct fields on the same row. This is a 1:1 mapping, so it lives on `StrataLot` itself, no separate mapping table.

**Lot-level vs scheme-level data (corrected in v2 after reading s178 in full).** Section 178 separates what is recorded per lot (subsection 1) from what is recorded once for the whole scheme (subsection 2). v1 wrongly put insurance, original owner and by-laws on the per-lot record, which would duplicate building-wide facts across all 65 rows and let them drift. The building carries one insurance policy, one developer, one set of by-laws, one strata plan number. Those belong on a single scheme-level record, not on each lot. So there are now two statutory models plus the ownership join.

**New model, `StrataScheme`** (a single row, the scheme-wide statutory data from s178(2))

- `strataPlanNumber`: the registered strata plan number. Required by s178(2)(a) and missing entirely from v1.
- `buildingAddress`: the address of the strata scheme building. s178(2)(a).
- `originalOwnerName`, `originalOwnerAddress`: the developer and its address for service. s178(2)(b). One per scheme, not per lot.
- `managingAgentName`, `managingAgentAddress`: the strata managing agent and its address for service, if one is ever appointed. s178(2)(b). Currently the volunteer manager acts in that role, so these are usually empty.
- `insurerName`, `policyNumber`, `natureOfRisk`, `sumInsured`, `premiumDueDate`, `lastPaymentDate`: the insurance particulars, exactly the six items s178(2)(d) lists. One policy for the whole building.
- `byLawsReference`: a link or filename to the by-laws in force for the scheme. s178(2)(e). Store the document the same way other building documents are stored; this field points to it.
- `part10Applies`: boolean, only relevant if the scheme was registered before Part 10 of the Strata Schemes Development Act 2015 commenced. s178(2)(f). Likely a fixed known value here, set once.
- `updatedAt`, `updatedByUserId`: audit trail.

**New model, `StrataLot`** (one row per apartment, all 65 pre-seeded from `VALID_UNITS`, holding only the per-lot facts from s178(1))

- `apartmentNumber`: unique, a member of `VALID_UNITS`. This is what the rest of the app already keys on (booking, targeting, floor derivation).
- `lotNumber`: unique, the legal lot number from the registered strata plan. Used on the roll export and anything filed with NSW Fair Trading or an insurer. Confirm the real values before seeding, do not assume `lotNumber = apartmentNumber`.
- `unitEntitlement`: integer, the unit entitlement of this lot. s178(2)(c). A property of the lot as a whole, not split between co-owners. The aggregate unit entitlement the Act also requires is derived by summing all lots, do not store it separately.
- `updatedAt`, `updatedByUserId`: audit trail.

Manager-only. Never editable by a resident. Owner identity, service addresses, agent, mortgagee and tenancy data are all per-holder and live on `LotOwnership` and `User` below, not here, because a lot can have co-owners with different addresses.

**New model, `LotOwnership`** (join table, one row per owner per lot, since lots can have co-owners, and the home for the per-holder fields s178(1) requires)

- `apartmentNumber`: which lot.
- `userId`: the owner's account, which carries the holder's name (s178(1)(a)).
- `addressForService`: the owner's address for service of notices (s178(1)(b)). This can be an Australian postal address or an electronic address including email (s261). Required, and genuinely important here because a `NON_RESIDENT_OWNER` does not live at the apartment, so their service address is not derivable from `apartmentNumber`. v1 had no field for this.
- `australianPostalAddress`: the owner's Australian postal address, and email if held, where not already given as the address for service (s178(1)(c)).
- `agentName`, `agentAddress`: the holder's appointed agent and its address for service, if any (s178(1)(d)). Per owner, not per lot, since co-owners could appoint different agents.
- `mortgageeName`, `mortgageeAddress`: optional (s178(1)(e)). These reach the roll via a strata interest notice from the mortgagee (s22), not from the owner, so treat them as manager-entered on receipt of such a notice rather than owner-editable.
- `possessionDate`: date this owner took possession of their interest. A per-ownership fact, because co-owners can be added at different times.
- `isPrimaryContact`: boolean, which co-owner is the default recipient for notices and correspondence. See the open item on whether that is sufficient for valid service.
- `createdAt`, `endedAt`: `endedAt` is set when an interest ends (sale, removed co-owner), so the roll shows current owners without deleting history. The Act requires records of changes to the roll to be kept for seven years, so never hard-delete these rows.

**User model additions**

- `leaseStartDate`: nullable, only relevant when `residencyType = TENANT`. The date the current lease started, part of what a tenancy notice must contain.
- `landlordUserId`: nullable, link from a TENANT account to the `LotOwnership` owner who is their landlord, if that owner is registered. Useful context on the roll and needed to drive the tenancy-notice flow below.

**Tenancy notice is the landlord's duty (correction from v1).** Under s258 it is the lessor (the owner), or their agent, who must give the tenancy notice to the owners corporation within 14 days of the lease starting, not the tenant. The tenant may lodge it only if the owner fails to. So the primary flow is: an owner marks their lot as leased and supplies the notice details (lot number, tenant name, an address for service which may be email, tenancy start date, and agent name if any). Tenant self-registration is a useful fallback and keeps contact details current, but it does not by itself discharge the owner's legal obligation. Model this as a `TenancyNotice` record (or the equivalent fields on the tenant's `User` row plus `landlordUserId`) that captures who lodged it and when, so the 14-day compliance is visible to the manager.

**New model, `RollInspectionRequest`**

Who may request, in law (s182(1)): an owner, a mortgagee, a covenant chargee, or a person authorised by one of those (a buyer's solicitor or a strata search firm acting under authority). For v1, only current owners can request in-app. Everyone else stays a manual email process, because they need the owner's or corporation's authorisation first (see Out of scope).

Two rules from s182 to build in, not just note: the developer (original owner) is entitled to inspect the strata roll without paying a fee when it is for giving notice of a meeting (s182(4)), so the fee logic needs a zero-fee path, not just the standard fee. And the corporation must never make available anything that would reveal how an owner voted in a secret ballot (s182(5)); that mostly bites on the future AGM voting work, but the roll export and any inspection view must exclude secret-ballot data by construction.

What must be shown on inspection is broader than the roll itself (s182(3)): the roll, insurance policies and the receipt for the last premium, financial statements, the 10-year capital works plan, any managing-agent appointment, and more. v1 only surfaces the roll and its own records; the rest stay a manual process. Say this explicitly so no one assumes the in-app inspection discharges the full s182 obligation.

- `requestedByUserId`: the owner making the request.
- `requestedAt`.
- `scope`: one of `FULL_ROLL`, `FINANCIAL_RECORDS`, `COMMUNICATIONS`, `ALL`.
- `status`: `PENDING`, `SCHEDULED`, `COMPLETED`.
- `scheduledFor`: date/time agreed with, or set by, the manager.
- `feeAmount`: the prescribed fee that applies, read from a single config constant, not hardcoded per request. See the fee note below.
- `fulfilledByUserId`, `completedAt`.

**Fee note (correction from v1).** Do not hardcode "$31 / $16". The inspection fees are prescribed by the Strata Schemes Management Regulation and changed on 1 July 2025: for non-owners the first hour rose to $60 and each further half-hour to $30, and that increase does not apply to existing owners of the scheme. Because v1 requests are owner-only, and the owner position is exactly the one the reform left unchanged, store the current owner-applicable amount in one config constant with the effective date noted next to it, and confirm the live figure against the current Regulation before launch. This keeps a single place to update when the Regulation next moves.

**NotificationLog, NotificationType and per-category settings.** The notification system now spans three channels (email, SMS and push) and has per-user, per-category preferences via the `NotificationSetting` model and the `NotificationCategory` enum, not just the single `notificationPreference` field on `User`. To wire roll notifications in:

- Add `ROLL_INSPECTION_UPDATE` to the `NotificationType` enum, logged in `NotificationLog` like every other send.
- Decide whether roll-inspection updates ride an existing `NotificationCategory` (GENERAL is the natural fit) or get their own category. Recommended default: reuse GENERAL, since adding a category means seeding a `NotificationSetting` row per user. Flagged as a small open item.
- Reuse the existing fan-out in `lib/notifications.ts`. No new channel logic is needed.

## 2. Resident mode

- **Profile and Settings** gains a read-only "My Lot" section: apartment number, lot number, unit entitlement, ownership type (`residencyType`), and this owner's possession date (from their `LotOwnership` row). On a co-owned lot each owner sees their own possession date and can see who else is listed, but cannot edit anyone else's details. All manager-set, not resident-editable.
- **Lease my lot** (owners only): where an owner marks their lot leased and supplies the s258 tenancy-notice details (tenant name, address for service, lease start date, agent if any). This is the owner discharging their legal duty. Recording it timestamps the lodgement so the manager can see the 14-day window was met.
- **Confirm tenancy details** (tenants only): a light prompt at registration to confirm lease start date and contact details. This keeps the roll current and acts as the fallback lodgement if the owner has not done it, but the app should treat the owner's lodgement as the primary one.
- **Request roll access** (owners only): pick a scope (Full roll / Financial records / Communications / All), confirm, and track status (Pending, Scheduled, Completed) with the fee that applies. Plain-language copy explains the fee and that the manager will arrange a time to make the records available.

## 3. Admin mode (under `app/manager/`)

- **Residents screen (`app/manager/users`)** gains a "Roll" view per apartment, a toggle next to the existing contact and residency fields. Per lot it shows and edits the `StrataLot` fields (lot number, unit entitlement) and every `LotOwnership` row: owner, address for service, postal address, agent and mortgagee. Same large-field edit pattern already used for editing resident details. From here the manager can add a co-owner (settlement, a lot moved into joint names), end an interest on sale, and set the primary contact.
- **New "Scheme details" admin screen** for the single `StrataScheme` record: strata plan number, building address, original owner, managing agent, the six insurance fields, and the by-laws reference. This is the scheme-wide statutory data that s178(2) requires once, not per lot, and is edited in one place.
- **New dashboard card, "Roll Requests."** A list of pending, scheduled and completed inspection requests. Tapping one lets the manager set a time (or accept the requester's suggestion), confirm the fee, and mark it complete. Completing a request sends the `ROLL_INSPECTION_UPDATE` notification to the requester.
- **Tenancy compliance view.** Surface, per leased lot, whether a tenancy notice was lodged and by whom, so the manager can chase owners who have not lodged within 14 days.
- **Export.** A button on the Roll view to export the full roll as CSV, for NSW Fair Trading reporting and for handing to an incoming strata manager if one is ever engaged.

## 4. Retention

The roll (`StrataLot` and `LotOwnership` rows, and the roll-relevant `User` fields) is never purged, and change history is kept for at least seven years as the Act requires, which is why `LotOwnership` is closed with `endedAt` rather than deleted. This is different from `NotificationLog` and similar operational data, which can be cleaned on a schedule. `RollInspectionRequest` records follow the same seven-year retention as the app's other communications data.

## 5. Out of scope for v1 (parked, on the record)

- Inspection requests from non-owners (buyers, their solicitor, a strata search firm, a mortgagee or covenant chargee). They are entitled under s182 but need authorisation first, so they stay a manual email process for now.
- By-laws version history or redlining. `byLawsReference` just points at the current document.
- Splitting `unitEntitlement` between co-owners. The Act treats entitlement as a property of the lot, so it is not divided per owner even with co-ownership in scope.
- Electronic seal for sealing documents (permitted under the Regulation, not needed for the roll).
- A distinct "Secretary" role. The manager (`role = MANAGER`) does everything a Secretary would do here. Revisit if the building ever splits those duties.
- Automated levy or payment reconciliation. It matters to the AGM voting work's unfinancial-owner check, not the roll.

## Open items (recommended default given, final call still yours)

- **Notices to co-owners.** Does every co-owner need to receive notices individually, or is `isPrimaryContact` enough and the rest are roll-listed but not messaged? *Recommended default:* message the primary contact plus any co-owner who opts in, and record all co-owners on the roll regardless. Confirm against the Act's service requirements before relying on it, since serving one co-owner may not be valid service on the others.
- **Co-owner voting.** Does a co-owned lot cast one vote as a block, or does each co-owner vote a fractional share? *Recommended default:* one vote per lot, exercised by the primary contact, which is the common practice, but this is a strata-law call that shapes how `LotOwnership` is used in the AGM voting PRD. Resolve it before that PRD assumes either answer.
- **By-laws storage.** Should the by-laws document live in the app's own storage or just be a link? *Recommended default:* store it in the app alongside other building documents so it survives a change of manager, with `byLawsReference` pointing to it.
- **Roll-inspection notification category.** *Recommended default:* reuse the GENERAL `NotificationCategory` rather than adding a new one.
- **Inspection response window.** s182 sets no fixed number of days; the arrangement and any time limit are set by the Regulation, not the Act, so v1 should treat it as an arranged time between owner and manager rather than hardcoding "3 days / 10 days" (v1's figures were unsourced). *Recommended default:* the manager proposes a time when marking the request Scheduled, and the copy says "arranged with the manager". Confirm the current Regulation limit before promising a number.
- **Confirm before build:** the live `lotNumber` values and the `strataPlanNumber` and `buildingAddress` against the registered strata plan; the `part10Applies` value; the current owner-applicable inspection fee against the Regulation Schedule; and whether MANAGER accounts should get two-factor login, given this feature gives that role visibility of the full roll of residents' personal data (see the separate security review, where this is a specific finding).
