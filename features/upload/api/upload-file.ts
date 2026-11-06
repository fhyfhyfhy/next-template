/**
 * 上传的第二步：浏览器把文件直接 PUT 到签发的 URL，文件不经过 Next。签发时 `Content-Type` 和长度都签进了
 * URL，这里必须带上同样的类型；不一致时存储返回 403。请求的是对象存储而不是本 app 的接口，按传输例外用 raw `fetch`。
 */
export async function uploadFile(uploadUrl: string, file: File) {
  const response = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: file,
  });
  if (!response.ok) {
    throw new Error(`Upload to object storage failed with ${response.status}`);
  }
}
