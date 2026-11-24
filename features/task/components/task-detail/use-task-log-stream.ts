import { useEffect, useEffectEvent, useState } from "react";

import { streamTaskLogs } from "../../api/get-task-logs";
import type { TaskStatus } from "../../types/task-filters";

type TaskLogStreamState = "streaming" | "ended" | "failed";

/**
 * 订阅任务的生成日志，返回目前收到的日志行和推送状态。日志是 SSE 推送的追加流，不属于任何 query，累积在 hook
 * 自己的 state 里。卸载时中止连接。
 * `active` 表示日志还会追加。它或 `taskId` 变化时清空日志、重新订阅，每次订阅先收到那一刻的完整日志：`active`
 * 变为 false（任务到终态）时读一遍完整日志，变为 true（比如重试确认后）时订阅新一轮的日志。推送结束时调用 `onEnd`，
 * 传入任务的终态。
 */
export function useTaskLogStream(
  taskId: string,
  active: boolean,
  onEnd: (status: TaskStatus) => void,
) {
  const [lines, setLines] = useState<string[]>([]);
  const [state, setState] = useState<TaskLogStreamState>("streaming");
  const handleEnd = useEffectEvent(onEnd);
  // 在渲染中重置 state，不让调用方换 key 重新挂载：日志区可以聚焦，重新挂载会让聚焦在上面的键盘焦点掉到 body。
  const [subscription, setSubscription] = useState({ taskId, active });
  if (subscription.taskId !== taskId || subscription.active !== active) {
    setSubscription({ taskId, active });
    setLines([]);
    setState("streaming");
  }

  // active 不在函数体里读，列为依赖是为了它变化时重新订阅。
  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        for await (const event of streamTaskLogs(taskId, controller.signal)) {
          // 防的竞态：重新订阅（taskId 或 active 变化）时，上一轮的流在 abort 之后仍会交出已经读到的事件
          // （streamTaskLogs），写进 state 就混进了新一轮的日志。目前没有测试覆盖这个守卫。
          if (controller.signal.aborted) return;
          if (event.type === "log") {
            setLines((current) => [...current, event.line]);
            continue;
          }
          setState("ended");
          handleEnd(event.status);
        }
      } catch {
        if (!controller.signal.aborted) setState("failed");
      }
    })();
    return () => controller.abort();
  }, [taskId, active]);

  return { lines, state };
}
