import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Tailwind-aware class merger (later classes win). */
export const cn = (...inputs: ClassValue[]): string => twMerge(clsx(inputs));
