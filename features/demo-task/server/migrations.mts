import { type Kysely, sql } from "kysely";
import type { Migration } from "kysely/migration";

// demo-task 的 migration。scripts/demo-backend/migrate.mjs 用 Node 的类型剥离直接加载这个文件，所以它只能依赖
// kysely：不能带 server-only，也不能引用 @/ 或其他相对路径的模块。名称带时间戳前缀，和其他 Demo feature 的
// migration 合成一条按名称排序的序列执行；已经执行过的 migration 不要再改，改结构就加一条新的。

export const migrations: Record<string, Migration> = {
  "20261102000200_create_tasks": {
    async up(db: Kysely<unknown>) {
      await db.schema
        .createTable("tasks")
        .addColumn("id", "text", (column) => column.primaryKey())
        // 名称唯一由数据库保证，并发创建或重命名时规则也成立；冲突由数据层转成 TASK_NAME_TAKEN。
        .addColumn("name", "text", (column) => column.notNull().unique())
        .addColumn("prompt", "text", (column) => column.notNull())
        .addColumn("status", "text", (column) =>
          column
            .notNull()
            .check(sql`status in ('pending', 'running', 'done', 'failed')`),
        )
        .addColumn("progress", "integer", (column) => column.notNull())
        .addColumn("favorite", "boolean", (column) => column.notNull())
        .addColumn("created_at", "timestamptz", (column) => column.notNull())
        .addColumn("updated_at", "timestamptz", (column) => column.notNull())
        .execute();
      // 列表和作品广场按创建时间倒序、id 兜底排序，游标分页也按这两列比较。
      await db.schema
        .createIndex("tasks_created_at_id_idx")
        .on("tasks")
        .columns(["created_at desc", "id desc"])
        .execute();

      await db.schema
        .createTable("task_comments")
        .addColumn("id", "text", (column) => column.primaryKey())
        .addColumn("task_id", "text", (column) =>
          column.notNull().references("tasks.id").onDelete("cascade"),
        )
        .addColumn("content", "text", (column) => column.notNull())
        .addColumn("created_at", "timestamptz", (column) => column.notNull())
        .execute();
      await db.schema
        .createIndex("task_comments_task_id_idx")
        .on("task_comments")
        .columns(["task_id", "created_at"])
        .execute();

      await db.schema
        .createTable("task_logs")
        .addColumn("seq", "bigint", (column) =>
          column.primaryKey().generatedAlwaysAsIdentity(),
        )
        .addColumn("task_id", "text", (column) =>
          column.notNull().references("tasks.id").onDelete("cascade"),
        )
        .addColumn("line", "text", (column) => column.notNull())
        .addColumn("created_at", "timestamptz", (column) =>
          column.notNull().defaultTo(sql`now()`),
        )
        .execute();
      await db.schema
        .createIndex("task_logs_task_id_idx")
        .on("task_logs")
        .columns(["task_id", "seq"])
        .execute();
    },
  },

  // 从 demo-faults 的 demo_settings 拆出来：先复制这两列的当前值，demo-faults 的
  // 20261106000200_drop_task_columns_from_demo_settings 再删掉它们。之后 demo-task 只读写 task_settings。
  "20261106000100_create_task_settings": {
    async up(db: Kysely<unknown>) {
      await db.schema
        .createTable("task_settings")
        .addColumn("id", "boolean", (column) =>
          column
            .primaryKey()
            .defaultTo(true)
            .check(sql`id`),
        )
        .addColumn("clock_paused", "boolean", (column) => column.notNull())
        .addColumn("seeded", "boolean", (column) => column.notNull())
        .execute();
      await sql`insert into task_settings (clock_paused, seeded)
        select clock_paused, seeded from demo_settings`.execute(db);
    },
  },
};
