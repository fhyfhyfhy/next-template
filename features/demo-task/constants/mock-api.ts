/**
 * The demo:* commands (scripts/run-next.mjs --demo) set
 * `NEXT_PUBLIC_MOCK_API=1` when they start the Mock API, and the build inlines
 * it. When false, the app runs under a plain command, possibly against a real
 * backend, and the Data demo must send no requests. A notice from the layout
 * isn't enough: Next renders the layout and the page in parallel, so the page's
 * server reads still run when the layout doesn't render children (a build would
 * request the real backend and fail). So every entry point of a server read,
 * the Server Components that send requests and generateMetadata, checks this
 * first. Server Actions can be called directly, so each one calls
 * `assertMockApiRunning` first. Queries in the browser aren't affected: an
 * unmounted page sends none.
 */
export const MOCK_API_RUNNING = process.env.NEXT_PUBLIC_MOCK_API === "1";
