'use client';

import { type ReactNode } from 'react';
import { type Control, Controller, type FieldPath, type FieldValues, type UseFormReturn } from 'react-hook-form';

import { useT } from '@/i18n';
import { isApiError } from '@/lib/api/errors';
import { cn } from '@/lib/utils/cn';

import { Checkbox, Switch } from './checkbox';
import { Input, type InputProps, NativeSelect, Textarea, type TextareaProps } from './input';
import { Label } from './label';
import { Select, type SelectOption } from './select';

/** Layout wrapper: label, control, hint and error message. */
export function Field({ label, htmlFor, required, hint, error, children, className }: { label?: ReactNode; htmlFor?: string; required?: boolean; hint?: ReactNode; error?: string | undefined; children: ReactNode; className?: string }) {
  return (
    <div className={cn('min-w-0', className)}>
      {label ? (
        <Label htmlFor={htmlFor} required={required}>
          {label}
        </Label>
      ) : null}
      {children}
      {error ? (
        <p className="mt-1 text-xs text-danger" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1 text-xs text-text-tertiary">{hint}</p>
      ) : null}
    </div>
  );
}

export function FormGrid({ children, className, cols = 2 }: { children: ReactNode; className?: string; cols?: 1 | 2 | 3 }) {
  const grid = cols === 1 ? 'grid-cols-1' : cols === 3 ? 'grid-cols-1 md:grid-cols-3' : 'grid-cols-1 md:grid-cols-2';
  return <div className={cn('grid gap-4', grid, className)}>{children}</div>;
}

export function FormSection({ title, description, children, className }: { title: ReactNode; description?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn('space-y-4', className)}>
      <header>
        <h3 className="text-sm font-bold text-text-primary">{title}</h3>
        {description ? <p className="mt-0.5 text-xs text-text-secondary">{description}</p> : null}
      </header>
      {children}
    </section>
  );
}

interface BaseFieldProps<TValues extends FieldValues> {
  control: Control<TValues>;
  name: FieldPath<TValues>;
  label?: ReactNode;
  required?: boolean;
  hint?: ReactNode;
  className?: string;
}

export function TextField<TValues extends FieldValues>({ control, name, label, required, hint, className, ...inputProps }: BaseFieldProps<TValues> & Omit<InputProps, 'name'>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field label={label} htmlFor={name} required={required} hint={hint} error={fieldState.error?.message} className={className}>
          <Input id={name} {...inputProps} {...field} value={field.value ?? ''} invalid={!!fieldState.error} />
        </Field>
      )}
    />
  );
}

/** Number input that stores a JS number (or null when empty) — never a string. */
export function NumberField<TValues extends FieldValues>({ control, name, label, required, hint, className, nullable = false, ...inputProps }: BaseFieldProps<TValues> & Omit<InputProps, 'name' | 'type'> & { nullable?: boolean }) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field label={label} htmlFor={name} required={required} hint={hint} error={fieldState.error?.message} className={className}>
          <Input
            id={name}
            type="number"
            inputMode="decimal"
            {...inputProps}
            name={field.name}
            ref={field.ref}
            onBlur={field.onBlur}
            value={field.value === null || field.value === undefined || Number.isNaN(field.value) ? '' : String(field.value)}
            onChange={(e) => {
              const raw = e.target.value;
              if (raw === '') field.onChange(nullable ? null : undefined);
              else field.onChange(Number(raw));
            }}
            invalid={!!fieldState.error}
            dir="ltr"
          />
        </Field>
      )}
    />
  );
}

export function TextareaField<TValues extends FieldValues>({ control, name, label, required, hint, className, ...props }: BaseFieldProps<TValues> & Omit<TextareaProps, 'name'>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field label={label} htmlFor={name} required={required} hint={hint} error={fieldState.error?.message} className={className}>
          <Textarea id={name} {...props} {...field} value={field.value ?? ''} invalid={!!fieldState.error} />
        </Field>
      )}
    />
  );
}

export function SelectField<TValues extends FieldValues>({ control, name, label, required, hint, className, options, placeholder, disabled, nullable = false }: BaseFieldProps<TValues> & { options: SelectOption[]; placeholder?: string; disabled?: boolean; nullable?: boolean }) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field label={label} htmlFor={name} required={required} hint={hint} error={fieldState.error?.message} className={className}>
          <Select id={name} value={field.value ?? ''} onValueChange={(v) => field.onChange(nullable && v === '__none__' ? null : v)} options={options} placeholder={placeholder} disabled={disabled} invalid={!!fieldState.error} />
        </Field>
      )}
    />
  );
}

