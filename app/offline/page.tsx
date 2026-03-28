"use client"

export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="w-20 h-20 bg-indigo-100 rounded-full flex items-center justify-center mx-auto">
          <svg
            className="w-10 h-10 text-indigo-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M18.364 5.636a9 9 0 010 12.728M5.636 5.636a9 9 0 000 12.728M12 9v4m0 4h.01M8.464 8.464a5 5 0 000 7.072M15.536 8.464a5 5 0 010 7.072"
            />
          </svg>
        </div>

        <div>
          <h1 className="text-2xl font-bold text-gray-900">You&apos;re offline</h1>
          <p className="mt-2 text-gray-600">
            No internet connection. Some pages you&apos;ve visited recently may still be available.
          </p>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4 text-left space-y-2">
          <p className="text-sm font-medium text-gray-700">Try these pages:</p>
          <ul className="space-y-1">
            <li>
              <a href="/" className="text-sm text-indigo-600 hover:underline">
                Book Facilities
              </a>
            </li>
            <li>
              <a href="/my-bookings" className="text-sm text-indigo-600 hover:underline">
                My Bookings
              </a>
            </li>
            <li>
              <a href="/queue" className="text-sm text-indigo-600 hover:underline">
                Queue
              </a>
            </li>
          </ul>
        </div>

        <button
          onClick={() => window.location.reload()}
          className="w-full py-3 px-4 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  )
}
