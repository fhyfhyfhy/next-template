/**
 * 参数面板里每个控件的标签，几种控件并排时看起来一致。TextControl 的 FieldLabel 和 OptionControl 的 SelectLabel
 * 会留下 labelVariants 里这里没覆盖的 class，所以这里要覆盖它的每一个 class（control-label.test.ts 检查）。
 */
export const CONTROL_LABEL_CLASS =
  "font-mono text-xs font-normal text-muted-foreground";
