import { type Kysely, sql } from "kysely";
import type { Migration } from "kysely/migration";

// upload 的 migration。scripts/db/migrate.mjs 用 Node 的类型剥离直接加载这个文件，所以它只能依赖
// kysely：不能带 server-only，也不能引用 @/ 或其他相对路径的模块。名称带时间戳前缀，和其他 feature 的
// migration 合成一条按名称排序的序列执行；已经执行过的 migration 不要再改，改结构就加一条新的。
// 表结构另有两份副本，改结构时一起改：scripts/local-services/seed.sql 的种子数据和 e2e/tasks.ts 的 `Tables`。

export const migrations: Record<string, Migration> = {
  "20261102000100_create_uploads": {
    async up(db: Kysely<unknown>) {
      await db.schema
        .createTable("uploads")
        .addColumn("id", "text", (column) => column.primaryKey())
        .addColumn("key", "text", (column) => column.notNull().unique())
        .addColumn("purpose", "text", (column) => column.notNull())
        .addColumn("content_type", "text", (column) => column.notNull())
        .addColumn("size", "integer", (column) => column.notNull())
        .addColumn("created_at", "timestamptz", (column) =>
          column.notNull().defaultTo(sql`now()`),
        )
        .execute();
      await db.schema
        .createIndex("uploads_created_at_idx")
        .on("uploads")
        .column("created_at")
        .execute();
      // upload_id 是主键：一个上传只能被一条记录使用。
      // (record_type, record_id, name) 唯一：一条记录的一个用途只有一个文件，比如一个任务只有一张封面。
      await db.schema
        .createTable("upload_attachments")
        .addColumn("upload_id", "text", (column) =>
          column.primaryKey().references("uploads.id"),
        )
        .addColumn("record_type", "text", (column) => column.notNull())
        .addColumn("record_id", "text", (column) => column.notNull())
        .addColumn("name", "text", (column) => column.notNull())
        .addColumn("created_at", "timestamptz", (column) =>
          column.notNull().defaultTo(sql`now()`),
        )
        .addUniqueConstraint("upload_attachments_record_key", [
          "record_type",
          "record_id",
          "name",
        ])
        .execute();
    },
  },
};
