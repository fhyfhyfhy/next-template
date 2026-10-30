"use server";

import { refresh } from "next/cache";
import { draftMode } from "next/headers";
import { z } from "zod";

import { MOCK_API_RUNNING } from "../constants/mock-api";

/**
 * 开关当前浏览器的 Draft Mode：开启后这个浏览器的请求跳过 `use cache`，每次重新执行、结果也不写入缓存，
 * 其他访客不受影响。Draft Mode 的 cookie 对整个站点生效，只在 demo 模式下允许开启：
 * 接着真实后端时，任何访客都能借它绕过缓存，把每个请求都压到后端。
 * `refresh()` 清空客户端路由缓存，之前访问过的页面不会再用切换前的结果。
 */
export async function setDraftModeAction(enabled: boolean) {
  if (!MOCK_API_RUNNING) {
    throw new Error("Draft Mode 开关只在 demo 模式下可用");
  }
  const draft = await draftMode();
  if (z.boolean().parse(enabled)) {
    draft.enable();
  } else {
    draft.disable();
  }
  refresh();
}
