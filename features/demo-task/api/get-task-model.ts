import { ApiError, resolveApiUrl } from "@/lib/fetch";

/**
 * Reads a done task's 3D model file (`.glb`). A binary response uses raw
 * `fetch` under the transport exception; a failure (the task isn't done yet,
 * say) becomes the same `ApiError` that `fetchApi` throws. A successful
 * response is binary, so JSON on a 2xx can only be an error object.
 */
export async function getTaskModel(taskId: string): Promise<Blob> {
  const url = `/demo/tasks/${taskId}/model` as const;
  const response = await fetch(resolveApiUrl(url));
  if (!response.ok || isJson(response)) {
    const text = await response.text();
    throw new ApiError({ url, status: response.status, body: parseJson(text) });
  }
  return response.blob();
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
