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

/** Merges classes by the project's theme; a function className is evaluated once it gets the component's state. */
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
