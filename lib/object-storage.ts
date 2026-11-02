import "server-only";
import {
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  NotFound,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export interface ObjectStorageConfig {
  /** server 调用 S3 API 的地址。 */
  endpoint: string;
  /** 浏览器能直接读取对象的地址前缀，key 拼在它后面。真实环境里通常是 CDN 或存储的公开域名。 */
  publicUrl: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
}

export interface StoredObject {
  contentType: string | undefined;
  size: number;
}

/**
 * 兼容 S3 API 的对象存储。只封装 key 级别的操作，key 的命名、谁能上传什么由调用方决定。
 * presigned URL 由这里的密钥签名，持有它的人可以在有效期内对这一个 key 做签名里写明的操作。
 */
export interface ObjectStorage {
  /**
   * 浏览器直传用的 PUT URL。`Content-Type` 和长度都签进 URL：上传时这两个请求头和签名不一致，存储会拒绝。
   */
  presignPut(
    key: string,
    options: { contentType: string; size: number; expiresIn: number },
  ): Promise<string>;
  /** 下载用的 GET URL；传了 `filename` 时响应带 `Content-Disposition: attachment`。 */
  presignGet(
    key: string,
    options: { expiresIn: number; filename?: string },
  ): Promise<string>;
  /** 对象不存在时返回 null。 */
  head(key: string): Promise<StoredObject | null>;
  put(
    key: string,
    body: Uint8Array | string,
    contentType: string,
  ): Promise<void>;
  /** 删除这些 key 的对象，不存在的 key 忽略。 */
  delete(keys: string[]): Promise<void>;
  /** 以 `prefix` 开头的全部 key。 */
  list(prefix: string): Promise<string[]>;
  publicUrl(key: string): string;
}

export function createObjectStorage(
  config: ObjectStorageConfig,
): ObjectStorage {
  const client = new S3Client({
    endpoint: config.endpoint,
    region: "us-east-1",
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    // 本地的兼容实现按路径寻址 bucket，不支持 <bucket>.<host> 的虚拟主机写法。
    forcePathStyle: true,
    // SDK 默认给每个请求加 CRC32 checksum，presigned PUT 里会带上空 body 的 checksum，部分 S3 兼容存储
    // 因此拒绝上传（Garage、SeaweedFS）；按需计算时只有要求 checksum 的操作才带。
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
  const { bucket } = config;
  const base = config.publicUrl.replace(/\/+$/, "");

  return {
    presignPut(key, { contentType, size, expiresIn }) {
      return getSignedUrl(
        client,
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          ContentType: contentType,
          ContentLength: size,
        }),
        {
          expiresIn,
          // 默认只签 host，类型不一致的上传也会成功。
          signableHeaders: new Set(["content-type", "content-length"]),
        },
      );
    },

    presignGet(key, { expiresIn, filename }) {
      return getSignedUrl(
        client,
        new GetObjectCommand({
          Bucket: bucket,
          Key: key,
          ResponseContentDisposition:
            filename === undefined
              ? undefined
              : `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
        }),
        { expiresIn },
      );
    },

    async head(key) {
      try {
        const object = await client.send(
          new HeadObjectCommand({ Bucket: bucket, Key: key }),
        );
        return {
          contentType: object.ContentType,
          size: object.ContentLength ?? 0,
        };
      } catch (error) {
        if (error instanceof NotFound) return null;
        throw error;
      }
    },

    async put(key, body, contentType) {
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: body,
          ContentType: contentType,
        }),
      );
    },

    async delete(keys) {
      // DeleteObjects 一次最多 1000 个 key。
      for (let start = 0; start < keys.length; start += 1000) {
        await client.send(
          new DeleteObjectsCommand({
            Bucket: bucket,
            Delete: {
              Objects: keys
                .slice(start, start + 1000)
                .map((key) => ({ Key: key })),
              Quiet: true,
            },
          }),
        );
      }
    },

    async list(prefix) {
      const keys: string[] = [];
      let token: string | undefined;
      do {
        const page = await client.send(
          new ListObjectsV2Command({
            Bucket: bucket,
            Prefix: prefix,
            ContinuationToken: token,
          }),
        );
        for (const object of page.Contents ?? []) {
          if (object.Key) keys.push(object.Key);
        }
        token = page.IsTruncated ? page.NextContinuationToken : undefined;
      } while (token);
      return keys;
    },

    publicUrl(key) {
      return `${base}/${key.split("/").map(encodeURIComponent).join("/")}`;
    },
  };
}
