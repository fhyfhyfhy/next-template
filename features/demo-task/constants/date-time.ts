/** 任务和评论的时间显示格式，传给 next-intl 的 `format.dateTime`；时区由 lib/i18n-request.ts 统一指定。 */
export const DATE_TIME_FORMAT = {
  dateStyle: "medium",
  timeStyle: "short",
} as const;
