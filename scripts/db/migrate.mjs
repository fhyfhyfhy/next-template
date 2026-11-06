import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { Kysely, PostgresDialect } from "kysely";
import { Migrator } from "kysely/migration";
import pg from "pg";

// 每个 feature 在自己的 server/migrations.mts 里导出 `migrations`，这里把它们合成一条序列，按名称（时间戳前缀）
// 排序执行。那些文件由 Node 的类型剥离直接加载，只能依赖 kysely（见文件开头的说明）。
// 新增拥有表的 feature 时，把它的 migration 文件加进这个列表。
const MIGRATION_MODULES = [
  "features/upload/server/migrations.mts",
  "features/task/server/migrations.mts",
];

const projectRoot = join(import.meta.dirname, "..", "..");

/** 把 `connectionString` 指向的库迁移到最新结构；任何一条失败都抛出，已经成功的保留。 */
export async function migrateDatabase(connectionString) {
  const migrations = {};
  for (const path of MIGRATION_MODULES) {
    const imported = await import(pathToFileURL(join(projectRoot, path)).href);
    for (const [name, migration] of Object.entries(imported.migrations)) {
      if (Object.hasOwn(migrations, name)) {
        throw new Error(`Duplicate migration name ${name} in ${path}`);
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
        console.error(`Migration ${result.migrationName} failed`);
      }
    }
    if (error) throw error;
  } finally {
    await db.destroy();
  }
}

// pnpm db:migrate：部署时迁移环境变量 DATABASE_URL 指向的库。本地数据集由 pnpm dev 等命令自己迁移
// （scripts/local-services/services.mjs）。
if (import.meta.main) {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  await migrateDatabase(url);
}
