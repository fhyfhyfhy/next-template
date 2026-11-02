import type { ClassValue } from "cn";
import { createCn } from "cn/config";

const mergeClasses = createCn({
  extend: {
    theme: {
      blur: ["overlay"],
      radius: ["control", "panel"],
      shadow: ["popover"],
      spacing: ["control-sm", "control-md", "control-lg"],
    },
  },
});

type StateClassName<State> = (state: State) => string | undefined;

/** 按项目主题合并样式；函数式 className 在收到组件 state 后求值。 */
export function cn(base: ClassValue, className?: string): string;
export function cn<State>(
  base: ClassValue,
  className: StateClassName<State>,
): (state: State) => string;
export function cn<State>(
  base: ClassValue,
  className: string | StateClassName<State> | undefined,
): string | ((state: State) => string);
export function cn(...inputs: ClassValue[]): string;
export function cn<State>(
  base?: ClassValue,
  className?: ClassValue | StateClassName<State>,
  ...inputs: ClassValue[]
) {
  if (typeof className === "function" && inputs.length === 0) {
    return (state: State) => mergeClasses(base, className(state), ...inputs);
  }
  return mergeClasses(base, className, ...inputs);
}
