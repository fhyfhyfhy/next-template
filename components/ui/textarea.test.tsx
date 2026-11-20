import { createRef } from "react";
import { renderToString } from "react-dom/server";
import { expect, expectTypeOf, test } from "vitest";

import { Textarea } from "./textarea";

test("属性和事件按 textarea 定义，textarea 的属性渲染到元素上", () => {
  const html = renderToString(
    <Textarea
      ref={createRef<HTMLTextAreaElement>()}
      rows={3}
      wrap="hard"
      defaultValue="项目简介"
      className={(state) => (state.disabled ? "opacity-50" : undefined)}
      onChange={(event) => {
        expectTypeOf(event.currentTarget).toExtend<HTMLTextAreaElement>();
      }}
      onValueChange={(value) => {
        expectTypeOf(value).toEqualTypeOf<string>();
      }}
    />,
  );

  expect(html).toMatch(/^<textarea [^>]*rows="3"[^>]*wrap="hard"/);
  expect(html).toContain("项目简介</textarea>");
});

test("input 才有的属性是类型错误", () => {
  // 一个元素上多余的属性 TypeScript 只报第一个，所以每个属性各占一个元素。
  const html = renderToString(
    <>
      {/* @ts-expect-error accept 只属于 input */}
      <Textarea accept="image/*" />
      {/* @ts-expect-error pattern 只属于 input */}
      <Textarea pattern="[a-z]+" />
      {/* @ts-expect-error min 只属于 input */}
      <Textarea min={1} />
      {/* @ts-expect-error multiple 只属于 input */}
      <Textarea multiple />
      {/* @ts-expect-error size 只属于 input */}
      <Textarea size={10} />
    </>,
  );

  expect(html.match(/<textarea /g)).toHaveLength(5);
});
