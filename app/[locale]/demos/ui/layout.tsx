import type { ReactNode } from "react";

import { ClientMessages } from "@/lib/i18n-client-messages";

export default function UiDemoLayout({ children }: { children: ReactNode }) {
  return <ClientMessages namespaces={["demo-ui"]}>{children}</ClientMessages>;
}
