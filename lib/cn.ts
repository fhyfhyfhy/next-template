import { createCn } from "cn/config";

const mergeClasses = createCn({
  extend: {
    theme: {
      animate: ["progress-indeterminate"],
      blur: ["overlay"],
      radius: ["control", "panel"],
      shadow: ["popover"],
      spacing: ["control-sm", "control-md", "control-lg"],
    },
  },
});

// 不用 cn 包的 ClassValue：它的对象写法是 [id: string]: any，函数也能赋给它，函数式 className 放错位置时
// tsc 不报、运行时被丢掉。这里的对象写法用 Record<string, unknown>，函数传进来就是类型错误。
type ClassDictionary = Record<string, unknown>;
type ClassArray = ClassValue[];
type ClassValue =
  | ClassArray
  | ClassDictionary
  | string
  | number
  | bigint
  | boolean
  | null
  | undefined;

type StateClassName<State> = (state: State) => string | undefined;

/** 按项目主题合并样式；函数式 className 只能作为第二个也是最后一个参数，收到组件 state 后求值。 */
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
