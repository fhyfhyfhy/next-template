import "server-only";

// 种子数据和数据库测试的重置用的入口，给 task 的种子和测试用。和 features/task/seed.ts 一样，它只带这些操作用到的
// 数据层，不经过 server.ts，所以能在 Next 之外加载（scripts/local-services/seed.mjs）。
export { SEED_KEY_PREFIX } from "./constants/storage-keys";
export {
  clearUploads,
  restoreSeedUploads,
  type SeedUpload,
} from "./server/seed";
