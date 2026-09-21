# Diagnosis: `req.user` TS2339 errors in `auth.middleware.ts`

## What was failing

Running `npm run dev` produced:

```
src/middleware/auth.middleware.ts:39:9 - error TS2339: Property 'user' does not exist on type 'Request<...>'
src/middleware/auth.middleware.ts:51:14 - error TS2339: Property 'user' does not exist on type 'Request<...>'
src/middleware/auth.middleware.ts:56:29 - error TS2339: Property 'user' does not exist on type 'Request<...>'
```

## Root cause

The project already had a valid TypeScript declaration merge at <ref_file file="C:\\Life_Next_Phase\\jamo-ne-jamadu-portal\\server\\src\\types\\express.d.ts" />, which adds `user?: User` to the global `Express.Request` interface. That is the correct way to type `req.user`.

However, the `dev` command uses `ts-node` directly. By default, `ts-node` compiles only the entry file (`src/server.ts`) and the modules it `require`s at runtime. It does **not** automatically load `.d.ts` files listed under `tsconfig.json` `include` unless the `--files` flag (or `TS_NODE_FILES=true`) is provided.

Evidence:

- `npx tsc --noEmit` succeeded because the full project compilation respects `tsconfig.json`'s `include` and therefore loaded `src/types/express.d.ts`.
- `npx ts-node src/server.ts` failed.
- `npx ts-node --files src/server.ts` succeeded, because `--files` tells `ts-node` to load all `include`/`files` from `tsconfig.json`.

## Fix / refactor

Updated the `dev` script in <ref_file file="C:\\Life_Next_Phase\\jamo-ne-jamadu-portal\\server\\package.json" /> to pass `--files` to `ts-node`:

```json
"dev": "nodemon --watch src --ext ts --exec \"ts-node --files src/server.ts\""
```

This is the smallest, cleanest change that keeps the existing `express.d.ts` augmentation and makes `npm run dev` type-check the whole `src` tree the same way `tsc` does.

## Related files

- <ref_file file="C:\\Life_Next_Phase\\jamo-ne-jamadu-portal\\server\\src\\middleware\\auth.middleware.ts" />
- <ref_file file="C:\\Life_Next_Phase\\jamo-ne-jamadu-portal\\server\\src\\types\\express.d.ts" />
- <ref_file file="C:\\Life_Next_Phase\\jamo-ne-jamadu-portal\\server\\tsconfig.json" />
