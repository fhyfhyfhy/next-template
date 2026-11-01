import { IconArrowUpRight } from "@tabler/icons-react";

import { Badge } from "@/components/ui/badge";
import { Link } from "@/lib/i18n/navigation";

export const metadata = {
  title: "Rendered as a link",
  description:
    "render swaps in a link, which keeps a link's semantics and keyboard behavior.",
  order: 20,
};

/**
 * Badge provides only the look; the element passed to render handles
 * interaction.
 */
export function Example() {
  return (
    <Badge
      variant="outline"
      render={<Link href="/demos/tasks?status=failed" />}
      className="hover:text-foreground"
    >
      View failed tasks
      <IconArrowUpRight aria-hidden />
    </Badge>
  );
}
