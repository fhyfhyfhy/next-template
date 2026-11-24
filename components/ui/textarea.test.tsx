import { createRef } from "react";
import { renderToString } from "react-dom/server";
import { expect, expectTypeOf, test } from "vitest";

import { FieldRoot } from "./field";
import { Textarea } from "./textarea";

test("属性和事件按 textarea 定义，textarea 的属性渲染到元素上", () => {
  const html = renderToString(
    <Textarea
      ref={createRef<HTMLTextAreaElement>()}
      rows={3}
      wrap="hard"
      defaultValue="项目简介"
      onChange={(event) => {
        expectTypeOf(event.currentTarget).toExtend<HTMLTextAreaElement>();
      }}
      onValueChange={(value) => {
        expectTypeOf(value).toEqualTypeOf<string>();
      }}
    />,
  );

  expect(html).toMatch(/^<textarea /);
  expect(html).toContain('rows="3"');
  expect(html).toContain('wrap="hard"');
  expect(html).toContain("项目简介</textarea>");
});

test("函数形式的 className 按 Field 状态求值", () => {
  const className = (state: { disabled: boolean }) =>
    state.disabled ? "italic" : undefined;
  const classOf = (html: string) => /class="([^"]*)"/.exec(html)?.[1];

  expect(
    classOf(renderToString(<Textarea disabled className={className} />)),
  ).toContain("italic");
  expect(
    classOf(renderToString(<Textarea className={className} />)),
  ).not.toContain("italic");
});

test("字段无效时 aria-invalid 以 Field 为准，调用方的 aria-describedby 保留", () => {
  // FieldDescription 在 layout effect 里登记 id，服务端渲染时还没有。调用方的 id 和说明 id 的合并只有在浏览器里
  // 才看得到，目前没有测试。
  const html = renderToString(
    <FieldRoot invalid>
      <Textarea aria-describedby="hint" aria-invalid={false} />
    </FieldRoot>,
  );

  expect(html).toContain('aria-describedby="hint"');
  expect(html).toContain('aria-invalid="true"');
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
