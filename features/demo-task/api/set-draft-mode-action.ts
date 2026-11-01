"use server";

import { draftMode } from "next/headers";
import { z } from "zod";

import { assertMockApiRunning } from "../utils/assert-mock-api-running";

/**
 * Turns Draft Mode on or off for the current browser. While on, this browser's
 * requests skip `use cache`: each runs again and nothing is written to the
 * cache. Other visitors are unaffected. The Draft Mode cookie applies to the
 * whole site, so it may be turned on only in demo mode: against a real backend,
 * any visitor could use it to bypass the cache and put every request on the
 * backend. The switch writes a cookie, and writing a cookie in a Server Action
 * refreshes the current page and invalidates the client's prefetches, so pages
 * visited earlier don't reuse results from before the switch
 * (.agents/skills/next-data-flow/framework-notes.md § Server Action
 * invalidation).
 */
export async function setDraftModeAction(enabled: boolean) {
  assertMockApiRunning();
  const draft = await draftMode();
  if (z.boolean().parse(enabled)) {
    draft.enable();
  } else {
    draft.disable();
  }
}
