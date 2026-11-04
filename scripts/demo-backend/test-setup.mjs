import { prepareDemoDataset, startDemoServices } from "./services.mjs";

/** vitest.config.mts 里 demo-db 项目的 globalSetup：启动 Demo 的服务，准备 test 数据集的库、表结构和 bucket。 */
export default async function setup() {
  startDemoServices();
  await prepareDemoDataset("test");
}
