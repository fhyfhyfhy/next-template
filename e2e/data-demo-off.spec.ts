import { expect, test } from "./test";

// A build and start with the plain commands has no Mock API, so the Data demo
// can only show an explanation. Server requests have no backend URL to go to,
// and sending one would fail the build or the page; the listener below records
// the business requests the browser sends.
const DATA_DEMO_PAGES = [
  "/demos/tasks",
  "/demos/tasks/task-01",
  "/demos/feed",
  "/demos/search",
  "/demos/recent",
  "/demos/lab",
];

test("without the Mock API, Data demo pages show only an explanation and request no business API", async ({
  page,
}) => {
  const businessRequests: string[] = [];
  page.on("request", (request) => {
    const { pathname } = new URL(request.url());
    if (pathname.startsWith("/demo/") || pathname.startsWith("/__mock/")) {
      businessRequests.push(request.url());
    }
  });

  for (const path of DATA_DEMO_PAGES) {
    await page.goto(path);
    await expect(
      page.getByRole("heading", { name: "Mock API 未运行" }),
    ).toBeVisible();
    // eslint-disable-next-line playwright/no-wait-for-timeout -- asserts that no business request is sent for a while after the page hydrates either; the wait is part of the assertion.
    await page.waitForTimeout(300);
  }

  expect(businessRequests).toStrictEqual([]);
});
