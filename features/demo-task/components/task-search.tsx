"use client";

import { useDebouncedValue } from "@mantine/hooks";
import { IconSearch } from "@tabler/icons-react";
import { useTranslations } from "next-intl";
import { useQueryStates } from "nuqs";
import { useState } from "react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/cn";
import { useQuery } from "@/lib/react-query";

import { searchTasksQueryOptions } from "../api/search-tasks";
import { taskSearchSearchParams } from "../utils/task-search-search-params";
import { TaskLinkRow } from "./task-link-row";

const DEBOUNCE_MS = 300;

/**
 * 边输入边搜索：关键词随输入 shallow 写进 URL（不触发服务端渲染，也不留历史记录），刷新和分享链接都能还原。
 * query key 来自 debounce 后的关键词，请求等输入停顿才发。换关键词时旧请求被中止，新结果到达前继续显示旧结果。
 */
export function TaskSearch() {
  const t = useTranslations();
  const [{ q }, setSearchParams] = useQueryStates(taskSearchSearchParams);
  const [term] = useDebouncedValue(q.trim(), DEBOUNCE_MS);
  // 用户最后一次清空搜索框的时刻：清空之前的结果属于上一轮搜索，不拿来给新的一轮当占位。
  const [clearedAt, setClearedAt] = useState(0);

  // 关键词为空时 query 关着，占位数据却可能还在，所以状态和结果都按 searching 判断。
  const searching = term !== "";
  const search = useQuery({
    ...searchTasksQueryOptions(term),
    enabled: searching,
    // 改关键词时，新结果返回前继续显示上一次的结果；清空过就从“搜索中”开始。
    placeholderData: (previous, previousQuery) =>
      previousQuery && previousQuery.state.dataUpdatedAt > clearedAt
        ? previous
        : undefined,
  });

  return (
    <div className="max-w-2xl">
      <div className="relative">
        <IconSearch
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <label htmlFor="task-search" className="sr-only">
          {t("demo-task.taskSearch.label")}
        </label>
        <Input
          id="task-search"
          type="search"
          value={q}
          placeholder={t("demo-task.taskSearch.placeholder")}
          className="pl-9"
          onChange={(event) => {
            const value = event.target.value;
            if (value.trim() === "") setClearedAt(Date.now());
            void setSearchParams({ q: value });
          }}
        />
      </div>
      <div
        className="mt-4 min-h-6 text-sm text-muted-foreground"
        aria-live="polite"
      >
        {searching && (
          <>
            {search.isPlaceholderData && t("demo-task.taskSearch.updating")}
            {!search.isPlaceholderData &&
              search.data &&
              t("demo-task.taskSearch.found", { count: search.data.length })}
            {!search.data && search.error && (
              <span className="text-destructive">
                {t("demo-task.taskSearch.failed")}
              </span>
            )}
            {!search.data &&
              search.isFetching &&
              t("demo-task.taskSearch.searching")}
          </>
        )}
      </div>
      {searching && search.data && search.data.length > 0 && (
        <ul
          aria-label={t("demo-task.taskSearch.results")}
          className={cn(
            "mt-2 divide-y divide-border rounded-panel border border-border bg-card transition-opacity",
            search.isPlaceholderData && "opacity-50",
          )}
        >
          {search.data.map((task) => (
            <li key={task.id} className="p-3">
              <TaskLinkRow task={task} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
