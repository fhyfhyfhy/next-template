import { prepareDataset, startLocalServices } from "./services.mjs";

/**
 * vitest.config.mts 里 db 项目的 globalSetup：启动本地服务，把 test 数据集重置成只有种子数据，种子文件也传好。
 * 每个测试开始前由 test-reset.mjs 把表恢复成种子数据。
 */
export default async function setup() {
  startLocalServices();
  await prepareDataset("test", { reset: true });
}
