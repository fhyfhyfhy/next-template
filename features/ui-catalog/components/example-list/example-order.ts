import type { ExampleMetadata } from "../../types/examples";

/**
 * 示例的展示顺序：先按 `order`（未设为 0），再按 ID。order 相同时比较的是 ID 而不是文件名，
 * 所以 `icon` 排在 `icon-only` 前面，尽管 `icon-only.example.tsx` 的文件名排在 `icon.example.tsx` 前面。
 */
export function compareExamples(
  left: Pick<ExampleMetadata, "order"> & { id: string },
  right: Pick<ExampleMetadata, "order"> & { id: string },
): number {
  return (
    (left.order ?? 0) - (right.order ?? 0) ||
    left.id.localeCompare(right.id, "en")
  );
}
