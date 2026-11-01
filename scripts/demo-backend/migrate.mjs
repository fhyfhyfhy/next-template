import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { Kysely, PostgresDialect } from "kysely";
import { Migrator } from "kysely/migration";
import pg from "pg";

// 每个 feature 在自己的 server/migrations.mts 里导出 `migrations`，这里把它们合成一条序列，按名称（时间戳前缀）
// 排序执行。那些文件由 Node 的类型剥离直接加载，只能依赖 kysely（见文件开头的说明）。
// 新增拥有 Demo 表的 feature 时，把它的 migration 文件加进这个列表。
const MIGRATION_MODULES = [
  "features/demo-upload/server/migrations.mts",
  "features/demo-task/server/migrations.mts",
];

const projectRoot = join(import.meta.dirname, "..", "..");

/** 把 `connectionString` 指向的库迁移到最新结构；任何一条失败都抛出，已经成功的保留。 */
export async function migrateDemoDatabase(connectionString) {
  const migrations = {};
  for (const path of MIGRATION_MODULES) {
    const imported = await import(pathToFileURL(join(projectRoot, path)).href);
    for (const [name, migration] of Object.entries(imported.migrations)) {
      if (Object.hasOwn(migrations, name)) {
        throw new Error(`Duplicate Demo migration name ${name} in ${path}`);
      }
      migrations[name] = migration;
    }
  }
  const db = new Kysely({
    dialect: new PostgresDialect({
      pool: new pg.Pool({ connectionString, max: 1 }),
    }),
  });
  try {
    const migrator = new Migrator({
      db,
      provider: { getMigrations: async () => migrations },
    });
    const { error, results } = await migrator.migrateToLatest();
    for (const result of results ?? []) {
      if (result.status === "Error") {
        console.error(`Demo migration ${result.migrationName} failed`);
      }
    }
    if (error) throw error;
  } finally {
    await db.destroy();
  }
}
