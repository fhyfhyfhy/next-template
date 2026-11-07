// 另有两份副本，改的时候一起改：scripts/local-services/services.mjs 的 `PUBLIC_PREFIXES` 按它给本地 bucket
// 设置公开读；e2e/tasks.ts 的 `saveModel` 按它写模型文件（e2e 不引入应用代码，.claude/rules/e2e.md）。

/** 用户上传和服务端产出的文件在对象存储里的 key 前缀。 */
export const UPLOAD_KEY_PREFIX = "uploads/";
