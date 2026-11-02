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
  title: "Customize each part",
  description: "The caller sets Backdrop's blur and Popup's border separately.",
  order: 20,
};

/**
 * The backdrop and panel styles go to their own parts, with no wrapper props in
 * between.
 */
export function Example() {
  return (
    <DialogRoot>
      <DialogTrigger render={<Button variant="outline" />}>
        Customize backdrop and panel
      </DialogTrigger>
      <DialogPortal>
        <DialogBackdrop className="bg-foreground/60 backdrop-blur-md" />
        <DialogPopup size="sm" className="border-t-4 border-primary">
          <DialogTitle>Each part does its own job.</DialogTitle>
          <DialogDescription>
            The color and blur of Backdrop and the size and border of Popup can
            all be customized directly.
          </DialogDescription>
          <div className="mt-6">
            <DialogClose render={<Button className="w-full" />}>
              Keep exploring
            </DialogClose>
          </div>
        </DialogPopup>
      </DialogPortal>
    </DialogRoot>
  );
}
