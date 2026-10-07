# Nexterm Connector development

The Connector is a Tauri desktop shell around the Nexterm client. A working
development session needs the API server, client, schema watcher, and local
engine—not only the Vite client.

## Run in development

From the repository root, install the project dependencies once:

```sh
yarn install
yarn --cwd client install
yarn --cwd connector install
yarn schema:generate
```

Install the [Tauri system prerequisites](https://v2.tauri.app/start/prerequisites/)
for your operating system, then start the Connector with:

```sh
yarn --cwd connector dev
```

The Connector's Tauri hook starts the canonical root `yarn dev` command. That
brings up the API server, Vite client, schema watcher, and local engine with
matching registration tokens before opening the desktop window. Do not start a
second root `yarn dev` process at the same time.

The backend and local engine are ready when the logs contain `Local engine
configured`, `Engine connected`, and `Server accepted engine`. A backend
restart invalidates in-memory connection sessions, so refresh the Connector
and create a new connection after a restart.

## Build a local package

Tauri builds the client automatically through `beforeBuildCommand`:

```sh
yarn --cwd connector build
```

To build only an AppImage on Linux:

```sh
yarn --cwd connector build --bundles appimage
```

Platform packages are written below `connector/src-tauri/target/release/bundle`.
macOS packages must be built on macOS, and Windows packages must be built on
Windows.

## macOS release signing

Public macOS DMGs are signed and notarized in the `Build Connector` release
workflow. Configure these GitHub Actions repository secrets before creating a
release:

- `APPLE_CERTIFICATE`: base64-encoded Developer ID Application `.p12`
- `APPLE_CERTIFICATE_PASSWORD`: password used when exporting the `.p12`
- `APPLE_API_ISSUER`: App Store Connect API issuer ID
- `APPLE_API_KEY`: App Store Connect API key ID
- `APPLE_API_PRIVATE_KEY`: base64-encoded App Store Connect `.p8` private key

Create the API key with Developer access in App Store Connect. Encode its
downloaded private key without line wrapping before saving the secret:

```sh
openssl base64 -A -in AuthKey_<key-id>.p8
```

The workflow deliberately fails instead of uploading a macOS DMG when any
credential is missing. Before upload, it verifies the application resource
seal, the stapled notarization ticket, the disk image, and Gatekeeper
acceptance. See the [Tauri macOS signing guide](https://v2.tauri.app/distribute/sign/macos/)
for certificate and notarization setup.

After downloading a release DMG on macOS, the equivalent manual checks are:

```sh
xcrun stapler validate nexterm-connector-macos-arm64.dmg
spctl --assess --type install --verbose=4 nexterm-connector-macos-arm64.dmg
```
