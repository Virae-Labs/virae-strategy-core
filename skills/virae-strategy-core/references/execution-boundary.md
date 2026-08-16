# Execution boundary

The package is deterministic and side-effect free. It accepts explicit inputs and returns decisions, reason codes, plans, and order intents.

It does not:

- fetch current or historical market data;
- run a scheduler or persistent loop;
- read a Virae API key, wallet, or signing key;
- sign, submit, cancel, or reconcile orders;
- provide the hosted dashboard, alerts, or production controls.

Virae Auto Trade is the separate hosted execution product around the same versioned strategy logic for supported strategies. Use `virae-ai-skill` for hosted discovery and management. Preserve its confirmation requirements before enabling or otherwise increasing live-trading authority.

Never describe a locally generated intent as filled, submitted, or live. To compare a hosted result with local core output, first record the exact package version and manifest versions, then compare equivalent normalized inputs and configuration.
