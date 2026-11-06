import type { ReactNode } from "react";

import { ClientMessages } from "@/lib/i18n/client-messages";

export default function UiCatalogLayout({ children }: { children: ReactNode }) {
  return (
    <ClientMessages namespaces={["ui-catalog"]}>{children}</ClientMessages>
  );
}
