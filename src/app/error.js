'use client';

// App Router catch-all for errors outside the mode panels (header, layout).
// Theme state lives inside the page, so this uses neutral dark styling.
export default function Error({ error, reset }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white p-4">
      <div className="w-full max-w-md rounded-2xl border border-gray-700 bg-gray-800/60 p-8 text-center">
        <h2 className="text-lg font-semibold mb-2">Something went wrong</h2>
        <p className="text-sm text-gray-400 mb-6">
          {error?.message || 'An unexpected error occurred.'}
        </p>
        <button
          onClick={reset}
          className="px-5 py-2.5 rounded-xl text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white transition-all"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
