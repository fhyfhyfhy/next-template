"use client";

import { IconCheck, IconChevronDown } from "@tabler/icons-react";
import { useRouter } from "next/navigation";

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

import { TASK_SORT_LABELS, TASK_SORTS } from "../../constants/task-list";
import { taskListHref, type TaskListParams } from "../../utils/task-urls";

const items = TASK_SORTS.map((value) => ({
  value,
  label: TASK_SORT_LABELS[value],
}));

/** 换排序时回到第一页；用 push，Back 可以撤销这次选择。 */
export function SortSelect({ params }: { params: TaskListParams }) {
  const router = useRouter();
  return (
    <SelectRoot
      size="sm"
      items={items}
      value={params.sort}
      onValueChange={(sort) => {
        if (sort) router.push(taskListHref({ ...params, sort, page: 1 }));
      }}
    >
      <SelectTrigger aria-label="排序" className="w-32">
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
