import "server-only";

// 种子数据和数据库测试的重置用的入口，给 task 的种子和测试用。生产代码不调用这些操作，所以不放进 server.ts。
export {
  clearUploads,
  restoreSeedUploads,
  type SeedUpload,
} from "./server/seed";
