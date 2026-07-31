import type { ReactNode } from "react";

export const FIELD_CLASS =
  "h-9 w-full border border-line bg-surface-raised px-2.5 text-sm text-ink outline-none transition-colors focus:border-brand";

const LABEL_CLASS = "text-xs text-ink-muted";
const ERROR_CLASS = "border-l-2 border-ink pl-2 text-xs font-medium text-ink";

interface FieldShellProps {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}

export function FieldShell({
  id,
  label,
  error,
  hint,
  children,
}: FieldShellProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className={LABEL_CLASS} htmlFor={id}>
        {label}
      </label>
      {children}
      {hint ? <p className="text-[11px] text-ink-subtle">{hint}</p> : null}
      {error ? <p className={ERROR_CLASS}>{error}</p> : null}
    </div>
  );
}

interface TextFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  hint?: string;
  placeholder?: string;
  isMono?: boolean;
}

export function TextField({
  id,
  label,
  value,
  onChange,
  error,
  hint,
  placeholder,
  isMono,
}: TextFieldProps) {
  return (
    <FieldShell id={id} label={label} error={error} hint={hint}>
      <input
        id={id}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className={`${FIELD_CLASS} ${isMono ? "font-mono text-xs" : ""}`}
      />
    </FieldShell>
  );
}

interface NumberFieldProps {
  id: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
  error?: string;
  hint?: string;
  min?: number;
}

export function NumberField({
  id,
  label,
  value,
  onChange,
  error,
  hint,
  min = 0,
}: NumberFieldProps) {
  return (
    <FieldShell id={id} label={label} error={error} hint={hint}>
      <input
        id={id}
        type="number"
        min={min}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className={FIELD_CLASS}
      />
    </FieldShell>
  );
}

export interface SelectOption<Value extends string> {
  value: Value;
  label: string;
}

interface SelectFieldProps<Value extends string> {
  id: string;
  label: string;
  value: Value;
  options: SelectOption<Value>[];
  onChange: (value: Value) => void;
  error?: string;
  hint?: string;
}

export function SelectField<Value extends string>({
  id,
  label,
  value,
  options,
  onChange,
  error,
  hint,
}: SelectFieldProps<Value>) {
  return (
    <FieldShell id={id} label={label} error={error} hint={hint}>
      <select
        id={id}
        value={value}
        onChange={(event) => {
          const next = options.find(
            (option) => option.value === event.target.value,
          );
          if (next) onChange(next.value);
        }}
        className={FIELD_CLASS}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}
