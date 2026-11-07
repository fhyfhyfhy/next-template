import { readdirSync, statSync } from "node:fs";
import { extname, join, relative, sep } from "node:path";
import pg from "pg";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { databaseUrl, DATASETS } from "./datasets.mjs";
import { SEED_CONTENT_TYPES, writeSeedRows } from "./services.mjs";

// 每个测试开始时库里已经是种子数据（test-reset.mjs）。

const SEED_FILES = join(import.meta.dirname, "seed-files");
let clients = [];

async function connect() {
  const client = new pg.Client({
    connectionString: databaseUrl(DATASETS.test.database),
  });
  await client.connect();
  clients.push(client);
  return client;
}

async function count(client, table) {
  const { rows } = await client.query(
    `select count(*)::int as count from ${table}`,
  );
  return rows[0].count;
}

async function counts(client) {
  const result = {};
  for (const table of ["tasks", "task_comments", "task_logs", "uploads"]) {
    result[table] = await count(client, table);
  }
  return result;
}

let seeded;
beforeEach(async () => {
  seeded = await counts(await connect());
});
afterEach(async () => {
  await Promise.all(clients.map((client) => client.end()));
  clients = [];
});

describe("种子数据", () => {
  test("每条上传记录都有 seed-files/ 里的同名文件，大小一致，没有多余的文件", async () => {
    const client = await connect();
    const { rows } = await client.query("select key, size from uploads");
    const files = readdirSync(SEED_FILES, {
      recursive: true,
      withFileTypes: true,
    })
      .filter((entry) => entry.isFile())
      .map((entry) => {
        const path = join(entry.parentPath, entry.name);
        return {
          key: `seed/${relative(SEED_FILES, path).split(sep).join("/")}`,
          size: statSync(path).size,
        };
      })
      .sort((a, b) => (a.key < b.key ? -1 : 1));

    const byKey = (a, b) => (a.key < b.key ? -1 : 1);
    expect(files).toStrictEqual(rows.toSorted(byKey));
  });

  test("每条上传记录的 content_type 和上传文件时用的一致", async () => {
    const client = await connect();
    const { rows } = await client.query(
      "select key, content_type from uploads",
    );

    for (const { key, content_type } of rows) {
      expect(content_type, key).toBe(SEED_CONTENT_TYPES[extname(key)]);
    }
  });

  test("库里已有任务时再执行不写入", async () => {
    const client = await connect();

    await writeSeedRows(client);

    expect(await counts(client)).toStrictEqual(seeded);
  });

  test("两个连接同时对空库执行时只写入一份", async () => {
    const [first, second] = [await connect(), await connect()];
    await first.query("truncate tasks, uploads restart identity cascade");
    // 第一个连接写完先不提交，等第二个开始执行、被挡住以后再提交：两次执行一定交错。
    await first.query("begin");
    await writeSeedRows(first);
    const { rows } = await second.query("select pg_backend_pid() as pid");
    const secondWrite = writeSeedRows(second);
    await expect
      .poll(async () => {
        const result = await first.query(
          "select wait_event_type from pg_stat_activity where pid = $1",
          [rows[0].pid],
        );
        return result.rows[0]?.wait_event_type;
      })
      .toBe("Lock");
    await first.query("commit");
    await secondWrite;

    expect(await counts(first)).toStrictEqual(seeded);
  });

  test("任务删光后重新写入：还没被清理的上传记录跳过，不报错", async () => {
    const client = await connect();
    // 应用删除任务时解除它的上传关联，上传记录等清理任务过了期限才删。
    await client.query("delete from upload_attachments; delete from tasks");

    await writeSeedRows(client);

    expect(await counts(client)).toStrictEqual(seeded);
    expect(await count(client, "upload_attachments")).toBe(seeded.uploads);
  });
});
