import { cn } from "@/lib/cn";

/** 任务各页面的标题。标题后的句点只是装饰，不进可访问名称。 */
export function PageHeading({
  title,
  className,
}: {
  title: string;
  className?: string;
}) {
  return (
    <h1
      className={cn(
        "text-4xl font-medium tracking-[-0.04em] sm:text-5xl",
        className,
      )}
    >
      {title}
      <span aria-hidden className="text-primary">
        .
      </span>
    </h1>
  );
}
