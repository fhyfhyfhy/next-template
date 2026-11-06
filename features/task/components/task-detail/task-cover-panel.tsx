"use client";

import { IconPhotoUp } from "@tabler/icons-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { buttonVariants } from "@/components/ui/button";
import {
  checkUploadFile,
  UPLOAD_PURPOSES,
  type UploadFileProblem,
} from "@/features/upload";
import { cn } from "@/lib/cn";
import { useMutation } from "@/lib/react-query";

import type { Task } from "../../api/get-task";
import {
  isCoverRejection,
  updateTaskCoverMutationOptions,
} from "../../api/update-task-cover";
import { TaskCover } from "../task-cover";

interface TaskCoverPanelProps {
  task: Task;
  editable: boolean;
}

const MAX_COVER_MB = UPLOAD_PURPOSES["task-cover"].maxSize / 1024 / 1024;

/**
 * 封面图由浏览器直接上传到对象存储，不经过 Next；不是图片或太大的文件在上传前就拦下。上传成功后工厂刷新详情、
 * 列表 query，Server Action 让列表页的服务端缓存失效。
 */
export function TaskCoverPanel({ task, editable }: TaskCoverPanelProps) {
  const t = useTranslations();
  const upload = useMutation(updateTaskCoverMutationOptions(t));
  const [problem, setProblem] = useState<UploadFileProblem | null>(null);
  return (
    <div className="space-y-3">
      <TaskCover
        data-testid="task-cover"
        coverUrl={task.coverUrl}
        className="aspect-4/3 w-full rounded-panel"
      />
      {editable && (
        <label
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "w-full cursor-pointer has-focus-visible:ring-2 has-focus-visible:ring-ring",
            upload.isPending && "pointer-events-none opacity-40",
          )}
        >
          <IconPhotoUp aria-hidden />
          {upload.isPending
            ? t("task.taskCover.uploading")
            : t("task.taskCover.change")}
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (!file) return;
              const found = checkUploadFile("task-cover", file);
              setProblem(found);
              if (!found) upload.mutate({ taskId: task.id, file });
            }}
          />
        </label>
      )}
      {problem && (
        <p role="alert" className="text-sm text-destructive">
          {problem === "contentType"
            ? t("task.taskCover.notAnImage")
            : t("task.taskCover.tooLarge", { max: String(MAX_COVER_MB) })}
        </p>
      )}
      {isCoverRejection(upload.error) && (
        <p role="alert" className="text-sm text-destructive">
          {t("task.taskCover.rejected")}
        </p>
      )}
    </div>
  );
}
