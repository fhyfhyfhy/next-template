"use client";

// 任务各页面的错误边界就是 app/[locale]/error.tsx 那个，放在这一层是为了出错时 header 还在。
export { default } from "../error";
