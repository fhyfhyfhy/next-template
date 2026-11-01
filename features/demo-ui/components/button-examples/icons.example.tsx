import { IconPlus } from "@tabler/icons-react";

import { Button } from "@/components/ui/button";

export const metadata = {
  title: "Icon size",
  description: "Icons default to 16px; size-8 sets one to 32px.",
  order: 30,
};

/** An icon given an explicit size-* keeps the caller's size. */
export function Example() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button size="lg">
        <IconPlus aria-hidden />
        Default 16px
      </Button>
      <Button size="lg" variant="outline">
        <IconPlus className="size-8" aria-hidden />
        Custom 32px
      </Button>
    </div>
  );
}
