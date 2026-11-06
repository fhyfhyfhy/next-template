// 由 services.mjs 的 seedDataset 在子进程里运行：node --conditions=react-server --import tsx，环境变量指向要写入的数据集。
import { seedIfEmpty } from "@/features/task/seed";

await seedIfEmpty();
// 数据层的连接池（lib/db.ts）不会自己关闭，写完直接退出。
process.exit(0);
