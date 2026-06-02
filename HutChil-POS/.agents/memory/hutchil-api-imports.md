---
name: API client imports
description: Correct import paths for the generated API client library
---

## Rule
Always import from `@workspace/api-client-react` (the package root). Never use sub-paths.

## Correct
```ts
import { useGetMe, setAuthTokenGetter } from "@workspace/api-client-react";
import type { User } from "@workspace/api-client-react";
```

## Wrong (causes Vite "Missing specifier" error)
```ts
import { setAuthTokenGetter } from "@workspace/api-client-react/src/custom-fetch";
import { User } from "@workspace/api-client-react/src/generated/api.schemas";
```

## Why
The package.json `exports` only exposes `"."` → `./src/index.ts`. Sub-path imports bypass this and fail at Vite resolution.
