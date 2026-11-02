"use client";

import { useDebouncedValue } from "@mantine/hooks";
import { IconSearch } from "@tabler/icons-react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/cn";
import { keepPreviousData, useQuery } from "@/lib/react-query";

import { searchTasksQueryOptions } from "../api/search-tasks";
import { TaskLinkRow } from "./task-link-row";

const DEBOUNCE_MS = 300;

/**
 * Search as you type: when typing pauses, the term goes into the URL shallowly
 * (replaceState, with no server render and no history entry), and the query key
 * comes only from the committed term in the URL. A new term aborts the old
 * request, and the old results stay until the new ones arrive.
 */
export function TaskSearch() {
  const t = useTranslations("demo-task.taskSearch");
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

  // With an empty term the query is disabled, yet keepPreviousData still serves
  // the last results as placeholder data, so both the status and the results go
  // by this.
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
          {t("label")}
        </label>
        <Input
          id="task-search"
          type="search"
          value={input}
          placeholder={t("placeholder")}
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
            {search.isPlaceholderData && t("updating")}
            {!search.isPlaceholderData &&
              search.data &&
              t("found", { count: search.data.length })}
            {!search.data && search.error && (
              <span className="text-destructive">{t("failed")}</span>
            )}
            {!search.data && search.isFetching && t("searching")}
          </>
        )}
      </div>
      {searching && search.data && search.data.length > 0 && (
        <ul
          aria-label={t("results")}
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
