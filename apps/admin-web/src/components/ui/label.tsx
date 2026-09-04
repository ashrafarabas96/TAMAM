import { type LabelHTMLAttributes } from 'react';

import { cn } from '@/lib/utils/cn';

export function Label({
  className,
  required,
  children,
  ...props
}: LabelHTMLAttributes<HTMLLabelElement> & { required?: boolean }) {
  return (
    <label
      className={cn('mb-1.5 block text-xs font-semibold text-text-secondary', className)}
      {...props}
    >
      {children}
      {required ? (
        <span className="ms-0.5 text-danger" aria-hidden>
          *
        </span>
      ) : null}
    </label>
  );
}
