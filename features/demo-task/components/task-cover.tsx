import { IconCube } from "@tabler/icons-react";
import Image from "next/image";

import { cn } from "@/lib/cn";

interface TaskCoverProps {
  coverUrl: string | null;
  className?: string;
  "data-testid"?: string;
}

/**
 * The task's cover image, decorative; a placeholder shows when there is none.
 */
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
    // Covers come from the Mock API's address, whose port depends on
    // configuration, so they skip next/image's optimizer.
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
