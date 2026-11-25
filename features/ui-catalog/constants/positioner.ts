/**
 * 预览里给 Base UI 定位层（Select、Menu、Popover、Tooltip、Combobox 的 Positioner）提供的 `side` 和 `align` 选项。
 * playground 的 config 仍各自写字面量联合类型，保持单独可复制（.claude/rules/ui-catalog.md）。
 */
export const SIDES = ["top", "bottom", "left", "right"] as const;

export const ALIGNS = ["start", "center", "end"] as const;
