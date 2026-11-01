import {
  UPLOAD_PURPOSES,
  type UploadPurpose,
} from "../constants/upload-purposes";

export type UploadFileProblem = "contentType" | "size";

/** 浏览器选中的文件不符合用途的规则时返回原因，符合时返回 null；签发时服务端按同样的规则再校验一次。 */
export function checkUploadFile(
  purpose: UploadPurpose,
  file: { type: string; size: number },
): UploadFileProblem | null {
  const rules = UPLOAD_PURPOSES[purpose];
  if (!file.type.startsWith(rules.contentTypePrefix)) return "contentType";
  if (file.size < 1 || file.size > rules.maxSize) return "size";
  return null;
}
