import { createContext, type TransitionStartFunction } from "react";

export interface UiCatalogNavigationValue {
  isPending: boolean;
  startTransition: TransitionStartFunction;
}

export const UiCatalogNavigationContext =
  createContext<UiCatalogNavigationValue | null>(null);