export function NativeSelectField<TValues extends FieldValues>({ control, name, label, required, hint, className, options, placeholder, disabled, nullable = false }: BaseFieldProps<TValues> & { options: Array<{ value: string; label: string }>; placeholder?: string; disabled?: boolean; nullable?: boolean }) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field label={label} htmlFor={name} required={required} hint={hint} error={fieldState.error?.message} className={className}>
          <NativeSelect id={name} value={field.value ?? ''} onChange={(e) => field.onChange(nullable && e.target.value === '' ? null : e.target.value)} disabled={disabled} invalid={!!fieldState.error} ref={field.ref} onBlur={field.onBlur}>
            {placeholder !== undefined ? <option value="">{placeholder}</option> : null}
            {options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </NativeSelect>
        </Field>
      )}
    />
  );
}

export function CheckboxField<TValues extends FieldValues>({ control, name, label, hint, className, description }: BaseFieldProps<TValues> & { description?: ReactNode }) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field error={fieldState.error?.message} hint={hint} className={className}>
          <Checkbox id={name} checked={!!field.value} onCheckedChange={field.onChange} label={label} description={description} />
        </Field>
      )}
    />
  );
}

export function SwitchField<TValues extends FieldValues>({ control, name, label, hint, className, description }: BaseFieldProps<TValues> & { description?: ReactNode }) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field error={fieldState.error?.message} hint={hint} className={className}>
          <Switch id={name} checked={!!field.value} onCheckedChange={field.onChange} label={label} description={description} />
        </Field>
      )}
    />
  );
}

/** Multi-select rendered as a checkbox grid (enum arrays such as job types or platforms). */
export function CheckboxGroupField<TValues extends FieldValues>({ control, name, label, hint, className, options, required }: BaseFieldProps<TValues> & { options: Array<{ value: string; label: ReactNode }> }) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const selected: string[] = Array.isArray(field.value) ? (field.value as string[]) : [];
        return (
          <Field label={label} required={required} hint={hint} error={fieldState.error?.message} className={className}>
            <div className="flex flex-wrap gap-x-5 gap-y-2 rounded-md border border-border bg-surface-alt/50 p-3">
              {options.map((o) => (
                <Checkbox key={o.value} checked={selected.includes(o.value)} onCheckedChange={(checked) => field.onChange(checked ? [...selected, o.value] : selected.filter((v) => v !== o.value))} label={o.label} />
              ))}
            </div>
          </Field>
        );
      }}
    />
  );
}

/** Two inputs for `{ ar, en }` localised text. */
export function LocalizedTextField<TValues extends FieldValues>({ control, name, label, required, hint, className, multiline = false }: BaseFieldProps<TValues> & { multiline?: boolean }) {
  const t = useT();
  const arName = `${name}.ar` as FieldPath<TValues>;
  const enName = `${name}.en` as FieldPath<TValues>;
  return (
    <div className={cn('grid gap-3 md:grid-cols-2', className)}>
      {multiline ? (
        <>
          <TextareaField control={control} name={arName} label={`${label ?? ''} (${t('common.arabic')})`} required={required} dir="rtl" hint={hint} />
          <TextareaField control={control} name={enName} label={`${label ?? ''} (${t('common.english')})`} required={required} dir="ltr" />
        </>
      ) : (
        <>
          <TextField control={control} name={arName} label={`${label ?? ''} (${t('common.arabic')})`} required={required} dir="rtl" hint={hint} />
          <TextField control={control} name={enName} label={`${label ?? ''} (${t('common.english')})`} required={required} dir="ltr" />
        </>
      )}
    </div>
  );
}

/** Pushes API field errors (`details: [{field,message}]`) into the form so they render inline. */
export function applyApiFieldErrors<TValues extends FieldValues>(form: UseFormReturn<TValues>, error: unknown): boolean {
  if (!isApiError(error) || error.fieldErrors.length === 0) return false;
  for (const issue of error.fieldErrors) {
    form.setError(issue.field as FieldPath<TValues>, { type: 'server', message: issue.message });
  }
  return true;
}

export function FormError({ message }: { message: string | null | undefined }) {
  if (!message) return null;
  return (
    <div className="rounded-md border border-danger/40 bg-danger-soft px-3 py-2 text-xs text-danger-strong" role="alert">
      {message}
    </div>
  );
}
