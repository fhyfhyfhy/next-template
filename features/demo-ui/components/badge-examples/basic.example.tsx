import { Badge } from "@/components/ui/badge";

export const metadata = {
  title: "Basic usage",
  description: "Has every import and the structure it needs; copy it as is.",
  order: 10,
};

/** variant sets how much weight a status carries. */
export function Example() {
  return (
    <div className="flex flex-wrap gap-2">
      <Badge>Generating</Badge>
      <Badge variant="muted">Completed</Badge>
      <Badge variant="outline">Queued</Badge>
      <Badge variant="danger">Failed</Badge>
    </div>
  );
}
