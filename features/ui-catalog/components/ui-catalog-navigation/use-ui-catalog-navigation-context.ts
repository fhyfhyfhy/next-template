import { use } from "react";

import { UiCatalogNavigationContext } from "./context";

export function useUiCatalogNavigationContext() {
  const context = use(UiCatalogNavigationContext);
  if (!context) {
    throw new Error(
      "UI catalog navigation must be inside <UiCatalogNavigation>",
    );
  }
  return context;
}
