"use client";

import { useForm } from "@tanstack/react-form";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { FieldError, FieldLabel, FieldRoot } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useHydrated } from "@/hooks/use-hydrated";

export const metadata = {
  title: "Field errors from the server",
  description:
    "After a submit, setErrorMap records the server's per-field errors on their fields; each shows under its field and clears once the field changes.",
  order: 20,
};

const takenNames = ["Low-poly fox"];

/** Simulates a server write: a name already taken returns a field error. */
async function save(name: string) {
  await new Promise((resolve) => setTimeout(resolve, 600));
  return takenNames.includes(name.trim())
    ? { ok: false as const, message: "Another task already uses this name" }
    : { ok: true as const };
}

/**
 * The server's result decides the error, which the browser does not predict;
 * the button is disabled while submitting.
 */
export function Example() {
  // A server-rendered form submitted before hydration falls back to the
  // browser's native GET submit, which reloads the page, so it starts disabled.
  const hydrated = useHydrated();
  const [saved, setSaved] = useState<string | null>(null);
  const form = useForm({
    defaultValues: { name: "Low-poly fox" },
    onSubmit: async ({ value, formApi }) => {
      const result = await save(value.name);
      if (!result.ok) {
        setSaved(null);
        // Under onSubmit, TanStack Form clears it once the field changes.
        formApi.setErrorMap({
          onSubmit: { fields: { name: result.message } },
        });
        return;
      }
      setSaved(value.name);
    },
  });
  return (
    <form
      noValidate
      className="w-full max-w-xs space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <form.Field name="name">
        {(field) => (
          <FieldRoot
            name={field.name}
            disabled={!hydrated}
            invalid={!field.state.meta.isValid}
            dirty={field.state.meta.isDirty}
            touched={field.state.meta.isTouched}
          >
            <FieldLabel>Name</FieldLabel>
            <Input
              value={field.state.value}
              onValueChange={(value) => field.handleChange(value)}
              onBlur={field.handleBlur}
            />
            <FieldError match={!field.state.meta.isValid}>
              {field.state.meta.errors.join(", ")}
            </FieldError>
          </FieldRoot>
        )}
      </form.Field>
      <form.Subscribe selector={(state) => state.isSubmitting}>
        {(isSubmitting) => (
          <Button type="submit" disabled={!hydrated || isSubmitting}>
            {isSubmitting ? "Saving…" : "Save"}
          </Button>
        )}
      </form.Subscribe>
      {saved && (
        <p role="status" className="text-sm text-muted-foreground">
          Saved: {saved}
        </p>
      )}
    </form>
  );
}
