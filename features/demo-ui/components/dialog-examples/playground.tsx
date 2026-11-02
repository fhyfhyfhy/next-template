"use client";

import { IconArrowUpRight, IconX } from "@tabler/icons-react";
import { type SetStateAction, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  DialogBackdrop,
  DialogClose,
  DialogDescription,
  DialogPopup,
  type DialogPopupProps,
  DialogPortal,
  DialogRoot,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export interface DialogConfig {
  size: NonNullable<DialogPopupProps["size"]>;
  open: boolean;
  modal: "true" | "false" | "trap-focus";
  disablePointerDismissal: boolean;
  backdrop: "default" | "strong" | "clear";
  title: string;
  description: string;
  triggerLabel: string;
  closeLabel: string;
}

// The parentheses keep the end marker inside the expression; the UI demo page
// replaces only the initial JSON between the markers.
// prettier-ignore
export const initialConfig: DialogConfig = (/* @example-config */ {
  "size": "md",
  "open": false,
  "modal": "true",
  "disablePointerDismissal": false,
  "backdrop": "default",
  "title": "Make room for your next idea.",
  "description": "This dialog is built from independent parts. The content, the backdrop and the actions are all up to you.",
  "triggerLabel": "Open dialog",
  "closeLabel": "Got it"
} /* @end-example-config */);

/**
 * Popup and Backdrop are customized separately; the caller holds the open
 * state.
 */
export function DialogPlayground({
  config,
  onConfigChange,
}: {
  config?: DialogConfig;
  onConfigChange?: (config: SetStateAction<DialogConfig>) => void;
} = {}) {
  const [local, setLocal] = useState(initialConfig);
  const state = config ?? local;
  const change = onConfigChange ?? setLocal;
  const backdropClasses = {
    default: "",
    strong: "bg-black/65 backdrop-blur-sm",
    clear: "bg-transparent backdrop-blur-none",
  };
  return (
    <div className="flex justify-center">
      <DialogRoot
        open={state.open}
        onOpenChange={(open) => change((previous) => ({ ...previous, open }))}
        modal={
          state.modal === "trap-focus" ? "trap-focus" : state.modal === "true"
        }
        disablePointerDismissal={state.disablePointerDismissal}
      >
        <DialogTrigger render={<Button variant="secondary" />}>
          {state.triggerLabel}
          <IconArrowUpRight aria-hidden />
        </DialogTrigger>
        <DialogPortal>
          {state.modal !== "false" && (
            <DialogBackdrop className={backdropClasses[state.backdrop]} />
          )}
          <DialogPopup size={state.size}>
            <div className="flex items-start justify-between gap-4">
              <DialogTitle>{state.title}</DialogTitle>
              <DialogClose
                aria-label="Close dialog"
                render={
                  <Button
                    variant="ghost"
                    size="sm"
                    className="-mt-1 -mr-2 px-2"
                  />
                }
              >
                <IconX aria-hidden />
              </DialogClose>
            </div>
            <DialogDescription>{state.description}</DialogDescription>
            <div className="mt-8 flex justify-end">
              <DialogClose render={<Button />}>{state.closeLabel}</DialogClose>
            </div>
          </DialogPopup>
        </DialogPortal>
      </DialogRoot>
    </div>
  );
}
