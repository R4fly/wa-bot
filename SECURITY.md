# Security Policy

## Reporting a vulnerability

Report privately through GitHub Security Advisories on this repository.
Do not open public issues for security reports.

## Response targets

- Acknowledgement within 2 working days
- Severity assessment within 5 working days
- Patch release on all supported lines within 30 days for high and critical

## Supported versions

Only the latest minor of the current major line receives security fixes.
Pre-release channels (next, canary) are unsupported.

## Plugin incident procedure

If a publisher key leaks, run bot-wa plugin trust remove on every managed
installation, mark the key revoked in the trust store, and republish affected
plugins under a new key.