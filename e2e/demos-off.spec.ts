import { expect, test } from "./test";

// A production build serves no demo (lib/demos.ts): proxy.ts answers 404 for
// each, with or without a locale prefix.
const DEMO_PAGES = [
  "/demos",
  "/demos/ui",
  "/demos/tasks",
  "/demos/tasks/task-01",
  "/en/demos",
  "/zh/demos/feed",
];

test("a production build answers 404 for every demo page", async ({
  request,
}) => {
  for (const path of DEMO_PAGES) {
    const response = await request.get(path, { maxRedirects: 0 });
    expect(response.status(), path).toBe(404);
    expect(await response.text(), path).toBe("Not found\n");
  }
});
