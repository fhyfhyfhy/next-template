import "server-only";

// 写种子数据的入口，给 scripts/local-services/seed.mjs 用。脚本在 Next 之外运行，server.ts 会连带加载 next/navigation
// 这类只能在 Next 里运行的模块，所以单独一个入口，只带写种子用到的数据层。
export { seedIfEmpty } from "./server/seed";
