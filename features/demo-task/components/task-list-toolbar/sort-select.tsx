"use client";

import { IconCheck, IconChevronDown } from "@tabler/icons-react";
import { useTranslations } from "next-intl";

import {
  SelectIcon,
  SelectItem,
  SelectItemIndicator,
  SelectItemText,
  SelectPopup,
  SelectPortal,
  SelectPositioner,
  SelectRoot,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { TASK_SORT_MESSAGE_KEYS, TASK_SORTS } from "../../constants/task-list";
import type { TaskListParams } from "../../utils/task-urls";

interface SortSelectProps {
  selected: TaskListParams;
  onNavigate: (params: TaskListParams) => void;
}

/** 换排序时回到第一页。 */
export function SortSelect({ selected, onNavigate }: SortSelectProps) {
  const t = useTranslations("demo-task");
  const items = TASK_SORTS.map((value) => ({
    value,
    label: t(`taskSort.${TASK_SORT_MESSAGE_KEYS[value]}`),
  }));
  return (
    <SelectRoot
      size="sm"
      items={items}
      value={selected.sort}
      onValueChange={(sort) => {
        if (sort) onNavigate({ ...selected, sort, page: 1 });
      }}
    >
      <SelectTrigger aria-label={t("taskListToolbar.sort")} className="w-32">
        <SelectValue />
        <SelectIcon>
          <IconChevronDown className="size-4" aria-hidden />
        </SelectIcon>
      </SelectTrigger>
      <SelectPortal>
        <SelectPositioner sideOffset={6} alignItemWithTrigger={false}>
          <SelectPopup>
            {items.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                <SelectItemText className="flex-1">{item.label}</SelectItemText>
                <SelectItemIndicator>
                  <IconCheck className="size-4" aria-hidden />
                </SelectItemIndicator>
              </SelectItem>
            ))}
          </SelectPopup>
        </SelectPositioner>
      </SelectPortal>
    </SelectRoot>
  );
}
