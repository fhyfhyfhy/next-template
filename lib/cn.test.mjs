import { expect, test } from "vitest";

import { cn } from "./cn.ts";

test("the custom overlay blur and the built-in blurs override each other, the last class passed winning", () => {
  for (const prefix of ["blur", "backdrop-blur"]) {
    for (const value of ["sm", "md", "none", "[6px]", "(--custom-blur)"]) {
      expect(cn(`${prefix}-overlay`, `${prefix}-${value}`)).toBe(
        `${prefix}-${value}`,
      );
      expect(cn(`${prefix}-${value}`, `${prefix}-overlay`)).toBe(
        `${prefix}-overlay`,
      );
    }
  }
});

test("control sizes and built-in height classes override each other in the order passed, state functions included", () => {
  for (const prefix of ["h", "min-h"]) {
    for (const size of ["sm", "md", "lg"]) {
      const custom = `${prefix}-control-${size}`;
      const builtin = `${prefix}-6`;
      for (const [base, override] of [
        [custom, builtin],
        [builtin, custom],
      ]) {
        expect(cn(base, override)).toBe(override);
        const classes = cn(base, (state) =>
          state.active ? override : undefined,
        );
        expect(classes({ active: false })).toBe(base);
        expect(classes({ active: true })).toBe(override);
      }
    }
  }
});

test("the project's radii and built-in radii override each other in the order passed, state functions included", () => {
  for (const custom of ["rounded-control", "rounded-panel"]) {
    for (const [base, override] of [
      ["rounded-full", custom],
      [custom, "rounded-full"],
    ]) {
      expect(cn(base, override)).toBe(override);
      const classes = cn(base, (state) =>
        state.checked ? override : undefined,
      );
      expect(classes({ checked: false })).toBe(base);
      expect(classes({ checked: true })).toBe(override);
    }
  }
});

test("the project's shadow size and built-in and arbitrary-value shadows override each other in the order passed", () => {
  for (const shadow of [
    "shadow-none",
    "shadow-sm",
    "shadow-[0_2px_4px_#0006]",
  ]) {
    expect(cn("shadow-popover", shadow)).toBe(shadow);
    expect(cn(shadow, "shadow-popover")).toBe("shadow-popover");
  }
});

test("the project's shadow can be overridden under the same state, and shadows under different states stay independent", () => {
  for (const prefix of ["hover:", "dark:", "data-open:"]) {
    expect(cn(`${prefix}shadow-popover`, `${prefix}shadow-none`)).toBe(
      `${prefix}shadow-none`,
    );
    expect(cn(`${prefix}shadow-none`, `${prefix}shadow-popover`)).toBe(
      `${prefix}shadow-popover`,
    );
    expect(cn("shadow-popover", `${prefix}shadow-none`)).toBe(
      `shadow-popover ${prefix}shadow-none`,
    );
  }
  expect(cn("hover:shadow-popover", "focus:shadow-none")).toBe(
    "hover:shadow-popover focus:shadow-none",
  );
});

test("a state function overrides the project's shadow both ways, and leaves it as it is when its condition does not hold", () => {
  for (const [base, override] of [
    ["shadow-popover", "shadow-none"],
    ["shadow-sm", "shadow-popover"],
  ]) {
    const classes = cn(base, (state) => (state.open ? override : undefined));
    expect(classes({ open: false })).toBe(base);
    expect(classes({ open: true })).toBe(override);
  }
});

test("the project's shadow size coexists with a shadow color, and the color under the same state can still be overridden alone", () => {
  for (const prefix of ["", "hover:"]) {
    expect(cn(`${prefix}shadow-popover`, `${prefix}shadow-red-500`)).toBe(
      `${prefix}shadow-popover ${prefix}shadow-red-500`,
    );
    expect(cn(`${prefix}shadow-primary`, `${prefix}shadow-popover`)).toBe(
      `${prefix}shadow-primary ${prefix}shadow-popover`,
    );
  }
  expect(cn("shadow-popover shadow-red-500", "shadow-primary")).toBe(
    "shadow-popover shadow-primary",
  );
});

test("the overlay color and blur can be customized separately, and element blur and backdrop blur do not override each other", () => {
  expect(
    cn("bg-overlay backdrop-blur-overlay", "bg-transparent backdrop-blur-none"),
  ).toBe("bg-transparent backdrop-blur-none");
  expect(cn("blur-overlay", "backdrop-blur-overlay")).toBe(
    "blur-overlay backdrop-blur-overlay",
  );
});

test("the overlay blur can be overridden under the same state, and different states stay independent", () => {
  expect(
    cn(
      "backdrop-blur-overlay hover:backdrop-blur-overlay",
      "hover:backdrop-blur-none",
    ),
  ).toBe("backdrop-blur-overlay hover:backdrop-blur-none");
});

test("plain arguments keep the conditional, array and object forms, and return the merged string", () => {
  expect(
    cn("px-3 text-sm", false, ["px-6"], { "text-lg": true, hidden: false }),
  ).toBe("px-6 text-lg");
  expect(cn("px-3")).toBe("px-3");
  expect(cn()).toBe("");
});

test("a function className receives the original state, and every evaluation keeps the caller's overrides", () => {
  const received = [];
  const classes = cn("bg-white px-3", (state) => {
    received.push(state);
    return state.checked ? "bg-black px-6" : undefined;
  });
  const unchecked = { checked: false };
  const checked = { checked: true };
  expect(classes(unchecked)).toBe("bg-white px-3");
  expect(classes(checked)).toBe("bg-black px-6");
  expect(received).toStrictEqual([unchecked, checked]);
});

test("both a string and a state function can override the project's custom overlay blur", () => {
  expect(cn("backdrop-blur-overlay", "backdrop-blur-none")).toBe(
    "backdrop-blur-none",
  );
  const classes = cn("backdrop-blur-overlay", (state) =>
    state.open ? "backdrop-blur-md" : undefined,
  );
  expect(classes({ open: true })).toBe("backdrop-blur-md");
  expect(classes({ open: false })).toBe("backdrop-blur-overlay");
});
