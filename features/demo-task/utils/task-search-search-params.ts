import { createLoader, createSerializer, parseAsString } from "nuqs/server";

/** 搜索页的 URL 只存关键词，原样保存输入框里的内容。 */
export const taskSearchSearchParams = {
  q: parseAsString.withDefault(""),
};

export const loadTaskSearchSearchParams = createLoader(taskSearchSearchParams);

export const serializeTaskSearchSearchParams = createSerializer(
  taskSearchSearchParams,
);
