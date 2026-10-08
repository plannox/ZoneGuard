# ADR-001: Adapter Authentication Mechanism

## Status
Accepted

## Context
Machine-to-machine ingestion adapters (ZG-SEC-013) must authenticate with Zone Guard using a standardized scheme. We had to choose between mTLS and OAuth 2.0 client credentials.

## Decision
We select **OAuth 2.0 Client Credentials flow**.

## Rationale
OAuth 2.0 Client Credentials is broadly supported by HTTP client libraries and API gateways, making it easier to integrate vendor-agnostic adapters than distributing and rotating mutual TLS (mTLS) client certificates. The token lifecycle allows us to quickly revoke a compromised adapter.

## Consequences
- The backend must provide a token issuance endpoint (`/oauth/token`).
- Ingestion adapters must maintain and securely store a Client ID and Client Secret.
- TLS (HTTPS) is absolutely required to protect the token in transit (enforced by ZG-SEC-011).
