// 固定时区：服务端渲染和浏览器 hydration 得到同样的文本，不会出现 hydration 不一致。
const formatter = new Intl.DateTimeFormat("zh-CN", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Shanghai",
});

export function formatDateTime(timestamp: number) {
  return formatter.format(timestamp);
}
