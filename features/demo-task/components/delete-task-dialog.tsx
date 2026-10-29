"use client";

import { IconTrash } from "@tabler/icons-react";
import { useRouter } from "next/navigation";

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
  const router = useRouter();
  const deleteTask = useMutation(deleteTaskMutationOptions());
  return (
    <DialogRoot>
      <DialogTrigger render={<Button variant="ghost" />}>
        <IconTrash aria-hidden />
        删除任务
      </DialogTrigger>
      <DialogPortal>
        <DialogBackdrop />
        <DialogPopup>
          <DialogTitle>删除“{taskName}”？</DialogTitle>
          <DialogDescription>
            任务和它的评论都会被删除，不能恢复。
          </DialogDescription>
          <div className="mt-6 flex justify-end gap-2">
            <DialogClose render={<Button variant="ghost" />}>取消</DialogClose>
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
              删除
            </Button>
          </div>
        </DialogPopup>
      </DialogPortal>
    </DialogRoot>
  );
}
