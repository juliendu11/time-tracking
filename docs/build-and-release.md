# Building, packaging, shipping & auto-update

Status: **partially implemented**. Building/packaging works today (verified
locally — see §2), and CI now builds all three platforms and can publish
releases (see §5). Code signing, notarization, and auto-update are **not set
up yet**; this doc is both a reference for what already exists and a
checklist for what's left to do before shipping to real users.

## 1. Current state of the repo

- `electron.vite.config.ts` — builds `out/main`, `out/preload` (forced to
  `.cjs`, required because sandboxed preload scripts can't be ESM — see
  the commit history / commit message for why), `out/renderer`.
- `electron-builder.yml` — packaging config. Targets configured:
  Linux → AppImage + deb, Windows → NSIS, macOS → dmg.
- Icons: `build/icon.png` (1024×1024) and `build/icon.ico` (multi-res) are
  committed. There is **no `build/icon.icns`** — electron-builder generates
  it automatically from the PNG when packaging for macOS, but only when run
  *on* macOS (see §2.3).
- `resources/icon.png`, `resources/tray-icon.png`,
  `resources/tray-icon@2x.png` — runtime icons (window icon, tray icon),
  copied into the packaged app via `extraResources` and resolved at runtime
  by `src/main/resourcePaths.ts` (`app.isPackaged ? process.resourcesPath :
  …` — dev vs. packaged path resolution).
- `better-sqlite3` is the only native dependency. It ships prebuilt N-API
  binaries (no compiler toolchain needed on the build machine) and
  `asarUnpack: ['**/*.node']` ensures the compiled binary isn't trapped
  inside the read-only `app.asar` archive at runtime.
- CI: four workflows exist under `.github/workflows/` —
  `build-linux.yml`, `build-windows.yml`, `build-macos.yml` (typecheck +
  lint + test + package on every push/PR to `main`, artifacts only, never
  publish) and `release.yml` (triggered by pushing a `vX.Y.Z` tag or
  manually; builds all three platforms and publishes to a GitHub Release —
  see §5 for what it does and does not handle).
- `electron-builder.yml` has a `publish: { provider: github }` block and
  `package.json` has a `repository` field with a **placeholder owner
  (`CHANGE_ME`)** — must be updated to the real GitHub owner/repo before
  `release.yml` can publish anywhere (see §5.1).
- No update mechanism wired up yet (no `electron-updater` dependency, no
  `autoUpdater` code in `src/main`) — the `publish` config above is
  currently only used by the release workflow to upload installers to
  GitHub Releases; the app itself doesn't check for updates. See §4.

## 2. Building per platform

### 2.1 Linux (verified working on this machine)

```bash
pnpm run package:linux
```

- **AppImage**: builds cleanly, no extra host dependencies beyond what
  electron-builder downloads itself (`appimagetool`, a bundled 7-Zip).
  Confirmed working end-to-end on this Fedora host — produced a working
  148MB `release/TimeTracker-<version>.AppImage`.
