import { type ReactNode, Suspense } from "react";

import {
  DataDemoHeader,
  MOCK_API_RUNNING,
  MockApiNotice,
} from "@/features/demo-task";
import { ClientMessages } from "@/lib/i18n/client-messages";

/**
 * The shell of the Data demo's pages. When the Mock API isn't running it shows
 * only a notice, and the pages neither render nor send requests.
 */
export default function DataDemoLayout({ children }: { children: ReactNode }) {
  return (
    <ClientMessages namespaces={["demo-task"]}>
      {MOCK_API_RUNNING ? (
        <>
          {/* The nav reads the current path and the badge reads the current
              time when it creates its query; inside Suspense they don't hold
              back prerendering the static shell. */}
          <Suspense
            fallback={
              <div className="h-16.25 border-b border-border bg-card" />
            }
          >
            <DataDemoHeader />
          </Suspense>
          <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
            {children}
          </main>
        </>
      ) : (
        <MockApiNotice />
      )}
    </ClientMessages>
  );
}
