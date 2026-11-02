"use client";

import { Button } from "@/components/ui/button";
import {
  DialogBackdrop,
  DialogClose,
  DialogDescription,
  DialogPopup,
  DialogPortal,
  DialogRoot,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export const metadata = {
  title: "Basic usage",
  description: "Has every import and the structure it needs; copy it as is.",
  order: 10,
};

/** The caller composes every Base UI part explicitly. */
export function Example() {
  return (
    <DialogRoot>
      <DialogTrigger render={<Button variant="outline" />}>
        View details
      </DialogTrigger>
      <DialogPortal>
        <DialogBackdrop />
        <DialogPopup>
          <DialogTitle>A component system of your own</DialogTitle>
          <DialogDescription>
            Each part keeps its own API, so you compose the interaction the page
            needs.
          </DialogDescription>
          <div className="mt-6 flex justify-end">
            <DialogClose render={<Button />}>Close</DialogClose>
          </div>
        </DialogPopup>
      </DialogPortal>
    </DialogRoot>
  );
}
