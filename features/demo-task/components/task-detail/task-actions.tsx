"use client";

import { IconDownload, IconRefresh } from "@tabler/icons-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toaster";
import { useMutation } from "@/lib/react-query";

import type { Task } from "../../api/get-task";
import { downloadTaskModel } from "../../api/get-task-model";
import { retryTaskMutationOptions } from "../../api/retry-task";
import { TASK_NOT_RETRYABLE } from "../../constants/error-codes";
import { isTaskActionError } from "../../utils/task-action-error";
import { DeleteTaskDialog } from "../delete-task-dialog";

export function TaskActions({ task }: { task: Task }) {
  const retry = useMutation(retryTaskMutationOptions());
  const [downloading, setDownloading] = useState(false);
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {task.status === "failed" && (
          <Button
            variant="outline"
            disabled={retry.isPending}
            onClick={() => retry.mutate({ taskId: task.id })}
          >
            <IconRefresh aria-hidden />
            重试
          </Button>
        )}
        {task.status === "done" && (
          <Button
            variant="outline"
            disabled={downloading}
            onClick={async () => {
              setDownloading(true);
              try {
                await downloadTaskModel(task.id, task.name);
              } catch {
                // 下载不经过 React Query，失败提示由这里负责，不占用全局请求错误的 toast ID。
                toast.error("下载失败，请稍后重试");
              } finally {
                setDownloading(false);
              }
            }}
          >
            <IconDownload aria-hidden />
            下载模型
          </Button>
        )}
        <DeleteTaskDialog taskId={task.id} taskName={task.name} />
      </div>
      {isTaskActionError(retry.error, TASK_NOT_RETRYABLE) && (
        <p role="status" className="text-sm text-muted-foreground">
          任务状态已变化，已刷新为最新状态。
        </p>
      )}
    </div>
  );
}
