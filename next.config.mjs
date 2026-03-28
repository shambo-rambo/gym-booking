import withPWAInit from "@ducanh2912/next-pwa"

const withPWA = withPWAInit({
  dest: "public",
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  disable: false,
  workboxOptions: {
    disableDevLogs: true,
    // Cache the availability API responses for 5 minutes (stale-while-revalidate)
    runtimeCaching: [
      {
        urlPattern: /^\/api\/bookings\/availability/,
        handler: "StaleWhileRevalidate",
        options: {
          cacheName: "availability-cache",
          expiration: {
            maxEntries: 50,
            maxAgeSeconds: 5 * 60,
          },
        },
      },
      {
        urlPattern: /^\/api\/bookings\/my-bookings/,
        handler: "StaleWhileRevalidate",
        options: {
          cacheName: "my-bookings-cache",
          expiration: {
            maxEntries: 10,
            maxAgeSeconds: 5 * 60,
          },
        },
      },
      {
        urlPattern: /^\/api\/queue\/my-queues/,
        handler: "StaleWhileRevalidate",
        options: {
          cacheName: "my-queues-cache",
          expiration: {
            maxEntries: 10,
            maxAgeSeconds: 60,
          },
        },
      },
    ],
  },
})

/** @type {import('next').NextConfig} */
const nextConfig = {}

export default withPWA(nextConfig)
