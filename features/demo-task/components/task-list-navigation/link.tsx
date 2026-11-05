"use client";

import Link from "next/link";
import type { Nullable } from "nuqs";
import type { ComponentProps } from "react";

import {
  serializeTaskListSearchParams,
  type TaskListSearchParams,
} from "../../utils/task-list-search-params";
import { useTaskListSearchParams } from "./use-task-list-search-params";

type TaskListLinkProps = Omit<
  ComponentProps<typeof Link>,
  "href" | "onNavigate"
> & {
  /** 在当前选择上要改的值，`null` 回到默认值。 */
  values: Partial<Nullable<TaskListSearchParams>>;
};

/** 指向全部任务页另一个状态的链接，目标基于当前选择：导航进行中再点，在这次选择的基础上继续改。 */
export function TaskListLink({ values, ...props }: TaskListLinkProps) {
  const [current, setSearchParams] = useTaskListSearchParams();
  const target = { ...current, ...values };
  return (
    <Link
      {...props}
      href={serializeTaskListSearchParams("/demos/tasks", target)}
      // 用 onNavigate 而不是 onClick：Ctrl/Cmd 点击在新标签页打开时不触发它，交给浏览器处理。
      onNavigate={(event) => {
        event.preventDefault();
        void setSearchParams(target);
      }}
    />
  );
}
