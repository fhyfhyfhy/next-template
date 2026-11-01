import { catalog, type ComponentId } from "../constants/catalog";

/**
 * An invalid or repeated query parameter falls back to the catalog's first
 * component.
 */
export function getComponentId(
  value: string | string[] | undefined,
): ComponentId {
  return catalog.find((item) => item.id === value)?.id ?? catalog[0].id;
}
