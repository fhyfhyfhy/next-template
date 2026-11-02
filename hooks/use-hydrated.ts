"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};
const getSnapshot = () => true;
const getServerSnapshot = () => false;

/** 服务端渲染和 hydration 时返回 false，hydration 之后返回 true；在浏览器里直接渲染（比如客户端导航）时一开始就是 true。 */
export function useHydrated() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
