# ADR-003: Frontend Browser Support and Accessibility Standards

## Status
Accepted

## Context
Requirements ZG-UI-BRW-001 and ZG-UI-A11Y-001 mandate specific targets for the frontend UI. The application must support the current and previous two major versions of Edge, Chrome, Firefox, and Safari. Unsupported browsers must fail gracefully. The UI must also target WCAG 2.2 Level AA.

## Decision
- We will enforce the browser support matrix using Babel/Browserslist with the query: `last 3 versions, not dead`.
- We will integrate an unsupported browser fallback script that detects non-compliant browsers and displays a static graceful degradation message instead of loading the React application.
- Accessibility (WCAG 2.2 Level AA) will be monitored statically during development using a11y linting plugins, and semantic HTML (e.g. `aria-` attributes, native focus management) will be used throughout.

## Consequences
- Developers must use semantic HTML and test with keyboard navigation.
- Some modern web APIs might require polyfills if they fall outside the 3-version window.