- **deb**: uses a bundled tool called `fpm` (Ruby). **On this host it fails**
  with `ruby: error while loading shared libraries: libcrypt.so.1: cannot
  open shared object file`. Recent Fedora (and other distros that migrated
  to `libxcrypt` without the legacy `.so.1` compat symlink) don't ship
  `libcrypt.so.1` anymore. Fix: install the compat package before building
  a `.deb`:
  ```bash
  sudo dnf install libxcrypt-compat   # Fedora/RHEL
  ```
  On Debian/Ubuntu-based hosts this generally isn't an issue since they
  still ship `libcrypt.so.1`. If `.deb` still isn't needed, AppImage alone
  covers most Linux users (it's distro-agnostic).
- `rpm` target (not currently configured) would need the `rpm` CLI tool on
  the build host — add `rpm` to `linux.target` in `electron-builder.yml` if
  Fedora/openSUSE users are a priority; not done here to keep the initial
  matrix small.
- Runtime deps declared in `deb.depends` (`libgtk-3-0`, `libnotify4`,
  `libnss3`, `libxss1`, `libxtst6`) are standard Electron/Chromium
  runtime libraries — keep this list in sync if electron-builder's own
  default list changes in a future major version bump.

### 2.2 Windows

```bash
pnpm run package:win
```

- Can be **cross-built from Linux or macOS**, but only reliably with
  **Wine installed** on the build host — electron-builder uses `rcedit`
  (a Windows PE tool) to stamp the icon and version info onto the `.exe`,
  and NSIS installer generation also relies on Wine when not run natively
  on Windows. Without Wine, the build may fail or silently skip icon/version
  embedding, depending on the electron-builder version.
  ```bash
  # Fedora
  sudo dnf install wine
  # Debian/Ubuntu
  sudo apt install wine
  ```
- Building **natively on Windows** (or a `windows-latest` GitHub Actions
  runner) avoids the Wine dependency entirely and is the recommended path
  for anything beyond local testing.
- Not yet attempted on this machine (Linux host) — do this before the first
  real Windows release, since it's the one target most likely to have a
  build-environment surprise that hasn't been shaken out yet.

### 2.3 macOS

```bash
pnpm run package:mac
```

- **Must be built on an actual Mac** (or a macOS CI runner). Apple's signing
  and notarization tools (`codesign`, `xcrun notarytool`, `hdiutil` for the
  `.dmg`) don't exist on Linux/Windows and there is no reliable
  cross-compilation path for a *signed, notarizable* build — this is a hard
  platform requirement, not a convenience recommendation.
- Without a Mac, the furthest you can get from this Linux machine is an
  **unsigned** build, and unsigned/unnotarized apps are blocked by
  Gatekeeper on any Mac running a reasonably recent macOS version (the user
  would have to right-click → Open and click through a scary warning, or
  run `xattr -cr TimeTracker.app` manually) — not acceptable for a real
  release, fine for the developer's own testing only.
- `build/icon.icns` is auto-generated from `build/icon.png` by
  electron-builder **when running on macOS**; it cannot generate a proper
  `.icns` from a non-Mac host reliably, so don't expect a mac build kicked
  off from Linux to produce a good result even if it doesn't outright fail.

## 3. Code signing & notarization

Required for a real (non-developer-only) release on Windows and macOS.
Linux has no equivalent gatekeeping mechanism — AppImage/deb ship unsigned
without any OS-level warning to the user.

### 3.1 Windows — Authenticode signing

- Unsigned `.exe` installers trigger a Windows SmartScreen warning
  ("Windows protected your PC") on first run. It doesn't block install, but
  it looks alarming and hurts trust.
- Needs a code signing certificate. As of the 2023 CA/Browser Forum
  baseline requirements, standard OV certificates must be stored on a
  hardware token or HSM — you can no longer just get a `.pfx` file and sign
  locally the old way for new certs. Two realistic paths:
  1. **Traditional OV/EV cert on a hardware token**, signed locally or via
     a signing service that wraps the token.
  2. **Cloud signing service** (e.g. Azure Trusted Signing, SignPath,
     DigiCert KeyLocker) — electron-builder supports these via its
     `win.signtoolOptions` / custom sign hooks. This is the more common
     modern setup for small teams/solo devs since it avoids hardware token
     logistics.
- electron-builder reads signing config from environment variables by
  default (`CSC_LINK`, `CSC_KEY_PASSWORD` for a traditional cert file/URL;
  a cloud signing tool needs its own env vars per provider). **Do not commit
  a certificate or its password to the repo** — inject via CI secrets only.
- EV certificates get instant SmartScreen reputation; OV certificates build
  reputation gradually based on download/install volume. For a
  low-download-volume personal/niche app, expect SmartScreen warnings to
  persist for a while even when properly signed with an OV cert — this is
  expected, not a sign of misconfiguration.

### 3.2 macOS — Developer ID signing + notarization

- Requires an **Apple Developer Program** membership (\$99/year).
- Requires a **Developer ID Application** certificate (for direct
  distribution outside the Mac App Store, which is what a `.dmg` release
  is).
- `hardenedRuntime: true` is already set in `electron-builder.yml` — required
  for notarization to succeed.
- **Notarization** is mandatory since macOS Catalina: after signing, the
  build must be uploaded to Apple (`xcrun notarytool`) and stapled. Without
  it, Gatekeeper blocks the app on first launch with no easy override for a
  typical user.
- electron-builder automates this via `@electron/notarize` when the right
  environment variables are present:
  - `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD` (an app-specific password
    generated at appleid.apple.com, not the account password), `APPLE_TEAM_ID`
  - or the newer API-key based auth: `APPLE_API_KEY`, `APPLE_API_KEY_ID`,
    `APPLE_API_ISSUER`
- No custom entitlements file exists yet (`build/entitlements.mac.plist`).
  Plain Electron apps that don't touch camera/mic/keychain/JIT-sensitive
  APIs generally notarize fine with electron-builder's built-in default
  entitlements — only add a custom entitlements file if a future feature
  needs a specific capability (e.g. the future [app activity
  tracking](./features/app-activity-tracking.md) feature's macOS
  Accessibility permission does **not** need a hardened-runtime entitlement,
  it's a separate TCC permission prompt at runtime).

### 3.3 What to add to `electron-builder.yml` once certs exist

```yaml
win:
  target: [nsis]
  # signing config is picked up from CSC_LINK / CSC_KEY_PASSWORD env vars,
  # or from a custom sign hook for cloud signing providers — no YAML change
  # needed for the traditional path.

mac:
  target: [dmg, zip]   # zip is required for electron-updater, see §4
  hardenedRuntime: true
  notarize: true       # electron-builder ≥24 reads APPLE_* env vars automatically
```

## 4. Auto-update system

Not implemented. `package.json` has no `electron-updater` dependency and
`src/main` has no `autoUpdater` wiring. This section is what to do when it's
time to add it — matches the original design constraint (see
`src/main/index.ts` and the project's own principle of staying local-first):
**auto-update must be opt-in and must never be required for the app to
work.** A user who never has internet access, or who explicitly disables it
in Settings, should get a fully functional app forever on whatever version
they installed.

### 4.1 Dependency & basic wiring

```bash
pnpm add electron-updater
```

```ts
// src/main/updater.ts (new file)
import { autoUpdater } from 'electron-updater'
import { logger } from './logger'

export function initAutoUpdater(enabled: boolean): void {
  if (!enabled) return
  autoUpdater.logger = { info: logger.info.bind(logger), warn: logger.warn.bind(logger), error: logger.error.bind(logger), debug: logger.debug.bind(logger) }
  autoUpdater.autoDownload = false // ask before downloading — respects user control
  autoUpdater.checkForUpdatesAndNotify()
}
```

Call `initAutoUpdater(settings.get().autoUpdateEnabled)` from
`src/main/index.ts`'s bootstrap, gated by a **new Settings field**
(`autoUpdateEnabled: boolean`, default `false` to match the "opt-in, not
required" principle above — or default `true` with a clear first-run
disclosure; product decision, not a technical one).

### 4.2 Publish config (where updates come from)

electron-updater needs a **feed**: a hosted `latest.yml` (Windows),
`latest-mac.yml` (macOS), `latest-linux.yml` (Linux) file plus the actual
installer artifacts, all produced automatically by `electron-builder
--publish` when a `publish` block exists in `electron-builder.yml`:

```yaml
publish:
  provider: github
  owner: <github-username-or-org>
  repo: time-tracking
  releaseType: release
```

GitHub Releases is the simplest zero-infrastructure option — completely
consistent with the "no backend, no server you run yourself" philosophy of
this app, since GitHub is just a static file host from the update client's
point of view. Alternatives (S3 bucket, generic static HTTP server) work
too via `provider: generic` if avoiding GitHub is a goal.

### 4.3 Platform-specific update support & gaps

- **Windows (NSIS)**: full support, including differential (delta) updates
  out of the box.
- **macOS**: electron-updater requires a **`.zip`** artifact alongside the
  `.dmg` (`mac.target: [dmg, zip]`) — the `.dmg` itself is not used as the
  update payload, only for the first manual install. Must be signed +
  notarized like the `.dmg` (see §3.2).
- **Linux**: electron-updater auto-update **only supports the AppImage
  target**. `.deb` installs have no auto-update path through
  electron-updater — Debian/Ubuntu users on the `.deb` package update
  manually (or via a future custom apt repo, out of scope for now). This is
  a real, permanent gap to be upfront about with users, not a bug to fix
  later — document it in-app (e.g. a note in Settings → Advanced next to the
  update toggle: "Auto-update works for the AppImage build; .deb users
  should redownload new versions manually").

### 4.4 Required `publish: never` safety net

Without `--publish` on the CLI (or with `publish: never` in the config for
plain `pnpm run package:*` local builds), electron-builder **will not**
attempt to upload anything anywhere. Keep local/dev packaging
(`pnpm run package*`) publish-free by default; only the CI release job (see
§5) should pass `--publish always`. This avoids ever accidentally pushing a
local, unsigned test build to the public update feed.

## 5. CI/CD

Four GitHub Actions workflows exist under `.github/workflows/`, all using a
GitHub-hosted matrix primarily because **macOS builds require a real Mac** —
a hosted `macos-latest` runner is the only realistic way to produce Mac
builds without owning Apple hardware.

### 5.1 The four workflows

- **`build-linux.yml`**, **`build-windows.yml`**, **`build-macos.yml`** —
  run on every push/PR to `main` (plus manual `workflow_dispatch`).
  Typecheck, lint, test, then `pnpm run package:<platform>` with **no
  `--publish`** — artifacts are attached to the Actions run only (14-day
  retention), nothing is ever uploaded to a release. These exist purely to
  catch a platform-specific build breakage before it reaches a tag.
- **`release.yml`** — triggered by pushing a `vX.Y.Z` tag (or manual
  dispatch). A `verify` job runs typecheck/lint/test once (Ubuntu, since
  those checks are OS-agnostic); a `release` job then matrix-builds all
  three platforms and runs
  `electron-builder --publish always`, which uploads installers straight to
  a GitHub Release matching the tag, using the automatically-provided
  `GITHUB_TOKEN` (scoped to `contents: write` via the workflow's
  `permissions:` block — no extra secret needed just for the GitHub upload
  itself).

**Before the first real run of `release.yml`**, update the placeholder in
`package.json`'s `repository.url` from `github.com/CHANGE_ME/time-tracking`
to the actual GitHub owner/repo — electron-builder's `publish.provider:
github` block in `electron-builder.yml` infers owner/repo from that field,
and will fail to publish (though it will still build) until it's a real
value.

**What these workflows do *not* yet do:** sign Windows binaries, or sign +
notarize macOS binaries (see §3) — so `release.yml` currently publishes
**unsigned** installers for Windows/macOS. That's fine for early testing;
before pointing real users at a release, come back here and add the secrets
below, matching whichever signing approach was chosen in §3.1/§3.2.

### 5.2 Secrets checklist for signed releases (not yet added)

- [x] `GITHUB_TOKEN` — nothing to do, provided automatically by Actions.
- [ ] Windows signing credentials (cert file + password, or cloud signing
      service credentials — depends on the §3.1 choice) — add as
      `CSC_LINK`/`CSC_KEY_PASSWORD` (or provider-specific env vars) in
      `release.yml`'s Windows matrix leg once decided.
- [ ] `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID` (or the
      API-key trio) + the Developer ID cert (`CSC_LINK`/`CSC_KEY_PASSWORD`
      scoped to the macOS matrix leg), plus `notarize: true` under `mac:` in
      `electron-builder.yml` (see §3.3).

`linux` needs `libxcrypt-compat`-equivalent handling only for *local*
Fedora-style builds (see §2.1) — `ubuntu-latest` runners don't have this
problem, confirmed by the `build-linux.yml`/`release.yml` Linux legs using
that image.

## 6. Release checklist

CI (`release.yml`) exists and works today for unsigned builds. Signing (§3)
and auto-update (§4) are still open — steps 5b/6 below only apply once
those are done.

1. Bump `version` in `package.json` (semver).
2. Update a changelog (none exists yet — add `CHANGELOG.md` when this
   matters, i.e. once there are outside users).
3. `pnpm run typecheck && pnpm run lint && pnpm run test && pnpm run build`
   locally as a final sanity check.
4. `git tag vX.Y.Z && git push --tags` — triggers `release.yml` (tag must
   match the version bumped in step 1, e.g. version `0.2.0` → tag `v0.2.0`).
5. Verify the CI run produced, per platform, the installer/AppImage/deb/dmg
   attached to the GitHub Release.
   - 5b. Once §4 (auto-update) is wired: also verify `latest*.yml` update
     feed files are attached.
6. Once §4 is wired: manually install the previous version and confirm
   `electron-updater` picks up the new one, before telling real users about
   the release — the update path is the one thing that's very hard to test
   after the fact if it's broken.

## 7. Open questions for whoever picks this up

1. Windows signing: hardware-token OV cert vs. a cloud signing service
   (Azure Trusted Signing is the closest thing to a "just works" option for
   a solo dev as of writing) — needs a decision before §3.1 can be finished.
2. Auto-update default: opt-in (safer, matches "local-first, nothing
   happens without consent") vs. opt-out with a clear first-run notice
   (more users stay current). Current recommendation in §4.1 is opt-in by
   default.
3. Is a `.deb` release worth keeping given the auto-update gap in §4.3, or
   should Linux distribution consolidate on AppImage-only to keep exactly
   one Linux update path? Revisit once real usage data (if any) exists.
