import { migrateDatabase } from "./migrate.mjs";

// pnpm db:migrate：部署时迁移环境变量 DATABASE_URL 指向的库。本地数据集由 pnpm dev 等命令自己迁移
// （scripts/local-services/services.mjs）。
const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");
await migrateDatabase(url);
