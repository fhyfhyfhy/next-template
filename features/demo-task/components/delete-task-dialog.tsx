"use client";

import { IconTrash } from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  DialogBackdrop,
  DialogClose,
  DialogDescription,
  DialogPopup,
  DialogPortal,
  DialogRoot,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useMutation } from "@/lib/react-query";

import { deleteTaskMutationOptions } from "../api/delete-task";

interface DeleteTaskDialogProps {
  taskId: string;
  taskName: string;
}

export function DeleteTaskDialog({ taskId, taskName }: DeleteTaskDialogProps) {
  const t = useTranslations();
  const router = useRouter();
  const deleteTask = useMutation(deleteTaskMutationOptions(t));
  return (
    <DialogRoot>
      <DialogTrigger render={<Button variant="ghost" />}>
        <IconTrash aria-hidden />
        {t("demo-task.deleteTask.trigger")}
      </DialogTrigger>
      <DialogPortal>
        <DialogBackdrop />
        <DialogPopup>
          <DialogTitle>
            {t("demo-task.deleteTask.title", { name: taskName })}
          </DialogTitle>
          <DialogDescription>
            {t("demo-task.deleteTask.description")}
          </DialogDescription>
          <div className="mt-6 flex justify-end gap-2">
            <DialogClose render={<Button variant="ghost" />}>
              {t("demo-task.deleteTask.cancel")}
            </DialogClose>
            <Button
              variant="danger"
              disabled={deleteTask.isPending}
              onClick={() =>
                deleteTask.mutate(
                  { taskId },
                  // 工厂已经清理了缓存，这里只负责这个页面自己的反应：离开已删除任务的详情页。
                  { onSuccess: () => router.push("/demos/tasks") },
                )
              }
            >
              {t("demo-task.deleteTask.confirm")}
            </Button>
          </div>
        </DialogPopup>
      </DialogPortal>
    </DialogRoot>
  );
}
