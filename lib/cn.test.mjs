import { expect, test } from "vitest";

import { cn } from "./cn.ts";

test("自定义遮罩模糊与内置模糊互相覆盖，以最后传入的类为准", () => {
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

test("控件尺寸与内置高度类按传入顺序互相覆盖，支持状态函数", () => {
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

test("项目圆角与内置圆角按传入顺序互相覆盖，支持状态函数", () => {
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

test("项目阴影尺寸与内置及任意值阴影按传入顺序互相覆盖", () => {
  for (const shadow of [
    "shadow-none",
    "shadow-sm",
    "shadow-[0_2px_4px_#0006]",
  ]) {
    expect(cn("shadow-popover", shadow)).toBe(shadow);
    expect(cn(shadow, "shadow-popover")).toBe("shadow-popover");
  }
});

test("相同状态下可覆盖项目阴影，不同状态的阴影保持独立", () => {
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

test("状态函数可以双向覆盖项目阴影，并在条件不满足时保留原样", () => {
  for (const [base, override] of [
    ["shadow-popover", "shadow-none"],
    ["shadow-sm", "shadow-popover"],
  ]) {
    const classes = cn(base, (state) => (state.open ? override : undefined));
    expect(classes({ open: false })).toBe(base);
    expect(classes({ open: true })).toBe(override);
  }
});

test("项目阴影尺寸与阴影颜色共存，同状态颜色仍可单独覆盖", () => {
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

test("遮罩颜色和模糊可分别定制，元素模糊与背景模糊互不覆盖", () => {
  expect(
    cn("bg-overlay backdrop-blur-overlay", "bg-transparent backdrop-blur-none"),
  ).toBe("bg-transparent backdrop-blur-none");
  expect(cn("blur-overlay", "backdrop-blur-overlay")).toBe(
    "blur-overlay backdrop-blur-overlay",
  );
});

test("相同状态下的遮罩模糊可覆盖，不同状态保持独立", () => {
  expect(
    cn(
      "backdrop-blur-overlay hover:backdrop-blur-overlay",
      "hover:backdrop-blur-none",
    ),
  ).toBe("backdrop-blur-overlay hover:backdrop-blur-none");
});

test("普通参数保留条件、数组和对象用法，并返回合并后的字符串", () => {
  expect(
    cn("px-3 text-sm", false, ["px-6"], { "text-lg": true, hidden: false }),
  ).toBe("px-6 text-lg");
  expect(cn("px-3")).toBe("px-3");
  expect(cn()).toBe("");
});

test("函数式 className 收到原始 state，每次求值都保留调用方的覆盖", () => {
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

test("字符串和状态函数都能覆盖项目自定义的遮罩模糊", () => {
  expect(cn("backdrop-blur-overlay", "backdrop-blur-none")).toBe(
    "backdrop-blur-none",
  );
  const classes = cn("backdrop-blur-overlay", (state) =>
    state.open ? "backdrop-blur-md" : undefined,
  );
  expect(classes({ open: true })).toBe("backdrop-blur-md");
  expect(classes({ open: false })).toBe("backdrop-blur-overlay");
});
