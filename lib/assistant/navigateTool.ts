import Anthropic from "@anthropic-ai/sdk"

export const RESIDENT_PAGES: Record<string, string> = {
  "/": "Home",
  "/book": "Book",
  "/my-bookings": "My Bookings",
  "/settings": "Profile Settings",
  "/settings/notifications": "Notification Settings",
  "/rules": "Booking Rules",
}

export const ADMIN_PAGES: Record<string, string> = {
  "/manager": "Manager Dashboard",
  "/manager/messages": "Send a Message",
  "/manager/users": "Residents",
  "/manager/qr-code": "Registration QR Code",
  "/manager/bookings": "All Bookings",
  "/manager/blocked-slots": "Blocked Slots",
}

export function pagesForRole(isManager: boolean): Record<string, string> {
  return isManager ? { ...RESIDENT_PAGES, ...ADMIN_PAGES } : RESIDENT_PAGES
}

// Real step-by-step instructions per page, used as a fallback when the model
// replies with only the navigate button and no explanatory text — a generic
// "You can do that from X" line isn't actually useful, so this guarantees a
// real answer regardless of what the model does.
export const PAGE_HOWTO: Record<string, string> = {
  "/": "Open Home from the bottom menu to see building notices and announcements from the manager.",
  "/book": "Tap Book in the bottom menu. Choose Gym, Sauna, or Library using the tabs at the top. For Gym or Sauna, pick a day, then tap an available timeslot — you'll be able to choose a Shared spot or book the whole facility Exclusively, then confirm. For Library, pick a date and a start/end time and confirm.",
  "/my-bookings": "Open My Bookings from the bottom menu to see all your upcoming bookings and queue entries, and cancel any of them from there.",
  "/settings": "Tap your profile icon (top right), then Settings, to update your name, email, password, or notification preference.",
  "/settings/notifications": "Tap your profile icon (top right), then Notifications, to choose which categories of message you receive and how (email or SMS).",
  "/rules": "Tap your profile icon (top right), then Booking Rules, for the full list of booking limits and rules.",
  "/manager": "Tap the mode pill (top right) to switch to Admin, which opens the Manager Dashboard.",
  "/manager/messages": "From the Manager Dashboard, tap Send a message. Pick a category, choose who should receive it, write your message, then review and send.",
  "/manager/users": "From the Manager Dashboard, tap Residents to verify new sign-ups, edit resident details, or bulk-import residents. To remove a resident who's moved out, there's no hard delete — open their account here and deactivate it instead: this revokes their access, moves them to the Deactivated tab, and frees up their apartment's resident slot. To undo this (they move back in, or it was a mistake), open the Deactivated tab and tap Reactivate on their account — it restores their access with their existing login.",
  "/manager/qr-code": "From the Residents page, tap Registration QR to open the printable QR code new residents can scan to self-register.",
  "/manager/bookings": "From the Manager Dashboard, tap Manage bookings to see every booking in the building and cancel any of them on a resident's behalf.",
  "/manager/blocked-slots": "From the Manager Dashboard, tap Block a facility to close the gym or sauna for maintenance, as a one-off or recurring block.",
}

// A single, always-present element to spotlight after navigating here from the
// chat — deterministic (server-picked), not model-chosen, same reasoning as
// PAGE_HOWTO. Only pages with one clear "start here" target get an entry;
// pages without one just navigate normally, no highlight.
export const PAGE_HIGHLIGHT: Record<string, string> = {
  "/book": "book-amenity-tabs",
  "/manager": "manager-dashboard-cards",
  "/manager/messages": "message-category",
  "/manager/users": "residents-tabs",
  "/manager/bookings": "bookings-filters",
  "/manager/blocked-slots": "blocked-slots-add-button",
}

export function buildNavigateTool(isManager: boolean): Anthropic.Tool {
  const pages = pagesForRole(isManager)

  return {
    name: "navigate",
    description:
      "Suggest navigating the user to a specific page in the app when it would help them act on your answer. Only use one of the listed pages. Still write a short text answer alongside this — don't rely on the button alone.",
    input_schema: {
      type: "object",
      properties: {
        page: {
          type: "string",
          enum: Object.keys(pages),
          description: "The app page path to suggest.",
        },
      },
      required: ["page"],
    },
  }
}
