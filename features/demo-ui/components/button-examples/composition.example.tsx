"use client";

import { Button, buttonVariants } from "@/components/ui/button";
import { Link } from "@/lib/i18n/navigation";

export const metadata = {
  title: "Action hierarchy and links",
  description:
    "Buttons use variant; a link reuses their look through buttonVariants.",
  order: 20,
};

/** The link uses buttonVariants directly, keeping native link semantics. */
export function Example() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button variant="secondary">Primary action</Button>
      <Button variant="outline">Secondary action</Button>
      <Link
        href="/demos/ui?component=dialog"
        className={buttonVariants({ variant: "ghost" })}
      >
        View Dialog
      </Link>
    </div>
  );
}
