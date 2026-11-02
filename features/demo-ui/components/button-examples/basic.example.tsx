"use client";

import { Button } from "@/components/ui/button";

export const metadata = {
  title: "Basic usage",
  description: "Has every import and the structure it needs; copy it as is.",
  order: 10,
};

/** The smallest button usage. */
export function Example() {
  return (
    <Button onClick={() => window.alert("Started creating")}>
      Start creating
    </Button>
  );
}
