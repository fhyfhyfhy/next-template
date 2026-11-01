"use client";

import { IconPhotoUp } from "@tabler/icons-react";
import { useTranslations } from "next-intl";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { useMutation } from "@/lib/react-query";

import type { Task } from "../../api/get-task";
import { updateTaskCoverMutationOptions } from "../../api/update-task-cover";
import { TaskCover } from "../task-cover";

interface TaskCoverPanelProps {
  task: Task;
  editable: boolean;
}

/**
 * The browser uploads the cover straight to the backend. After a successful
 * upload the factory refreshes the detail and list queries and expires the list
 * page's server cache.
 */
export function TaskCoverPanel({ task, editable }: TaskCoverPanelProps) {
  const t = useTranslations("demo-task.taskCover");
  const upload = useMutation(updateTaskCoverMutationOptions());
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
          {upload.isPending ? t("uploading") : t("change")}
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) upload.mutate({ taskId: task.id, file });
            }}
          />
        </label>
      )}
    </div>
  );
}
