# AUDK v1.5 · Reproducible build evidence

AUDK runs only reviewed and bounded first-party recipes in the private worker. After a job completes, the worker produces a separate `evidence.json` containing the function identity, source fingerprint, validation summary, publication policy, and SHA-256/length for each artifact. The job record pins the evidence file's SHA-256.

The operator-only command `node scripts/verify-build-evidence.mjs <absolute-job-root> <job-id>` re-reads stored artifacts, verifies both checksums and sizes, **regenerates the expected artifact bytes using the currently trusted source recipes**, and checks the complete evidence record against the reconstructed result. It never executes discovered snippets, publishes applets, opens network listeners, or grants approval.

This is *reproducibility evidence*, not a cryptographic signature, independent remote attestation, or an execution sandbox. A privileged attacker who replaces the code and evidence together could forge the record. Reverification depends on trusted, separately pinned source; GitHub reviews and source-lock checks remain necessary. Source versioning must be retained to verify historical builds after recipes change. The current verifier intentionally fails closed when a previously generated artifact no longer matches the installed recipe.

The next security steps remain separate: dedicated low-privilege Windows identity, write-restricted artifacts, stronger isolation for unknown code, authenticated gateway and quotas before accepting browser submissions, and an explicit promotion pull request before publication.
