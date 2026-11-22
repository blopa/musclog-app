# Live-state snapshots

Written by `scripts/infra.sh export`. These are what the services reported, sanitized
(secret-looking fields replaced by `<redacted>`, personal fields dropped). They are a record
and a drift reference, NOT the desired state: the desired state is `infra/revenuecat/config/`
and `infra/openrouter/*.tf`. An export never edits those. Review the diff before committing.
