# Security policy

## Supported versions

Only the latest published version is actively maintained while the project is in `0.x`. Consumers should pin exact versions and review upgrades before deployment.

## Reporting a vulnerability

Please use GitHub's private security-advisory flow for this repository:

1. Open the repository's **Security** tab.
2. Choose **Report a vulnerability**.
3. Include affected versions, impact, reproduction steps, and a minimal fixture when safe.

Do not include private keys, wallet secrets, authentication tokens, signatures, personal data, or production credentials. Do not open a public issue for a vulnerability that could cause unintended orders, bypass risk controls, expose secrets, or compromise package publication.

## Scope

Relevant reports include:

- deterministic inputs producing unsafe or malformed order intents;
- risk-stop, duplicate, partial-fill, residual-position, or lifecycle bypasses;
- package export/install behavior that loads unexpected code;
- compromised dependency or release provenance;
- documentation that could cause a host to mis-handle a safety boundary.

This package intentionally contains no credentials, network client, signer, or exchange adapter. Vulnerabilities in a downstream host should be reported to that host's maintainers.

## Consumer guidance

- Install from the public npm registry using an exact version and committed lockfile integrity.
- Treat every output as untrusted until host-side venue, balance, authorization, and idempotency checks pass.
- Persist package/manifest identity with decisions and orders.
- Reconcile unknown submission outcomes; never assume a timeout means an order was not accepted.
- Maintain an independent global stop for new entries.
