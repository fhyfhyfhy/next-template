import { catalog, type ComponentId } from "../constants/catalog";

/** 无效或重复的查询参数回到目录中的第一个组件。 */
export function getComponentId(
  value: string | string[] | undefined,
): ComponentId {
  return catalog.find((item) => item.id === value)?.id ?? catalog[0].id;
}
