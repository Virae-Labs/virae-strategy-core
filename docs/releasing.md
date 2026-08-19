# Release process

Published npm versions are immutable. Releases should be reproducible from a reviewed Git commit and annotated Git tag.

## Before release

1. Confirm the working tree contains only intended changes.
2. Decide whether model, input-schema, or execution-policy manifest versions must change.
3. Update `CHANGELOG.md`, `package.json`, and examples that show an exact install version.
4. Run:

   ```bash
   npm ci
   npm run check
   npm run test:coverage
   npm pack --dry-run
   ```

5. Inspect the packed file list. It must include built declarations, maps, documentation, examples, license, and changelog; it must not include source tests, credentials, `.env`, or local artifacts.
6. Review dependency and token provenance. The package currently has no runtime dependencies.

## Publish

Use a granular npm token or npm trusted publishing with the narrowest available scope. Never commit `.npmrc` credentials or put tokens in command output.

Create and push an annotated tag matching the package version. Pushing the tag triggers `.github/workflows/publish.yml`, which validates the package and publishes it to npm:

```bash
git tag -a vX.Y.Z -m "vX.Y.Z"
git push origin main
git push origin vX.Y.Z
```

The tag must match the version in `package.json` exactly (for example, tag `v0.7.0` publishes package version `0.7.0`). The workflow uses the `NPM_TOKEN` secret from the GitHub Environment named `NPM_TOKEN`.

The workflow can also be started manually from **Actions > Publish to npm > Run workflow**. Select the commit or branch to publish and enter its exact `package.json` version in the `version` field. The same validation and publishing steps apply.

## Post-publish verification

Verify from a clean temporary consumer—not from a workspace link:

```bash
npm view @viraeai/virae-strategy-core@X.Y.Z name version dist.integrity
npm install --save-exact @viraeai/virae-strategy-core@X.Y.Z
```

Load root, `/crypto-tail`, `/pre-market`, `/musk-tweet-count`, `/weather-temperature`, and `/ev-snipe` entry points; execute installed-package Musk, Weather, and EV Snipe matrix fixtures through the bundled Skill; and compile a downstream TypeScript file. Confirm the registry integrity matches the committed lockfile used by the first production consumer.

Do not publish another version merely to work around registry propagation until npm confirms whether the first publish exists. A tarball, dist-tag, metadata document, and anonymous clean install should agree.

## Rollback

npm versions cannot be overwritten. Prefer publishing a corrected version and pinning consumers explicitly. Production rollback should restore the prior host artifact and exact prior package version. Deprecate a bad version with a clear message when appropriate; avoid unpublishing unless the npm policy and incident severity require it.
