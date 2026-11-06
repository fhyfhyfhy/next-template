import type { ReactNode } from "react";

interface StatusMessageProps {
  title: ReactNode;
  description: ReactNode;
  /** 让用户离开这个状态的操作，比如重试或者返回。 */
  action: ReactNode;
}

/** 占据整块内容区的状态提示，比如出错页和找不到页：标题、说明和一个操作。 */
export function StatusMessage({
  title,
  description,
  action,
}: StatusMessageProps) {
  return (
    <div className="py-16 text-center">
      <h1 className="text-3xl font-medium tracking-tight">{title}</h1>
      <p className="mt-3 text-sm text-muted-foreground">{description}</p>
      <div className="mt-6">{action}</div>
    </div>
  );
}
