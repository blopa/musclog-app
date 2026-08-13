# Apple Silicon iOS Simulator Compatibility

The iOS OCR and barcode dependencies currently include legacy OpenCV and Google ML Kit binary frameworks. Their arm64 slices are packaged as iOS device objects, and some pod settings exclude arm64 from simulator builds. Xcode 26 rejects those objects when linking an Apple Silicon simulator build.

Musclog applies a local compatibility fix during CocoaPods installation. It is intentionally limited to local Apple Silicon development and does not run in EAS or CI.

## Normal workflow

Run either simulator prebuild command from the repository root:

```bash
npm run prebuild-ios-simulator
# or
npm run prebuild:ios
```

Both commands run `expo prebuild -p ios --clean`. On macOS, Expo runs `pod install` as part of prebuild, and the Podfile hook applies the simulator fix during that single CocoaPods pass. Do not append another `cd ios && pod install`; that only runs the idempotent patch hook a second time.

For a physical-device prebuild, use:

```bash
npm run prebuild-ios-device
```

That command sets `MUSCLOG_IOS_SIMULATOR_BUILD_FIX=0` so device slices are left unchanged.

## What the hook changes

[`plugins/withIosSimulatorBuildFix.js`](plugins/withIosSimulatorBuildFix.js) adds a guarded `post_install` block to the generated Podfile. On a local arm64 Mac it:

1. Clears `EXCLUDED_ARCHS[sdk=iphonesimulator*]` from pod targets and generated xcconfigs.
2. Runs the OpenCV, MLImage, and installed ML Kit binary patchers.
3. Leaves EAS, CI, Intel hosts, and explicitly disabled runs unchanged.

The patchers live under `scripts/`:

- `fix_opencv_simulator.py`
- `fix_mlimage_simulator.py`
- `fix_mlkit_simulator.py`
- `ios_simulator_binary.py`, the shared Mach-O and AR archive implementation

The shared implementation extracts the arm64 slice with `lipo`, validates every Mach-O load command, rewrites iOS-only platform markers, verifies the in-memory result, and replaces the slice only if bytes changed. The ML Kit patcher discovers installed `MLKit*/Frameworks/*.framework` binaries instead of assuming every optional language recognizer is installed.

## Expected output

On a fresh unpatched pod installation, the relevant lines look like:

```text
[Musclog simulator fix] Applying local Apple Silicon iOS simulator patches
OpenCV: patched … device-only load commands across … arm64 Mach-O members.
MLImage: patched … device-only load commands across … arm64 Mach-O members.
MLKit: patched … device-only load commands across … installed frameworks.
```

If `pod install` is deliberately run again without reinstalling the pods, zero new patches are required. The scripts report that state explicitly:

```text
OpenCV: already simulator-compatible (… arm64 Mach-O members checked).
MLImage: already simulator-compatible (… arm64 Mach-O members checked).
MLKit: all … installed frameworks are already compatible.
```

This second result is normal and successful. A missing optional ML Kit language framework is not an error and is not logged individually.

## Manual rerun and troubleshooting

The normal prebuild command is sufficient. To rerun the hook against the existing Pods directory while debugging:

```bash
cd ios
pod install
```

Useful failure signatures:

| Symptom                                                                    | Meaning                                                                                                                 |
| -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `building for 'iOS-simulator', but linking in object file built for 'iOS'` | A device platform marker remains in a framework slice; inspect the patcher failure immediately above the linker error.  |
| `found architecture 'x86_64', required architecture 'arm64'`               | An `EXCLUDED_ARCHS[sdk=iphonesimulator*] = arm64` setting survived CocoaPods installation.                              |
| `[Musclog simulator fix] … failed`                                         | A patcher rejected a missing tool, malformed archive, or unexpected binary layout instead of silently claiming success. |
| `already simulator-compatible`                                             | The hook has already patched these exact Pods; no action is needed.                                                     |

Set `MUSCLOG_IOS_SIMULATOR_BUILD_FIX=0` to disable the complete local hook for one prebuild.

## When this can be removed

Remove the plugin, scripts, Podfile block, and this document together once both conditions are true:

- the OCR/barcode dependency tree ships proper arm64 iOS Simulator XCFramework slices; and
- its pod xcconfigs no longer exclude arm64 for `iphonesimulator`.

Revalidate both `npm run prebuild-ios-simulator` and `npm run prebuild-ios-device` before removing the workaround.
