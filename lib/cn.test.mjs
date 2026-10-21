import assert from "node:assert/strict";
import test from "node:test";

import { cn } from "./cn.ts";

test("自定义遮罩模糊与内置模糊互相覆盖，以最后传入的类为准", () => {
  for (const prefix of ["blur", "backdrop-blur"]) {
    for (const value of ["sm", "md", "none", "[6px]", "(--custom-blur)"]) {
      assert.equal(
        cn(`${prefix}-overlay`, `${prefix}-${value}`),
        `${prefix}-${value}`,
      );
      assert.equal(
        cn(`${prefix}-${value}`, `${prefix}-overlay`),
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
        assert.equal(cn(base, override), override);
        const classes = cn(base, (state) =>
          state.active ? override : undefined,
        );
        assert.equal(classes({ active: false }), base);
        assert.equal(classes({ active: true }), override);
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
      assert.equal(cn(base, override), override);
      const classes = cn(base, (state) =>
        state.checked ? override : undefined,
      );
      assert.equal(classes({ checked: false }), base);
      assert.equal(classes({ checked: true }), override);
    }
  }
});

test("项目阴影尺寸与内置及任意值阴影按传入顺序互相覆盖", () => {
  for (const shadow of [
    "shadow-none",
    "shadow-sm",
    "shadow-[0_2px_4px_#0006]",
  ]) {
    assert.equal(cn("shadow-popover", shadow), shadow);
    assert.equal(cn(shadow, "shadow-popover"), "shadow-popover");
  }
});

test("相同状态下可覆盖项目阴影，不同状态的阴影保持独立", () => {
  for (const prefix of ["hover:", "dark:", "data-open:"]) {
    assert.equal(
      cn(`${prefix}shadow-popover`, `${prefix}shadow-none`),
      `${prefix}shadow-none`,
    );
    assert.equal(
      cn(`${prefix}shadow-none`, `${prefix}shadow-popover`),
      `${prefix}shadow-popover`,
    );
    assert.equal(
      cn("shadow-popover", `${prefix}shadow-none`),
      `shadow-popover ${prefix}shadow-none`,
    );
  }
  assert.equal(
    cn("hover:shadow-popover", "focus:shadow-none"),
    "hover:shadow-popover focus:shadow-none",
  );
});

test("状态函数可以双向覆盖项目阴影，并在条件不满足时保留原样", () => {
  for (const [base, override] of [
    ["shadow-popover", "shadow-none"],
    ["shadow-sm", "shadow-popover"],
  ]) {
    const classes = cn(base, (state) => (state.open ? override : undefined));
    assert.equal(classes({ open: false }), base);
    assert.equal(classes({ open: true }), override);
  }
});

test("项目阴影尺寸与阴影颜色共存，同状态颜色仍可单独覆盖", () => {
  for (const prefix of ["", "hover:"]) {
    assert.equal(
      cn(`${prefix}shadow-popover`, `${prefix}shadow-red-500`),
      `${prefix}shadow-popover ${prefix}shadow-red-500`,
    );
    assert.equal(
      cn(`${prefix}shadow-primary`, `${prefix}shadow-popover`),
      `${prefix}shadow-primary ${prefix}shadow-popover`,
    );
  }
  assert.equal(
    cn("shadow-popover shadow-red-500", "shadow-primary"),
    "shadow-popover shadow-primary",
  );
});

test("遮罩颜色和模糊可分别定制，元素模糊与背景模糊互不覆盖", () => {
  assert.equal(
    cn("bg-overlay backdrop-blur-overlay", "bg-transparent backdrop-blur-none"),
    "bg-transparent backdrop-blur-none",
  );
  assert.equal(
    cn("blur-overlay", "backdrop-blur-overlay"),
    "blur-overlay backdrop-blur-overlay",
  );
});

test("相同状态下的遮罩模糊可覆盖，不同状态保持独立", () => {
  assert.equal(
    cn(
      "backdrop-blur-overlay hover:backdrop-blur-overlay",
      "hover:backdrop-blur-none",
    ),
    "backdrop-blur-overlay hover:backdrop-blur-none",
  );
});

test("普通参数保留条件、数组和对象用法，并返回合并后的字符串", () => {
  assert.equal(
    cn("px-3 text-sm", false, ["px-6"], { "text-lg": true, hidden: false }),
    "px-6 text-lg",
  );
  assert.equal(cn("px-3"), "px-3");
  assert.equal(cn(), "");
});

test("函数式 className 收到原始 state，每次求值都保留调用方的覆盖", () => {
  const received = [];
  const classes = cn("bg-white px-3", (state) => {
    received.push(state);
    return state.checked ? "bg-black px-6" : undefined;
  });
  const unchecked = { checked: false };
  const checked = { checked: true };
  assert.equal(classes(unchecked), "bg-white px-3");
  assert.equal(classes(checked), "bg-black px-6");
  assert.deepEqual(received, [unchecked, checked]);
});

test("字符串和状态函数都能覆盖项目自定义的遮罩模糊", () => {
  assert.equal(
    cn("backdrop-blur-overlay", "backdrop-blur-none"),
    "backdrop-blur-none",
  );
  const classes = cn("backdrop-blur-overlay", (state) =>
    state.open ? "backdrop-blur-md" : undefined,
  );
  assert.equal(classes({ open: true }), "backdrop-blur-md");
  assert.equal(classes({ open: false }), "backdrop-blur-overlay");
});
