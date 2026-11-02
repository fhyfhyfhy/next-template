"use client";

import { IconDownload, IconRefresh } from "@tabler/icons-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toaster";
import { useMutation } from "@/lib/react-query";

import type { Task } from "../../api/get-task";
import { getTaskModel } from "../../api/get-task-model";
import { retryTaskMutationOptions } from "../../api/retry-task";
import { TASK_NOT_RETRYABLE } from "../../constants/error-codes";
import { isTaskActionError } from "../../utils/task-action-error";
import { DeleteTaskDialog } from "../delete-task-dialog";

export function TaskActions({ task }: { task: Task }) {
  const t = useTranslations("demo-task.taskActions");
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
            {t("retry")}
          </Button>
        )}
        {task.status === "done" && (
          <Button
            variant="outline"
            disabled={downloading}
            onClick={async () => {
              setDownloading(true);
              try {
                saveFile(await getTaskModel(task.id), `${task.name}.glb`);
              } catch {
                // 下载不经过 React Query，失败提示由这里负责，不占用全局请求错误的 toast ID。
                toast.error(t("downloadFailed"));
              } finally {
                setDownloading(false);
              }
            }}
          >
            <IconDownload aria-hidden />
            {t("download")}
          </Button>
        )}
        <DeleteTaskDialog taskId={task.id} taskName={task.name} />
      </div>
      {isTaskActionError(retry.error, TASK_NOT_RETRYABLE) && (
        <p role="status" className="text-sm text-muted-foreground">
          {t("notRetryable")}
        </p>
      )}
    </div>
  );
}

/** 让浏览器把 `blob` 存成文件：经一个临时的下载链接触发。 */
function saveFile(blob: Blob, filename: string) {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(objectUrl);
}
