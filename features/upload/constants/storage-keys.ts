// 对象存储里 key 的前缀。scripts/local-services/services.mjs 的 `PUBLIC_PREFIXES` 按它们给本地 bucket 设置公开读，
// 那是 Node 脚本，不能 import 这里的 TypeScript，改前缀时两边一起改。

/** 种子文件的 key 前缀。清理任务和数据库测试的重置（`clearUploads`）都不删这个前缀下的对象：种子数据共用它们。 */
export const SEED_KEY_PREFIX = "seed/";
/** 用户上传和服务端产出的文件的 key 前缀；数据库测试的重置（`clearUploads`）清空它下面的全部对象。 */
export const UPLOAD_KEY_PREFIX = "uploads/";
