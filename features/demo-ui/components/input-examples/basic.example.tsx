"use client";

import { useId } from "react";

import { Input } from "@/components/ui/input";

export const metadata = {
  title: "Basic usage",
  description: "Has every import and the structure it needs; copy it as is.",
  order: 10,
};

/** The label is tied to the input explicitly. */
export function Example() {
  const id = useId();
  return (
    <div className="w-full max-w-xs space-y-2">
      <label htmlFor={id} className="text-sm font-medium">
        Email
      </label>
      <Input id={id} type="email" placeholder="you@example.com" />
    </div>
  );
}
