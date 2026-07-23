self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {}

  event.waitUntil(
    self.registration.showNotification(data.title || 'The Watertower', {
      body: data.body || '',
      icon: data.icon || '/api/icons/192',
      badge: data.badge || '/api/icons/192',
      tag: data.tag,
      actions: data.actions || [],
      data: { url: data.url || '/', bookingId: data.bookingId },
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const { url, bookingId } = event.notification.data || {}

  // "Keep it" needs no follow-up — the booking already stands as-is.
  if (event.action === 'keep') return

  if (event.action === 'cancel' && bookingId) {
    event.waitUntil(
      fetch(`/api/bookings/${bookingId}`, { method: 'DELETE' })
        .then((res) =>
          self.registration.showNotification(
            res.ok ? 'Booking cancelled' : "Couldn't cancel booking",
            {
              body: res.ok
                ? 'Your slot has been freed up for the next person.'
                : 'Open the app to manage it from My Bookings.',
              icon: '/api/icons/192',
              badge: '/api/icons/192',
              tag: 'booking-cancel-result',
            }
          )
        )
        .catch(() =>
          self.registration.showNotification("Couldn't cancel booking", {
            body: 'Open the app to manage it from My Bookings.',
            icon: '/api/icons/192',
            badge: '/api/icons/192',
            tag: 'booking-cancel-result',
          })
        )
    )
    return
  }

  // Plain tap (no action button — e.g. iOS/Safari, which doesn't support them)
  // falls back to opening the same Keep/Cancel page linked in the email.
  event.waitUntil(self.clients.openWindow(url || '/'))
})
