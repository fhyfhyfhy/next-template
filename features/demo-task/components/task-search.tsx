"use client";

import { useDebouncedValue } from "@mantine/hooks";
import { IconSearch } from "@tabler/icons-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/cn";
import { keepPreviousData, useQuery } from "@/lib/react-query";

import { searchTasksQueryOptions } from "../api/search-tasks";
import { TaskLinkRow } from "./task-link-row";

const DEBOUNCE_MS = 300;

/**
 * 边输入边搜索：输入停顿后把关键词 shallow 写进 URL（replaceState，不触发服务端渲染，也不留历史记录），
 * query key 只来自 URL 里已提交的关键词。换关键词时旧请求被中止，新结果到达前继续显示旧结果。
 */
export function TaskSearch() {
  const committed = useSearchParams().get("q") ?? "";
  const [input, setInput] = useState(committed);
  const [debounced] = useDebouncedValue(input.trim(), DEBOUNCE_MS);

  useEffect(() => {
    if (debounced === committed) return;
    const query = debounced ? `?q=${encodeURIComponent(debounced)}` : "";
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${query}`,
    );
  }, [debounced, committed]);

  // 关键词为空时 query 关着，keepPreviousData 却仍把上一次的结果当占位数据，所以状态和结果都按它判断。
  const searching = committed !== "";
  const search = useQuery({
    ...searchTasksQueryOptions(committed),
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
          搜索任务
        </label>
        <Input
          id="task-search"
          type="search"
          value={input}
          placeholder="按名称或 prompt 搜索"
          className="pl-9"
          onChange={(event) => setInput(event.target.value)}
        />
      </div>
      <div
        className="mt-4 min-h-6 text-sm text-muted-foreground"
        aria-live="polite"
      >
        {searching && (
          <>
            {search.isPlaceholderData && "更新中…"}
            {!search.isPlaceholderData &&
              search.data &&
              `找到 ${search.data.length} 个任务`}
            {!search.data && search.error && (
              <span className="text-destructive">搜索失败</span>
            )}
            {!search.data && search.isFetching && "搜索中…"}
          </>
        )}
      </div>
      {searching && search.data && search.data.length > 0 && (
        <ul
          aria-label="搜索结果"
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
