import { assertDataset, datasetName } from "./datasets.mjs";
import { prepareDataset, startLocalServices } from "./services.mjs";

// 用法：node scripts/local-services/reset.mjs [dataset]
// 把本地的一个数据集（默认 LOCAL_DATASET，再默认 dev）恢复成只有种子数据：删库重建、清空 bucket、重新迁移和写种子。
// pnpm db:reset 用它恢复开发数据；e2e 在 build 之前用它准备 e2e 数据集（playwright.config.ts）。

const name = process.argv[2] ?? datasetName();
assertDataset(name);
startLocalServices();
await prepareDataset(name, { reset: true });
