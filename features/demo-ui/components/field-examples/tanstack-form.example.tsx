"use client";

import { revalidateLogic, useForm } from "@tanstack/react-form";
import { useState } from "react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { FieldError, FieldLabel, FieldRoot } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useHydrated } from "@/hooks/use-hydrated";

export const metadata = {
  title: "With TanStack Form",
  description:
    "TanStack Form owns the values and validation, and Field shows the state and errors; it validates on submit, then again on every change.",
  order: 10,
};

const schema = z.object({
  name: z.string().trim().min(1, "Enter a name"),
  email: z.email("Enter a valid email address"),
});

const fields = [
  { name: "name", label: "Name", placeholder: "e.g. Low-poly deer" },
  { name: "email", label: "Email", placeholder: "you@example.com" },
] as const;

/** The field state goes from TanStack's field.state.meta to FieldRoot. */
export function Example() {
  // A server-rendered form submitted before hydration falls back to the
  // browser's native GET submit, which reloads the page, so it starts disabled.
  const hydrated = useHydrated();
  const [submitted, setSubmitted] = useState<string | null>(null);
  const form = useForm({
    defaultValues: { name: "", email: "" },
    validationLogic: revalidateLogic(),
    validators: { onDynamic: schema },
    onSubmit: ({ value }) => setSubmitted(value.name),
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
      {fields.map(({ name, label, placeholder }) => (
        <form.Field key={name} name={name}>
          {(field) => (
            <FieldRoot
              name={field.name}
              disabled={!hydrated}
              invalid={!field.state.meta.isValid}
              dirty={field.state.meta.isDirty}
              touched={field.state.meta.isTouched}
            >
              <FieldLabel>{label}</FieldLabel>
              <Input
                value={field.state.value}
                placeholder={placeholder}
                onValueChange={(value) => field.handleChange(value)}
                onBlur={field.handleBlur}
              />
              <FieldError match={!field.state.meta.isValid}>
                {field.state.meta.errors[0]?.message}
              </FieldError>
            </FieldRoot>
          )}
        </form.Field>
      ))}
      <Button type="submit" disabled={!hydrated}>
        Submit
      </Button>
      {submitted && (
        <p role="status" className="text-sm text-muted-foreground">
          Submitted: {submitted}
        </p>
      )}
    </form>
  );
}
