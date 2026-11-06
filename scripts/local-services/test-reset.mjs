import pg from "pg";
import { afterAll, beforeAll, beforeEach } from "vitest";

import { databaseUrl, DATASETS } from "./datasets.mjs";
import { restoreSeedRows } from "./services.mjs";

// vitest.config.mts 里 db 项目的 setupFiles：每个测试都从种子数据开始。

const client = new pg.Client({
  connectionString: databaseUrl(DATASETS.test.database),
});

beforeAll(() => client.connect());
afterAll(() => client.end());
beforeEach(() => restoreSeedRows(client));
