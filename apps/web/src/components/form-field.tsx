import { CircleAlert } from "lucide-react";
import type * as React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type FormFieldProps = Omit<React.ComponentProps<typeof Input>, "id" | "name"> & {
  name: string;
  label: string;
  helper?: string;
  error?: string | undefined;
};

// One labelled input (DESIGN.md Forms & Inputs): the label always shows above the input, a
// "Required" text marker rather than only an asterisk, helper text, and an error in Red 700 with
// an icon. The input points at both through aria-describedby, and aria-invalid marks an error.
export function FormField({ name, label, helper, error, required, ...inputProps }: FormFieldProps) {
  const id = `field-${name}`;
  const helperId = helper === undefined ? undefined : `${id}-helper`;
  const errorId = error === undefined ? undefined : `${id}-error`;
  const describedBy = [errorId, helperId].filter(Boolean).join(" ") || undefined;

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id} className="text-base">
        {label}
        {required ? (
          <span className="text-sm font-normal text-muted-foreground">Required</span>
        ) : null}
      </Label>
      <Input
        id={id}
        name={name}
        required={required}
        aria-invalid={error === undefined ? undefined : true}
        aria-describedby={describedBy}
        {...inputProps}
      />
      {helper === undefined ? null : (
        <p id={helperId} className="text-sm text-muted-foreground">
          {helper}
        </p>
      )}
      {error === undefined ? null : (
        <p id={errorId} className="flex items-start gap-2 text-sm text-destructive">
          <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}
