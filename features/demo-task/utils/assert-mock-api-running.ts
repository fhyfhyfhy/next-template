import { MOCK_API_RUNNING } from "../constants/mock-api";

/**
 * Every Data demo Server Action calls this first. An action is a server entry
 * point anyone can POST to directly, which a page showing only a notice doesn't
 * stop; without the check, the Demo's writes under a plain command would go to
 * the project's real backend.
 */
export function assertMockApiRunning() {
  if (!MOCK_API_RUNNING) {
    throw new Error(
      "The Data demo runs only against the Mock API; start it with pnpm demo:dev",
    );
  }
}
