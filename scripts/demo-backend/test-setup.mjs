import { prepareDemoDataset, startDemoServices } from "./services.mjs";

/** vitest.demo.config.mts 的 globalSetup：启动 Demo 的服务，准备 test 数据集的库、表结构和 bucket。 */
export default async function setup() {
  startDemoServices();
  await prepareDemoDataset("test");
}
