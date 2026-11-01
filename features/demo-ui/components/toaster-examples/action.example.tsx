"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toaster";

export const metadata = {
  title: "Undo",
  description:
    "The toast carries an action button, so the user can undo what they just did before it goes away.",
  order: 20,
};

/** Archiving takes effect at once; Undo restores the state from before it. */
export function Example() {
  const [archived, setArchived] = useState(false);
  return (
    <div className="space-y-3 text-center">
      <Button
        variant="outline"
        disabled={archived}
        onClick={() => {
          setArchived(true);
          toast("Project archived", {
            action: { label: "Undo", onClick: () => setArchived(false) },
          });
        }}
      >
        Archive project
      </Button>
      <p aria-live="polite" className="text-xs text-muted-foreground">
        {archived
          ? "The project is in the archived list"
          : "The project is in the active list"}
      </p>
    </div>
  );
}
