import { NextIntlClientProvider } from "next-intl";
import { renderToString } from "react-dom/server";
import { expect, test } from "vitest";

import { DateTime } from "./date-time";

// The browser's side, the time in the computer's time zone once the page has
// hydrated, is e2e/demo/date-time.spec.ts's.
test("the server renders the <time> element with the moment and no text", () => {
  const html = renderToString(
    <NextIntlClientProvider locale="en" timeZone="Asia/Shanghai" messages={{}}>
      <DateTime
        value={Date.UTC(2026, 9, 1)}
        format={{ dateStyle: "medium", timeStyle: "short" }}
      />
    </NextIntlClientProvider>,
  );
  expect(html).toMatch(
    /^<time dateTime="2026-10-01T00:00:00.000Z" class="[^"]*"><\/time>$/,
  );
});
