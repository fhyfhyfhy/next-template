import { describe, expect, test } from "vitest";

import { type InfiniteData, QueryClient } from "@/lib/react-query";

import type { FeedPage, Task, TaskPage } from "../types/task";
import {
  insertTaskIntoPage,
  removeTaskFromLists,
  removeTaskFromPage,
  restoreTaskLists,
  setTaskInLists,
  snapshotTaskLists,
} from "./task-list-cache";

function makeTask(id: string, createdAt: number): Task {
  return {
    id,
    name: id,
    prompt: "",
    status: "done",
    progress: 100,
    favorite: false,
    coverUrl: null,
    createdAt,
    updatedAt: createdAt,
  };
}

function makePage(items: Task[], fields: Partial<TaskPage> = {}): TaskPage {
  return {
    items,
    total: items.length,
    hasMore: false,
    page: 1,
    pageSize: 50,
    ...fields,
  };
}

const a = makeTask("a", 300);
const b = makeTask("b", 200);
const c = makeTask("c", 100);

const listKey = ["list"] as const;
const pageKey = [...listKey, { pageSize: 2 }] as const;
const feedKey = [...listKey, "infinite"] as const;
const searchKey = [...listKey, "search", { term: "b" }] as const;
const detailKey = ["detail", "b"] as const;

/** 三种列表形态各放一份，外加一个不在列表前缀下的详情。 */
function seedLists() {
  const client = new QueryClient();
  client.setQueryData(
    pageKey,
    makePage([a, b], { total: 3, hasMore: true, pageSize: 2 }),
  );
  client.setQueryData(feedKey, {
    pages: [
      { items: [a], nextCursor: "a" },
      { items: [b, c], nextCursor: null },
    ],
    pageParams: ["", "a"],
  });
  client.setQueryData(searchKey, [b]);
  client.setQueryData(detailKey, b);
  return client;
}

describe("setTaskInLists", () => {
  test("在每种列表形态里只改这个任务，其他任务和列表之外的 query 不动", () => {
    const client = seedLists();

    setTaskInLists(client, listKey, "b", (task) => ({
      ...task,
      favorite: true,
    }));

    expect(client.getQueryData<TaskPage>(pageKey)?.items).toStrictEqual([
      a,
      { ...b, favorite: true },
    ]);
    expect(
      client
        .getQueryData<InfiniteData<FeedPage>>(feedKey)
        ?.pages.map((page) => page.items),
    ).toStrictEqual([[a], [{ ...b, favorite: true }, c]]);
    expect(client.getQueryData<Task[]>(searchKey)).toStrictEqual([
      { ...b, favorite: true },
    ]);
    expect(client.getQueryData(detailKey)).toBe(b);
  });

  test("只写 update 改的字段，其余字段保留各列表缓存里的值", () => {
    const client = new QueryClient();
    const newer = { ...b, name: "列表里更新过的名字" };
    client.setQueryData(searchKey, [newer]);

    setTaskInLists(client, listKey, "b", (task) => ({
      ...task,
      favorite: true,
    }));

    expect(client.getQueryData<Task[]>(searchKey)).toStrictEqual([
      { ...newer, favorite: true },
    ]);
  });
});

describe("removeTaskFromLists", () => {
  test("从每种列表形态里去掉任务，页码分页列表的 total 减一并重算 hasMore", () => {
    const client = seedLists();

    removeTaskFromLists(client, listKey, "b");

    expect(client.getQueryData<TaskPage>(pageKey)).toStrictEqual(
      makePage([a], { total: 2, hasMore: false, pageSize: 2 }),
    );
    expect(
      client
        .getQueryData<InfiniteData<FeedPage>>(feedKey)
        ?.pages.map((page) => page.items),
    ).toStrictEqual([[a], [c]]);
    expect(client.getQueryData<Task[]>(searchKey)).toStrictEqual([]);
    expect(client.getQueryData(detailKey)).toBe(b);
  });

  test("列表里没有这个任务时 total 不变", () => {
    const client = new QueryClient();
    const page = makePage([a], { total: 7 });
    client.setQueryData(pageKey, page);

    removeTaskFromLists(client, listKey, "b");

    expect(client.getQueryData<TaskPage>(pageKey)).toStrictEqual(page);
  });
});

describe("snapshotTaskLists 和 restoreTaskLists", () => {
  test("改写后按快照恢复每份列表", async () => {
    const client = seedLists();
    const before = {
      page: client.getQueryData<TaskPage>(pageKey),
      feed: client.getQueryData<InfiniteData<FeedPage>>(feedKey),
      search: client.getQueryData<Task[]>(searchKey),
    };

    const snapshot = await snapshotTaskLists(client, listKey);
    removeTaskFromLists(client, listKey, "a");
    removeTaskFromLists(client, listKey, "b");
    restoreTaskLists(client, snapshot);

    expect({
      page: client.getQueryData<TaskPage>(pageKey),
      feed: client.getQueryData<InfiniteData<FeedPage>>(feedKey),
      search: client.getQueryData<Task[]>(searchKey),
    }).toStrictEqual(before);
  });
});

describe("insertTaskIntoPage", () => {
  test("按服务端顺序插入，total 加一", () => {
    const result = insertTaskIntoPage(makePage([a, c]), b);

    expect(result).toStrictEqual(makePage([a, b, c], { total: 3 }));
  });

  test("页满时挤出页尾的任务，并重算 hasMore", () => {
    const result = insertTaskIntoPage(makePage([a, c], { pageSize: 2 }), b);

    expect(result).toStrictEqual(
      makePage([a, b], { total: 3, hasMore: true, pageSize: 2 }),
    );
  });

  test("排在满页之后的任务属于下一页，只计入 total", () => {
    const result = insertTaskIntoPage(makePage([a, b], { pageSize: 2 }), c);

    expect(result).toStrictEqual(
      makePage([a, b], { total: 3, hasMore: true, pageSize: 2 }),
    );
  });

  test("排在第二页第一条之前的任务属于前一页，只计入 total", () => {
    const result = insertTaskIntoPage(
      makePage([b, c], { page: 2, pageSize: 2, total: 4 }),
      a,
    );

    expect(result).toStrictEqual(
      makePage([b, c], { page: 2, pageSize: 2, total: 5, hasMore: true }),
    );
  });

  test("列表里已有这个任务时换成新值，total 不变", () => {
    const updated = { ...b, favorite: true };

    const result = insertTaskIntoPage(makePage([a, b, c]), updated);

    expect(result).toStrictEqual(makePage([a, updated, c]));
  });
});

describe("removeTaskFromPage", () => {
  test("去掉任务，total 减一", () => {
    expect(removeTaskFromPage(makePage([a, b]), "a")).toStrictEqual(
      makePage([b], { total: 1 }),
    );
  });

  test("这一页没有这个任务时原样返回", () => {
    const page = makePage([a]);

    expect(removeTaskFromPage(page, "b")).toBe(page);
  });
});

test("insertTaskIntoPage 按创建时间从新到旧插入，同一时间按 id 倒序", () => {
  const x = makeTask("x", 100);
  const z = makeTask("z", 100);

  const result = insertTaskIntoPage(makePage([b, x]), z);

  expect(result.items.map((task) => task.id)).toStrictEqual(["b", "z", "x"]);
});
