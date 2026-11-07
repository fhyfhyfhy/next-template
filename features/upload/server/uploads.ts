import "server-only";
import { nanoid } from "nanoid";
import { DatabaseError } from "pg";

import { badRequest, conflict, notFound } from "@/lib/domain-error";

import {
  UPLOAD_ALREADY_USED,
  UPLOAD_NOT_READY,
} from "../constants/error-codes";
import { UPLOAD_KEY_PREFIX } from "../constants/storage-keys";
import { isUploadPurpose, UPLOAD_PURPOSES } from "../constants/upload-purposes";
import { type Executor, getUploadStorage, uploadDb } from "./connection";

/** 签发的上传 URL 的有效期。清理任务要等得比它久得多，才不会删掉还在上传的文件（cleanup.ts）。 */
const UPLOAD_URL_TTL_SECONDS = 5 * 60;
/** 下载 URL 只用于一次跳转，有效期取短。 */
const DOWNLOAD_URL_TTL_SECONDS = 60;

export interface CreatedUpload {
  id: string;
  /** 浏览器把文件 PUT 到这个地址，请求头的 `Content-Type` 必须和签发时一致。 */
  uploadUrl: string;
}

/**
 * 签发一次上传：按 `purpose` 的规则（constants/upload-purposes.ts）校验声明的类型和大小，记下这次上传，
 * 返回直传对象存储的 URL。文件传完后由使用它的业务写入调用 `attachUpload`；一直没被使用的由清理任务删除。
 */
export async function createUpload(input: {
  purpose: string;
  contentType: string;
  size: number;
}): Promise<CreatedUpload> {
  const rules = isUploadPurpose(input.purpose)
    ? UPLOAD_PURPOSES[input.purpose]
    : undefined;
  if (!rules) {
    throw badRequest(`Unknown upload purpose ${input.purpose}`, {
      param: "purpose",
    });
  }
  if (!input.contentType.startsWith(rules.contentTypePrefix)) {
    throw badRequest(
      `Content type must start with ${rules.contentTypePrefix}`,
      {
        param: "contentType",
      },
    );
  }
  if (
    !Number.isInteger(input.size) ||
    input.size < 1 ||
    input.size > rules.maxSize
  ) {
    throw badRequest(`Size must be 1 to ${rules.maxSize} bytes`, {
      param: "size",
      params: { max: rules.maxSize },
    });
  }
  const id = nanoid();
  const key = `${UPLOAD_KEY_PREFIX}${id}`;
  await uploadDb()
    .insertInto("uploads")
    .values({
      id,
      key,
      purpose: input.purpose,
      content_type: input.contentType,
      size: input.size,
    })
    .execute();
  const uploadUrl = await getUploadStorage().presignPut(key, {
    contentType: input.contentType,
    size: input.size,
    expiresIn: UPLOAD_URL_TTL_SECONDS,
  });
  return { id, uploadUrl };
}

export interface AttachUploadInput {
  uploadId: string;
  /** 使用方期望的用途，和签发时的不一致就拒绝，免得给封面签发的文件被拿去做别的。 */
  purpose: string;
  recordType: string;
  recordId: string;
  name: string;
}

/**
 * 让一条记录以 `name` 的身份使用这次上传，替换它之前用的文件（旧文件没人用后由清理任务删除）。
 * 先确认文件确实已经传到存储、类型和大小都和签发时一致，再写入关联。重复提交同一个关联什么也不做；
 * 这次上传已经被别的记录使用时抛 `UPLOAD_ALREADY_USED`。`executor` 传调用方的事务时，关联和业务写入一起提交。
 */
