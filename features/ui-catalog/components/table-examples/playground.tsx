import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableRowHeader,
} from "@/components/ui/table";

export interface TableConfig {
  rows: number;
  label: string;
}

// 括号将结束标记保留在表达式内；UI catalog 页面只替换标记之间的 JSON 初始值。
// prettier-ignore
export const initialConfig: TableConfig = (/* @example-config */ {
  "rows": 3,
  "label": "生成任务"
} /* @end-example-config */);

const statusLabels = {
  running: "生成中",
  done: "已完成",
  queued: "排队中",
  failed: "失败",
};

const tasks: {
  id: string;
  name: string;
  status: keyof typeof statusLabels;
  downloads: number;
}[] = [
  { id: "robot-arm", name: "机械臂", status: "running", downloads: 12 },
  { id: "ceramic-vase", name: "陶瓷花瓶", status: "done", downloads: 40 },
  { id: "delivery-drone", name: "快递无人机", status: "queued", downloads: 8 },
  { id: "wooden-chair", name: "木椅", status: "done", downloads: 24 },
  { id: "street-lamp", name: "路灯", status: "failed", downloads: 0 },
];

/** 不传参数时使用初始配置；UI catalog 页面传入面板里的配置。 */
export function TablePlayground({
  config = initialConfig,
}: { config?: TableConfig } = {}) {
  return (
    <div className="w-full max-w-xl">
      <Table aria-label={config.label}>
        <TableHeader>
          <TableRow>
            <TableHead>任务</TableHead>
            <TableHead>状态</TableHead>
            <TableHead className="text-right">下载次数</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tasks.slice(0, config.rows).map((task) => (
            <TableRow key={task.id}>
              <TableRowHeader>{task.name}</TableRowHeader>
              <TableCell>
                <Badge variant={task.status === "failed" ? "danger" : "muted"}>
                  {statusLabels[task.status]}
                </Badge>
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {task.downloads}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
