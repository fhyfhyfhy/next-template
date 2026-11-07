import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { extname, join, relative, sep } from "node:path";
import {
  BucketAlreadyOwnedByYou,
  CreateBucketCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
  NoSuchBucket,
  PutBucketCorsCommand,
  PutBucketPolicyCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import pg from "pg";

import { migrateDatabase } from "../db/migrate.mjs";
import {
  databaseUrl,
  DATASETS,
  localEnv,
  POSTGRES,
  STORAGE,
} from "./datasets.mjs";
import { createLocalStorageClient } from "./storage.mjs";

const projectRoot = join(import.meta.dirname, "..", "..");

const SEED_SQL = readFileSync(join(import.meta.dirname, "seed.sql"), "utf8");
const SEED_FILES = join(import.meta.dirname, "seed-files");
/** seed-files/ 下的文件传到 bucket 的这个前缀下，路径不变；seed.sql 里上传记录的 key 指向它们。 */
const SEED_PREFIX = "seed/";
export const SEED_CONTENT_TYPES = {
  ".svg": "image/svg+xml",
  ".glb": "model/gltf-binary",
};

/**
 * 浏览器直接读的前缀：用户上传和服务端产出的文件、种子文件。签发上传要签名；下载链接也签名，是为了带上文件名
 * （`Content-Disposition`）。`uploads/` 和 features/upload/constants/storage-keys.ts 的 `UPLOAD_KEY_PREFIX` 一致，
 * 改的时候一起改。
 */
const PUBLIC_PREFIXES = ["uploads/", SEED_PREFIX];

/**
 * 启动 compose.yaml 里的 Postgres 和对象存储，等它们就绪；已经在运行时什么也不做。
 * 需要 Docker，没装或没启动时报错说明原因。
 */
export function startLocalServices() {
  const result = spawnSync(
    "docker",
    ["compose", "-f", "compose.yaml", "up", "-d", "--wait"],
    { cwd: projectRoot, stdio: "inherit" },
  );
  if (result.error || result.status !== 0) {
    throw new Error(
      `Could not start the local services with Docker Compose; see its output above: Docker may not be running, or ports ${POSTGRES.port} and ${new URL(STORAGE.endpoint).port} may be taken, such as by containers from another Compose project`,
      { cause: result.error },
    );
  }
}

/**
 * 准备一个数据集：库不存在就创建，执行 migration，初始化 bucket，写入种子数据（seed.sql 在库里已有任务时跳过）。
 * 可以重复执行。`reset` 先删掉库、清空 bucket，数据集回到只有种子数据的状态。
 * @returns {Record<string, string>} 连到这个数据集的环境变量
 */
export async function prepareDataset(name, { reset = false } = {}) {
  const { database, bucket } = DATASETS[name];
  await createDatabase(database, { reset });
  await migrateDatabase(databaseUrl(database));
  await prepareBucket(bucket, { reset });
  const client = new pg.Client({ connectionString: databaseUrl(database) });
  await client.connect();
  try {
    await writeSeedRows(client);
  } finally {
    await client.end();
  }
  await uploadSeedFiles(bucket);
  return localEnv(name);
}

/** 执行 seed.sql：库里还没有任务时写入种子数据，已有任务时跳过；几个连接同时执行时只写入一份。 */
export async function writeSeedRows(client) {
  await client.query(SEED_SQL);
}

/**
 * 清空数据集的所有表（migration 的记录除外），再写入种子数据，在一个事务里完成。数据库测试在每个测试之前调用；
 * 种子文件已经由 prepareDataset 传好。
 * @param {pg.Client} client 连到这个数据集的连接
 */
export async function restoreSeedRows(client) {
  const { rows } = await client.query(
    "select tablename from pg_tables where schemaname = 'public' and tablename not like 'kysely\\_%'",
  );
  const tables = rows.map(({ tablename }) => pg.escapeIdentifier(tablename));
  await client.query(
    `truncate ${tables.join(", ")} restart identity cascade;\n${SEED_SQL}`,
  );
}

async function createDatabase(database, { reset }) {
  const client = new pg.Client({
    connectionString: databaseUrl(POSTGRES.adminDatabase),
  });
  await client.connect();
  try {
    const name = pg.escapeIdentifier(database);
    // force 断开别的连接，比如还开着的 pnpm dev。
    if (reset)
      await client.query(`drop database if exists ${name} with (force)`);
    const { rowCount } = await client.query(
      "select 1 from pg_database where datname = $1",
      [database],
    );
    if (rowCount === 0) await client.query(`create database ${name}`);
  } catch (error) {
    // 两个进程同时准备同一个数据集（比如两份 checkout 同时启动 pnpm dev），后到的建库会撞上唯一约束。
    if (error.code !== "42P04" && error.code !== "23505") throw error;
  } finally {
    await client.end();
  }
}

/** 把 seed-files/ 下的文件传到 bucket 的 `SEED_PREFIX` 下。内容固定，每次都覆盖写。 */
async function uploadSeedFiles(bucket) {
  const files = readdirSync(SEED_FILES, {
    recursive: true,
    withFileTypes: true,
  }).filter((entry) => entry.isFile());
  const client = createLocalStorageClient();
  try {
    await Promise.all(
      files.map((file) => {
        const path = join(file.parentPath, file.name);
        const contentType = SEED_CONTENT_TYPES[extname(path)];
        if (!contentType)
          throw new Error(`No content type for the seed file ${path}`);
        return client.send(
          new PutObjectCommand({
            Bucket: bucket,
            Key: SEED_PREFIX + relative(SEED_FILES, path).split(sep).join("/"),
            Body: readFileSync(path),
            ContentType: contentType,
          }),
        );
      }),
    );
  } finally {
    client.destroy();
  }
}

async function prepareBucket(bucket, { reset }) {
  const client = createLocalStorageClient();
  try {
    if (reset) await emptyBucket(client, bucket);
    try {
      await client.send(new CreateBucketCommand({ Bucket: bucket }));
    } catch (error) {
      if (!(error instanceof BucketAlreadyOwnedByYou)) throw error;
    }
    // 浏览器从 app 的 origin 直传文件（presigned PUT）、跟随下载的跳转读取模型，都是跨域请求。
    await client.send(
      new PutBucketCorsCommand({
        Bucket: bucket,
        CORSConfiguration: {
          CORSRules: [
            {
              AllowedOrigins: ["http://localhost:*", "http://127.0.0.1:*"],
              AllowedMethods: ["GET", "HEAD", "PUT"],
              AllowedHeaders: ["*"],
              ExposeHeaders: ["ETag"],
              MaxAgeSeconds: 600,
            },
          ],
        },
      }),
    );
    // 只在本地的存储上这样设置公开读：Cloudflare R2 没有 bucket policy，公开读靠它自己的公开域名。
    await client.send(
      new PutBucketPolicyCommand({
        Bucket: bucket,
        Policy: JSON.stringify({
          Version: "2012-10-17",
          Statement: [
            {
              Effect: "Allow",
              Principal: "*",
              Action: ["s3:GetObject"],
              Resource: PUBLIC_PREFIXES.map(
                (prefix) => `arn:aws:s3:::${bucket}/${prefix}*`,
              ),
            },
          ],
        }),
      }),
    );
  } finally {
    client.destroy();
  }
}

async function emptyBucket(client, bucket) {
  let token;
  do {
    let page;
    try {
      page = await client.send(
        new ListObjectsV2Command({ Bucket: bucket, ContinuationToken: token }),
      );
    } catch (error) {
      if (error instanceof NoSuchBucket) return;
      throw error;
    }
    const keys = (page.Contents ?? []).map(({ Key }) => ({ Key }));
    if (keys.length > 0) {
      await client.send(
        new DeleteObjectsCommand({
          Bucket: bucket,
          Delete: { Objects: keys, Quiet: true },
        }),
      );
    }
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);
}
