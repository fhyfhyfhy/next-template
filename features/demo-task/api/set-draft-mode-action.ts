"use server";

import { draftMode } from "next/headers";
import { z } from "zod";

import { assertMockApiRunning } from "../utils/assert-mock-api-running";

/**
 * 开关当前浏览器的 Draft Mode：开启后这个浏览器的请求跳过 `use cache`，每次重新执行、结果也不写入缓存，
 * 其他访客不受影响。Draft Mode 的 cookie 对整个站点生效，只在 demo 模式下允许开启：
 * 接着真实后端时，任何访客都能借它绕过缓存，把每个请求都压到后端。
 * 开关写的是 cookie，Server Action 里写 cookie 会刷新当前页面并让客户端的预取失效，之前访问过的页面
 * 不会再用切换前的结果（.agents/skills/next-data-flow/framework-notes.md § Server Action invalidation）。
 */
export async function setDraftModeAction(enabled: boolean) {
  assertMockApiRunning();
  const draft = await draftMode();
  if (z.boolean().parse(enabled)) {
    draft.enable();
  } else {
    draft.disable();
  }
}
