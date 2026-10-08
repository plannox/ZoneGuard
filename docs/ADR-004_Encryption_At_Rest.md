# ADR-004: Encryption at Rest Strategy

## Status
Accepted

## Context
Requirement ZG-SEC-012 mandates encryption at rest for persistent stores containing PII, access records, security configuration, audit evidence, or incident evidence.

## Decision
- **Configuration Database (SQLite):** We will utilize SQLCipher (an open source extension to SQLite) to provide transparent 256-bit AES encryption of database files.
- **Telemetry Database (MongoDB):** We will utilize MongoDB's native Encryption at Rest capability for the WiredTiger storage engine (available in MongoDB Enterprise/Atlas) or file-system level encryption (e.g. LUKS) in the deployment environment.
- **Key Management:** Encryption keys will be provisioned by the deployment environment (e.g., via AWS KMS, HashiCorp Vault, or secure environment variables) and injected at runtime. Keys will never be committed to source control.

## Consequences
- Requires appropriate libraries (e.g., `pysqlcipher3`) to be installed in the production deployment.
- A deployment environment must handle secure key provisioning.
