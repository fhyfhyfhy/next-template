import type { Generated } from "kysely";

// upload 拥有的表，结构由同目录的 migrations.mts 创建。只描述这两张表：别的 feature 的表不在这里，
// 这个 feature 也不读写它们。

export interface UploadsTable {
  id: string;
  /** 文件在对象存储里的 key。 */
  key: string;
  purpose: string;
  content_type: string;
  size: number;
  created_at: Generated<Date>;
}

/** 某条记录（`record_type` + `record_id`）以 `name` 的身份使用了哪个上传，参照 Rails Active Storage 的 attachments。 */
export interface UploadAttachmentsTable {
  upload_id: string;
  record_type: string;
  record_id: string;
  name: string;
  created_at: Generated<Date>;
}

export interface UploadTables {
  uploads: UploadsTable;
  upload_attachments: UploadAttachmentsTable;
}
