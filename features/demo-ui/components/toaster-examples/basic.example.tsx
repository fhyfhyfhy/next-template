"use client";

import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toaster";

export const metadata = {
  title: "Basic usage",
  description:
    "Once the root layout renders Toaster, any client code can call toast().",
  order: 10,
};

/** The message says what happened; the description adds what to know next. */
export function Example() {
  return (
    <Button
      variant="outline"
      onClick={() =>
        toast.success("Invitation sent", {
          description: "They will show up in the member list once they accept.",
        })
      }
    >
      Send invitation
    </Button>
  );
}
