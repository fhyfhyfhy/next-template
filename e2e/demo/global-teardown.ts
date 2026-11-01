import { MOCK_API_URL } from "./mock-api";

/**
 * When debugging with E2E_REUSE_SERVER=1 against a server you started, the
 * Mock API keeps running along with that server. After the run, restore the
 * seed data, clear the faults and restart the clock, so that it is not left in
 * the state the last test put it in. When the Mock API has already stopped
 * with the e2e's own demo:start, there is nothing to restore, and the failed
 * request does not affect the result.
 */
export default async function globalTeardown() {
  await fetch(`${MOCK_API_URL}/__mock/reset`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ paused: false }),
  }).catch(() => {});
}