export async function attachUpload(
  input: AttachUploadInput,
  executor?: Executor,
): Promise<void> {
  const db = uploadDb(executor);
  const upload = await db
    .selectFrom("uploads")
    .selectAll()
    .where("id", "=", input.uploadId)
    .executeTakeFirst();
  if (!upload) throw notFound(`Upload ${input.uploadId} not found`);
  if (upload.purpose !== input.purpose) {
    throw badRequest(`Upload ${upload.id} is not for ${input.purpose}`, {
      param: "uploadId",
    });
  }
  const existing = await db
    .selectFrom("upload_attachments")
    .selectAll()
    .where("upload_id", "=", upload.id)
    .executeTakeFirst();
  if (existing) {
    if (
      existing.record_type === input.recordType &&
      existing.record_id === input.recordId &&
      existing.name === input.name
    ) {
      return;
    }
    throw alreadyUsed(upload.id);
  }
  const stored = await getUploadStorage().head(upload.key);
  if (
    !stored ||
    stored.size !== upload.size ||
    stored.contentType !== upload.content_type
  ) {
    throw conflict(
      UPLOAD_NOT_READY,
      `Upload ${upload.id} has not been uploaded as declared`,
    );
  }
  try {
    await db
      .deleteFrom("upload_attachments")
      .where("record_type", "=", input.recordType)
      .where("record_id", "=", input.recordId)
      .where("name", "=", input.name)
      .execute();
    await db
      .insertInto("upload_attachments")
      .values({
        upload_id: upload.id,
        record_type: input.recordType,
        record_id: input.recordId,
        name: input.name,
      })
      .execute();
  } catch (error) {
    // 并发的另一次关联先用掉了它；或者清理任务刚好把它删了，按不存在处理。
    if (error instanceof DatabaseError && error.code === "23505") {
      throw alreadyUsed(upload.id);
    }
    if (error instanceof DatabaseError && error.code === "23503") {
      throw notFound(`Upload ${upload.id} not found`);
    }
    throw error;
  }
}

function alreadyUsed(uploadId: string) {
  return conflict(
    UPLOAD_ALREADY_USED,
    `Upload ${uploadId} is already used by another record`,
  );
}

/** 解除一条记录对所有文件的使用，比如记录被删除时。文件本身留给清理任务删除。 */
export async function detachRecordUploads(
  recordType: string,
  recordId: string,
  executor?: Executor,
) {
  await uploadDb(executor)
    .deleteFrom("upload_attachments")
    .where("record_type", "=", recordType)
    .where("record_id", "=", recordId)
    .execute();
}

/** 这些记录以 `name` 使用的文件的公开地址，按 record id 索引；没有文件的记录不在结果里。 */
export async function getAttachedUploadUrls(
  recordType: string,
  recordIds: readonly string[],
  name: string,
  executor?: Executor,
): Promise<Map<string, string>> {
  if (recordIds.length === 0) return new Map();
  const rows = await uploadDb(executor)
    .selectFrom("upload_attachments")
    .innerJoin("uploads", "uploads.id", "upload_attachments.upload_id")
    .select(["upload_attachments.record_id", "uploads.key"])
    .where("upload_attachments.record_type", "=", recordType)
    .where("upload_attachments.record_id", "in", [...recordIds])
    .where("upload_attachments.name", "=", name)
    .execute();
  const storage = getUploadStorage();
  return new Map(
    rows.map((row) => [row.record_id, storage.publicUrl(row.key)]),
  );
}

/** 一条记录以 `name` 使用的文件的短期下载地址，响应以 `filename` 作为附件名；没有文件时返回 null。 */
export async function getAttachedUploadDownloadUrl(
  recordType: string,
  recordId: string,
  name: string,
  filename: string,
): Promise<string | null> {
  const row = await uploadDb()
    .selectFrom("upload_attachments")
    .innerJoin("uploads", "uploads.id", "upload_attachments.upload_id")
    .select("uploads.key")
    .where("upload_attachments.record_type", "=", recordType)
    .where("upload_attachments.record_id", "=", recordId)
    .where("upload_attachments.name", "=", name)
    .executeTakeFirst();
  if (!row) return null;
  return getUploadStorage().presignGet(row.key, {
    expiresIn: DOWNLOAD_URL_TTL_SECONDS,
    filename,
  });
}

/**
 * 服务端自己产出的文件（比如 generator 写的模型）：先记下这次上传、再写入存储，返回它的 id，由调用方关联。
 * 不经过签发，所以不受 constants/upload-purposes.ts 的限制。记录用自己的连接立即提交，不加入调用方的事务：
 * 调用方的事务回滚时，这次上传只是没被使用，由清理任务连同文件一起删除；文件写入失败时同理。
 */
export async function saveServerUpload(input: {
  purpose: string;
  contentType: string;
  body: Uint8Array;
}): Promise<string> {
  const id = nanoid();
  const key = `${UPLOAD_KEY_PREFIX}${id}`;
  await uploadDb()
    .insertInto("uploads")
    .values({
      id,
      key,
      purpose: input.purpose,
      content_type: input.contentType,
      size: input.body.byteLength,
    })
    .execute();
  await getUploadStorage().put(key, input.body, input.contentType);
  return id;
}
