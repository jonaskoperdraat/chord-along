## ADDED Requirements

### Requirement: Frontend project scaffold
The frontend SHALL be a Vite + Vue 3 + TypeScript project rooted at `frontend/` within the mono-repo. It SHALL be independently runnable (`npm run dev` from `frontend/`).

#### Scenario: Dev server starts
- **WHEN** the developer runs `npm run dev` inside `frontend/`
- **THEN** Vite starts a local dev server and the app is accessible in a browser

#### Scenario: TypeScript compilation succeeds
- **WHEN** the developer runs `npm run build` inside `frontend/`
- **THEN** Vite compiles the project to `frontend/dist/` with no TypeScript errors

### Requirement: Single-page player route
The app SHALL render the chord player on its root route (`/`). No multi-page routing is required in this slice.

#### Scenario: Root route renders player
- **WHEN** a user navigates to `/`
- **THEN** the player page is displayed with the chord display and YouTube embed

### Requirement: Code quality tooling
The scaffold SHALL include ESLint (with Vue and TypeScript rules) and Prettier. Lint MUST pass on the initial scaffold with no errors.

#### Scenario: Lint passes on scaffold
- **WHEN** the developer runs `npm run lint` inside `frontend/`
- **THEN** ESLint exits with code 0 and no errors are reported
