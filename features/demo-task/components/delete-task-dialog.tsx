"use client";

import { IconTrash } from "@tabler/icons-react";
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
import { useRouter } from "@/lib/i18n/navigation";
import { useMutation } from "@/lib/react-query";

import { deleteTaskMutationOptions } from "../api/delete-task";

interface DeleteTaskDialogProps {
  taskId: string;
  taskName: string;
}

export function DeleteTaskDialog({ taskId, taskName }: DeleteTaskDialogProps) {
  const t = useTranslations("demo-task.deleteTask");
  const router = useRouter();
  const deleteTask = useMutation(deleteTaskMutationOptions());
  return (
    <DialogRoot>
      <DialogTrigger render={<Button variant="ghost" />}>
        <IconTrash aria-hidden />
        {t("trigger")}
      </DialogTrigger>
      <DialogPortal>
        <DialogBackdrop />
        <DialogPopup>
          <DialogTitle>{t("title", { name: taskName })}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
          <div className="mt-6 flex justify-end gap-2">
            <DialogClose render={<Button variant="ghost" />}>
              {t("cancel")}
            </DialogClose>
            <Button
              variant="danger"
              disabled={deleteTask.isPending}
              onClick={() =>
                deleteTask.mutate(
                  { taskId },
                  // The factory has already cleared the caches; this handles
                  // only this page's own reaction: leaving the deleted task's
                  // detail page.
                  { onSuccess: () => router.push("/demos/tasks") },
                )
              }
            >
              {t("confirm")}
            </Button>
          </div>
        </DialogPopup>
      </DialogPortal>
    </DialogRoot>
  );
}
