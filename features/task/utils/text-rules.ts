import { badRequest } from "@/lib/domain-error";

/**
 * 去掉首尾空白后长度在 1 到 `maxLength` 之间的文本，否则按参数错误拒绝：`param` 是字段名，`params.max` 是上限，
 * 业务码为 `code`，不传时是通用的 BAD_REQUEST。
 */
export function requireText(
  value: unknown,
  field: string,
  maxLength: number,
  code?: number,
): string {
  const text = typeof value === "string" ? value.trim() : "";
  if (text.length === 0 || text.length > maxLength) {
    throw badRequest(
      `${field} must be 1 to ${maxLength} characters`,
      { param: field, params: { max: maxLength } },
      code,
    );
  }
  return text;
}

/** 搜索关键词的 ILIKE 模式：包含它即可，关键词里的 `%`、`_`、`\` 按普通字符匹配。 */
export function containsPattern(term: string) {
  return `%${term.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}
