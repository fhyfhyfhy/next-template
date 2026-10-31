import { IconCube } from "@tabler/icons-react";
import Image from "next/image";

import { cn } from "@/lib/cn";

interface TaskCoverProps {
  coverUrl: string | null;
  className?: string;
  "data-testid"?: string;
}

/** 任务的封面图，装饰性图片；没有封面图时显示占位图。 */
export function TaskCover({ coverUrl, className, ...props }: TaskCoverProps) {
  if (!coverUrl) {
    return (
      <div
        className={cn(
          "flex items-center justify-center bg-muted text-muted-foreground",
          className,
        )}
        {...props}
      >
        <IconCube className="size-1/3" aria-hidden />
      </div>
    );
  }
  return (
    // 封面图来自 Mock API 的地址，端口随配置变化，不经过 next/image 的优化服务。
    <Image
      src={coverUrl}
      alt=""
      width={480}
      height={360}
      unoptimized
      className={cn("object-cover", className)}
      {...props}
    />
  );
}
