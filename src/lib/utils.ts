/**
 * @fileoverview Utility helpers for Shadcn-Vue components.
 *
 * Combines `clsx` (conditional class strings) with `tailwind-merge`
 * (intelligent Tailwind class conflict resolution) into a single `cn()`
 * function used throughout all UI components.
 *
 * @example
 * ```ts
 * import { cn } from '@/lib/utils'
 * cn('px-4 py-2', 'px-6') // → 'py-2 px-6' (px-4 is overridden)
 * ```
 */
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Merge class values with intelligent Tailwind conflict resolution.
 *
 * Later classes override earlier ones when they target the same CSS property.
 * Conditionals can be passed as objects/arrays — all handled by `clsx`.
 *
 * @param inputs - Any number of class values (strings, arrays, objects).
 * @returns A single merged className string.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
