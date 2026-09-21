# Module 1: Auth & RBAC

## Overview

This module implements the authentication and role-based access control foundation for the BAPS Anand Jamo Ne Jamadu Seva Portal. It covers the Node/Express backend, the React frontend, and the associated logging and documentation.

## Backend

### Logging

- `server/src/utils/logger.ts`
  - Winston logger with JSON formatting.
  - Writes to `logs/combined.log` and `logs/error.log`.
  - Console transport in non-production environments.
- `server/src/utils/morgan.ts`
  - Morgan stream that pipes access logs to Winston.
- `server/src/utils/audit.ts`
  - `logAuditEvent(userId, action, details)` persists entries to the `AuditLog` table.

### Middleware

- `server/src/middleware/auth.middleware.ts`
  - `authenticateToken` validates the Bearer JWT.
  - `requireRoles(roles)` enforces role-based access and returns `403` when the user role is not allowed.

### Controllers

- `server/src/controllers/auth.controller.ts`
  - `login` – email/password authentication, returns a JWT with a 12-hour expiry and a safe user object.
  - `createUser` – SUPER_ADMIN-only endpoint to create users with `SUPER_ADMIN` or `VOLUNTEER` roles.
  - `getMe` – returns the current authenticated user.
  - `listUsers` – SUPER_ADMIN-only list of all users (password hash excluded).

### Routes

- `server/src/routes/auth.routes.ts`
  - `/api/v1/auth/login`
  - `/api/v1/auth/me`
  - `/api/v1/auth/users`

### Express application

- `server/src/app.ts`
  - Loads environment variables.
  - Configures CORS, JSON parsing, and the Morgan/Winston access logger.
  - Mounts the auth routes and a 404/500 handler.
- `server/src/server.ts`
  - Starts the application on `PORT` (default 5000).

## Frontend

- `client/src/api/axios.ts`
  - Axios instance with `VITE_API_URL` base URL.
  - Request interceptor attaches the Bearer token from `localStorage`.
  - Response interceptor clears the token and redirects to `/login` on `401`.
- `client/src/context/AuthContext.tsx`
  - Manages user state, login/logout, and token hydration.
- `client/src/components/ProtectedRoute.tsx`
  - Guards routes and supports optional `allowedRoles`.
- `client/src/pages/Login.tsx`
  - Mobile-first login card with error handling.
- `client/src/pages/AdminUsers.tsx`
  - SUPER_ADMIN user management screen with a create-user modal.

## Documentation

- `docs/openapi.yaml` documents all `/auth` endpoints, request bodies, and error responses.
- This file records the module specification and conventions.

## Environment requirements

The server expects the following environment variables:

- `DATABASE_URL` and `DIRECT_URL` for Prisma.
- `JWT_SECRET` for signing tokens.
- `PORT` (optional, default 5000).
- `NODE_ENV` (optional).
