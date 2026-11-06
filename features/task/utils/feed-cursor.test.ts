import { expect, test } from "vitest";

import { decodeFeedCursor, encodeFeedCursor } from "./feed-cursor";

test("游标编码后能还原出创建时间和 id，id 里带点和连字符也一样", () => {
  const cursor = { createdAt: 1790881200000, id: "task-01.v2_x" };
  expect(decodeFeedCursor(encodeFeedCursor(cursor))).toStrictEqual(cursor);
});

test("解析不了的游标返回 null", () => {
  expect(decodeFeedCursor("")).toBeNull();
  expect(decodeFeedCursor("abc")).toBeNull();
  expect(decodeFeedCursor("123.")).toBeNull();
});
