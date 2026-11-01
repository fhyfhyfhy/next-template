"use client";

import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toaster";

export interface ToasterConfig {
  type: "default" | "success" | "info" | "warning" | "error";
  title: string;
  description: string;
  closeButton: boolean;
}

// The parentheses keep the end marker inside the expression; the UI demo page
// replaces only the initial JSON between the markers.
// prettier-ignore
export const initialConfig: ToasterConfig = (/* @example-config */ {
  "type": "success",
  "title": "Draft saved",
  "description": "Your latest changes are synced to the cloud.",
  "closeButton": false
} /* @end-example-config */);

const showByType = {
  default: toast,
  success: toast.success,
  info: toast.info,
  warning: toast.warning,
  error: toast.error,
};

/** The root layout already renders Toaster, so this only calls toast(). */
export function ToasterPlayground({
  config = initialConfig,
}: {
  config?: ToasterConfig;
} = {}) {
  return (
    <Button
      variant="outline"
      onClick={() =>
        showByType[config.type](config.title, {
          description: config.description || undefined,
          closeButton: config.closeButton,
        })
      }
    >
      Show toast
    </Button>
  );
}
