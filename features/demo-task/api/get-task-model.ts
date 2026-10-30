import { ApiError, resolveApiUrl } from "@/lib/fetch";

/**
 * 下载 done 任务的 3D 模型文件。二进制响应按传输例外用 raw `fetch`；失败时（比如任务还没完成）
 * 转成和 `fetchApi` 一样的 `ApiError`。成功的响应是二进制，所以 2xx 上的 JSON 只可能是 error 对象。
 */
export async function downloadTaskModel(taskId: string, filename: string) {
  const url = `/demo/tasks/${taskId}/model` as const;
  const response = await fetch(resolveApiUrl(url));
  if (!response.ok || isJson(response)) {
    const text = await response.text();
    throw new ApiError({ url, status: response.status, body: parseJson(text) });
  }
  const objectUrl = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = `${filename}.glb`;
  link.click();
  URL.revokeObjectURL(objectUrl);
}

function isJson(response: Response) {
  return response.headers.get("content-type")?.includes("application/json");
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
