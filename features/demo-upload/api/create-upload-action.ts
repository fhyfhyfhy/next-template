"use server";

import { z } from "zod";

import { type CreatedUpload, createUpload } from "../server/uploads";

const inputSchema = z.object({
  purpose: z.string(),
  contentType: z.string(),
  size: z.number(),
});

/**
 * 上传的第一步：按用途校验浏览器声明的类型和大小，签发直传对象存储的 URL。浏览器选文件时已经按同样的规则
 * （constants/upload-purposes.ts）拦下不合格的文件，所以这里的拒绝不当作预期失败，照常抛出、走全局提示。
 * Demo 后端没有启用时数据层找不到连接参数，直接抛错。
 */
export async function createUploadAction(
  input: z.input<typeof inputSchema>,
): Promise<CreatedUpload> {
  return createUpload(inputSchema.parse(input));
}
