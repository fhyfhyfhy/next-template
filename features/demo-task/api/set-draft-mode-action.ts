"use server";

import { draftMode } from "next/headers";
import { z } from "zod";

import { assertDemoBackendEnabled } from "../server/connection";

/**
 * 开关当前浏览器的 Draft Mode：开启后这个浏览器的请求跳过 `use cache`，每次重新执行、结果也不写入缓存，
 * 其他访客不受影响。Draft Mode 的 cookie 对整个站点生效，只在 Demo 后端启用时允许开启：
 * 否则任何访客都能借它绕过缓存，把每个请求都压到项目自己的数据源上。
 * 开关写的是 cookie，Server Action 里写 cookie 会刷新当前页面并让客户端的预取失效，之前访问过的页面
 * 不会再用切换前的结果（.agents/skills/next-data-flow/framework-notes.md § Server Action invalidation）。
 */
export async function setDraftModeAction(enabled: boolean) {
  assertDemoBackendEnabled();
  const draft = await draftMode();
  if (z.boolean().parse(enabled)) {
    draft.enable();
  } else {
    draft.disable();
  }
}
