/**
 * 用户可以签发上传的用途和各自的文件限制。签发时按这里校验，浏览器选文件时也按它提前拦下不合格的文件。
 * 加一种用途时在这里加一行；服务端自己写入的文件（比如 generator 的模型）不经过签发，不在这里。
 */
export const UPLOAD_PURPOSES = {
  "task-cover": { contentTypePrefix: "image/", maxSize: 5 * 1024 * 1024 },
} as const satisfies Record<
  string,
  { contentTypePrefix: string; maxSize: number }
>;

export type UploadPurpose = keyof typeof UPLOAD_PURPOSES;

export function isUploadPurpose(value: string): value is UploadPurpose {
  return Object.hasOwn(UPLOAD_PURPOSES, value);
}
