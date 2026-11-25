import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableRowHeader,
} from "@/components/ui/table";

export const metadata = {
  title: "基本用法",
  description: "包含完整 import 与必要结构，可直接复制。",
  order: 10,
};

/** aria-label 给表格命名；每一行由 TableRowHeader 命名，数字右对齐、用等宽数字。 */
export function Example() {
  return (
    <div className="w-full max-w-md">
      <Table aria-label="成员">
        <TableHeader>
          <TableRow>
            <TableHead>成员</TableHead>
            <TableHead className="text-right">进行中的任务</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableRowHeader>li.na@example.com</TableRowHeader>
            <TableCell className="text-right tabular-nums">3</TableCell>
          </TableRow>
          <TableRow>
            <TableRowHeader>wang.fang@example.com</TableRowHeader>
            <TableCell className="text-right tabular-nums">0</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}
