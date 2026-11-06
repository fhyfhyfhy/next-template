import "server-only";
import { type Kysely, sql } from "kysely";
import type { Client } from "pg";

import { createDedicatedClient } from "@/lib/db";

import type { TaskTables } from "./tables";

// 任务的状态或日志变化后，经 Postgres 的 LISTEN/NOTIFY 通知正在推送这个任务日志的 SSE 连接。generator 可能
// 在另一个进程里推进任务（advisory lock 决定谁推进），进程内的事件传不过去；NOTIFY 送达同一个库上的所有监听连接。

// e2e/backend.ts 在库里直接改任务时也发这个通知，改名时一起改。
const CHANNEL = "task_changed";

/** 在写入的事务里调用：事务提交时 Postgres 才发出通知，回滚就不发，监听方不会读到没提交的数据。 */
export async function notifyTaskChanged(
  trx: Kysely<TaskTables>,
  taskId: string,
) {
  await sql`select pg_notify(${CHANNEL}, ${taskId})`.execute(trx);
}

interface Listener {
  /** 任务变化了。 */
  onChange: () => void;
  /** 监听连接断开了，之后的变化收不到，订阅方要结束自己。 */
  onLost: () => void;
}

interface ListenerConnection {
  client: Promise<Client>;
  listeners: Map<string, Set<Listener>>;
}

declare global {
  // 每个进程只开一条专用的监听连接，在内存里分发给各个 SSE 流；连接池里的连接会被别的查询借走，
  // 不能用来 LISTEN。挂在 globalThis 上：dev 热更新重新执行模块时沿用它，不会多开连接。
  var __taskListener: ListenerConnection | undefined;
}

function connect(): ListenerConnection {
  const listeners = new Map<string, Set<Listener>>();
  const current: ListenerConnection = {
    listeners,
    client: (async () => {
      const client = createDedicatedClient();
      client.on("notification", ({ payload }) => {
        for (const listener of listeners.get(payload ?? "") ?? []) {
          listener.onChange();
        }
      });
      // 连接断开后丢掉它，下一个订阅重新连接；已经订阅的流收不到之后的通知，通知它们结束。
      client.on("error", () => drop(current));
      await client.connect();
      await client.query(`listen ${CHANNEL}`);
      return client;
    })(),
  };
  current.client.catch(() => drop(current));
  return current;
}

function drop(current: ListenerConnection) {
  if (globalThis.__taskListener === current) {
    globalThis.__taskListener = undefined;
  }
  for (const set of current.listeners.values()) {
    for (const listener of set) listener.onLost();
  }
  current.listeners.clear();
  void current.client.then((client) => client.end()).catch(() => {});
}

/**
 * 任务 `taskId` 每次变化（推进、重试、删除）时调用 `onChange`；监听连接断开时调用 `onLost`，之后不再通知。
 * 等监听连接就绪后才返回，之后发生的变化不会漏掉。返回取消订阅的函数。
 */
export async function subscribeTaskChanges(taskId: string, listener: Listener) {
  const current = (globalThis.__taskListener ??= connect());
  const set = current.listeners.get(taskId) ?? new Set();
  set.add(listener);
  current.listeners.set(taskId, set);
  await current.client;
  return () => {
    set.delete(listener);
    if (set.size === 0) current.listeners.delete(taskId);
  };
}
