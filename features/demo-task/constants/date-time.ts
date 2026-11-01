/**
 * How task and comment times display, passed to next-intl's `format.dateTime`;
 * lib/i18n/request.ts sets one time zone for all of them.
 */
export const DATE_TIME_FORMAT = {
  dateStyle: "medium",
  timeStyle: "short",
} as const;
