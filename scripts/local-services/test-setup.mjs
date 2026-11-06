import { prepareDataset, startLocalServices } from "./services.mjs";

/**
 * vitest.config.mts 里 db 项目的 globalSetup：启动本地服务，准备 test 数据集的库、表结构和 bucket。
 * 不写种子数据：每个测试开始前由各 feature 的 server/db-test-helpers.ts 自己重置。
 */
export default async function setup() {
  startLocalServices();
  await prepareDataset("test", { seed: false });
}
