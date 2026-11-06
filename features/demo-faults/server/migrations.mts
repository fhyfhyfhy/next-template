import { type Kysely, sql } from "kysely";
import type { Migration } from "kysely/migration";

// demo-faults 的 migration。scripts/demo-backend/migrate.mjs 用 Node 的类型剥离直接加载这个文件，所以它只能依赖
// kysely：不能带 server-only，也不能引用 @/ 或其他相对路径的模块。名称带时间戳前缀，和其他 Demo feature 的
// migration 合成一条按名称排序的序列执行；已经执行过的 migration 不要再改，改结构就加一条新的。

/** 和 constants/demo-latency.ts 的 DEFAULT_LATENCY_MS 一致；migration 不能引用它。 */
const DEFAULT_LATENCY_MS = 500;

export const migrations: Record<string, Migration> = {
  // 这三张表原来属于 demo-task，这条 migration 原样从它的 migrations.mts 移过来，名称和内容都没变。
  "20261102000300_create_demo_controls": {
    async up(db: Kysely<unknown>) {
      await db.schema
        .createTable("demo_faults")
        .addColumn("id", "bigint", (column) =>
          column.primaryKey().generatedAlwaysAsIdentity(),
        )
        .addColumn("operation", "text", (column) => column.notNull())
        .addColumn("kind", "text", (column) => column.notNull())
        .addColumn("latency_ms", "integer", (column) => column.notNull())
        .addColumn("code", "integer")
        .addColumn("status", "integer")
        .addColumn("times", "integer")
        .execute();

      await db.schema
        .createTable("demo_settings")
        .addColumn("id", "boolean", (column) =>
          column
            .primaryKey()
            .defaultTo(true)
            .check(sql`id`),
        )
        .addColumn("latency_ms", "integer", (column) => column.notNull())
        .addColumn("clock_paused", "boolean", (column) => column.notNull())
        .addColumn("reset_epoch", "integer", (column) => column.notNull())
        .addColumn("seeded", "boolean", (column) => column.notNull())
        .execute();
      await sql`insert into demo_settings (latency_ms, clock_paused, reset_epoch, seeded)
        values (${DEFAULT_LATENCY_MS}, false, 0, false)`.execute(db);

      await db.schema
        .createTable("demo_calls")
        .addColumn("id", "bigint", (column) =>
          column.primaryKey().generatedAlwaysAsIdentity(),
        )
        .addColumn("operation", "text", (column) => column.notNull())
        .addColumn("source", "text", (column) => column.notNull())
        .addColumn("called_at", "timestamptz", (column) =>
          column.notNull().defaultTo(sql`now()`),
        )
        .execute();
    },
  },

  // demo-task 的 20261106000100_create_task_settings 已经把这两列复制到它自己的 task_settings。
  "20261106000200_drop_task_columns_from_demo_settings": {
    async up(db: Kysely<unknown>) {
      await db.schema
        .alterTable("demo_settings")
        .dropColumn("clock_paused")
        .dropColumn("seeded")
        .execute();
    },
  },
};
