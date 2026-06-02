---
name: Sonner Toaster fix
description: next-themes breaks Sonner in apps without a ThemeProvider
---

## Rule
Remove `useTheme` from `next-themes` in `sonner.tsx` and hardcode `theme="dark"`.

## Why
The scaffold's `sonner.tsx` calls `useTheme()` from `next-themes`. Without a `<ThemeProvider>` wrapping the app, this causes "Invalid hook call" crash. Since HutChil is always dark, hardcoding avoids the dependency entirely.

## How to apply
Replace the entire `sonner.tsx` content: import `Toaster as Sonner` from `"sonner"` directly, pass `theme="dark"`, remove the `useTheme` import.
