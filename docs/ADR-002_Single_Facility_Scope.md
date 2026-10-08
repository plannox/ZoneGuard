# ADR-002: Single-Facility Deployment Scope

## Status
Accepted

## Context
Requirements ZG-SCOPE-001 and ZG-SCOPE-002 dictate that the baseline prototype is a single-organization, single-facility deployment, avoiding multi-tenant SaaS complexities for now. However, core models should be designed so that adding multi-facility support in the future is not unnecessarily difficult.

## Decision
We will not implement `tenant_id` or `facility_id` constraints in the current SQLite schema or MongoDB collections. The system implicitly operates within a single facility. 
To support future scalability, database access patterns are centralized in `backend/core/db.py`, allowing us to easily inject facility/tenant filters at the repository layer when authorized.

## Consequences
- Simplifies prototype development (no cross-tenant isolation bugs).
- Future multi-facility deployment will require a schema migration to add `facility_id` to zones, terminals, events, and incidents, as well as a comprehensive security review to ensure tenant isolation.
