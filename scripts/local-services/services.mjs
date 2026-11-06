import { spawnSync } from "node:child_process";
import { join } from "node:path";
import {
  BucketAlreadyOwnedByYou,
  CreateBucketCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
  NoSuchBucket,
  PutBucketCorsCommand,
  PutBucketPolicyCommand,
  S3Client,
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

const projectRoot = join(import.meta.dirname, "..", "..");

/**
 * 浏览器直接读的前缀：用户上传的文件和种子文件，签发上传、下载模型仍要签名。值和
 * features/upload/constants/storage-keys.ts 的两个前缀一致；本地服务的脚本不依赖示例业务的 feature，所以另写一份，改的时候一起改。
 */
const PUBLIC_PREFIXES = ["uploads/", "seed/"];

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
      "Could not start the local services with Docker Compose; see its output above: Docker may not be running, or ports 54329 and 7070 may be taken, such as by containers from another Compose project",
      { cause: result.error },
    );
  }
}

/**
 * 准备一个数据集：库不存在就创建，执行 migration，初始化 bucket，库里还没有任务时写入种子数据。可以重复执行。
 * `reset` 先删掉库、清空 bucket，数据集回到只有种子数据的状态。
 * @returns {Record<string, string>} 连到这个数据集的环境变量
 */
export async function prepareDataset(
  name,
  { reset = false, seed = true } = {},
) {
  const { database, bucket } = DATASETS[name];
  const env = localEnv(name);
  await createDatabase(database, { reset });
  await migrateDatabase(databaseUrl(database));
  await prepareBucket(bucket, { reset });
  if (seed) seedDataset(env);
  return env;
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
    // 两个进程同时准备同一个数据集（比如两份 checkout 同时跑 pnpm test），后到的建库会撞上唯一约束。
    if (error.code !== "42P04" && error.code !== "23505") throw error;
  } finally {
    await client.end();
  }
}

/**
 * 写入种子数据（features/task/server/seed.ts）。种子要用应用自己的数据层写，那些模块是 TypeScript、带 `@/` 别名和
 * `import "server-only"`，所以在子进程里用 tsx 加载，并打开 react-server 条件，让 server-only 解析成空模块。
 */
function seedDataset(env) {
  const result = spawnSync(
    process.execPath,
    [
      "--conditions=react-server",
      "--import",
      "tsx",
      join(import.meta.dirname, "seed.mjs"),
    ],
    { cwd: projectRoot, stdio: "inherit", env: { ...process.env, ...env } },
  );
  if (result.error || result.status !== 0) {
    throw new Error("Could not write the seed data", { cause: result.error });
  }
}

async function prepareBucket(bucket, { reset }) {
  const client = new S3Client({
    endpoint: STORAGE.endpoint,
    region: "us-east-1",
    credentials: {
      accessKeyId: STORAGE.accessKeyId,
      secretAccessKey: STORAGE.secretAccessKey,
    },
    forcePathStyle: true,
    requestChecksumCalculation: "WHEN_REQUIRED",
  });
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
