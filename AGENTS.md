# Tideland Release Protocol

Tideland releases are immutable snapshots. A version bump is not complete until:

1. `main` contains the release commit.
2. Tests and production build pass.
3. The matching immutable annotated tag exists remotely.
4. A GitHub Release exists for the tag and links to the playable snapshot.
5. The archived Pages URL is generated at `/versions/vX.Y.Z/`.
6. The latest Pages deployment is healthy at `/RUST---clon/`.

For every future release version update:

- update `package.json`, `src/config/version.ts`, in-game history, `CHANGELOG.md` and `README.md`;
- run `npm test` and `npm run build`;
- commit and push the release commit to `main`;
- create an annotated tag matching `GAME_VERSION` and push it normally;
- never move an existing tag and never use force push;
- verify the GitHub Release, latest Pages URL and archived Pages URL;
- include those URLs and the commit/tag SHAs in the final report.

The Pages workflow builds the current `main` release into the root site and builds every valid `vX.Y.Z` tag into its own archived path. Archived builds use a deployment-time localStorage namespace shim so their saves cannot collide with latest or with another archived release.

Do not commit generated `site/`, `dist/`, `node_modules/`, historical bundles, screenshots or QA artifacts.
