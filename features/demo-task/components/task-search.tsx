"use client";

import { useDebouncedValue } from "@mantine/hooks";
import { IconSearch } from "@tabler/icons-react";
import { useTranslations } from "next-intl";
import { useQueryStates } from "nuqs";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/cn";
import { keepPreviousData, useQuery } from "@/lib/react-query";

import { searchTasksQueryOptions } from "../api/search-tasks";
import { taskSearchSearchParams } from "../utils/task-search-search-params";
import { TaskLinkRow } from "./task-link-row";

const DEBOUNCE_MS = 300;

/**
 * 边输入边搜索：关键词随输入 shallow 写进 URL（不触发服务端渲染，也不留历史记录），刷新和分享链接都能还原。
 * query key 来自 debounce 后的关键词，请求等输入停顿才发。换关键词时旧请求被中止，新结果到达前继续显示旧结果。
 */
export function TaskSearch() {
  const t = useTranslations("demo-task");
  const [{ q }, setSearchParams] = useQueryStates(taskSearchSearchParams);
  const [term] = useDebouncedValue(q.trim(), DEBOUNCE_MS);

  // 关键词为空时 query 关着，keepPreviousData 却仍把上一次的结果当占位数据，所以状态和结果都按它判断。
  const searching = term !== "";
  const search = useQuery({
    ...searchTasksQueryOptions(term),
    enabled: searching,
    placeholderData: keepPreviousData,
  });

  return (
    <div className="max-w-2xl">
      <div className="relative">
        <IconSearch
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <label htmlFor="task-search" className="sr-only">
          {t("taskSearch.label")}
        </label>
        <Input
          id="task-search"
          type="search"
          value={q}
          placeholder={t("taskSearch.placeholder")}
          className="pl-9"
          onChange={(event) => void setSearchParams({ q: event.target.value })}
        />
      </div>
      <div
        className="mt-4 min-h-6 text-sm text-muted-foreground"
        aria-live="polite"
      >
        {searching && (
          <>
            {search.isPlaceholderData && t("taskSearch.updating")}
            {!search.isPlaceholderData &&
              search.data &&
              t("taskSearch.found", { count: search.data.length })}
            {!search.data && search.error && (
              <span className="text-destructive">{t("taskSearch.failed")}</span>
            )}
            {!search.data && search.isFetching && t("taskSearch.searching")}
          </>
        )}
      </div>
      {searching && search.data && search.data.length > 0 && (
        <ul
          aria-label={t("taskSearch.results")}
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
