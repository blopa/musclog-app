# iOS Simulator Build Fix — Xcode 26 / OpenCV 4.3.0

> **Context**: macOS 26 (Darwin 25.4.0), Xcode 26, Expo SDK 54, React Native, CocoaPods.  
> **Goal**: Run the app in an iOS simulator on a MacBook (no physical iPhone).  
> **Date fixed**: April 2026

---

## Table of Contents

1. [Overview of Issues](#1-overview-of-issues)
2. [Issue 1 — Linker cannot find `Pods-MusclogLiftLogRepeat`](#2-issue-1--linker-cannot-find-pods-musclogliflogrepeat)
3. [Issue 2 — EXCLUDED_ARCHS mismatch (x86_64 vs arm64)](#3-issue-2--excluded_archs-mismatch-x86_64-vs-arm64)
4. [Issue 3 — OpenCV 4.3.0 built for iOS device, not simulator](#4-issue-3--opencv-430-built-for-ios-device-not-simulator)
5. [Approaches That Failed](#5-approaches-that-failed)
6. [The Working Fix — In-Place Binary Patch of the AR Archive](#6-the-working-fix--in-place-binary-patch-of-the-ar-archive)
7. [Summary of All File Changes](#7-summary-of-all-file-changes)
8. [Additional Framework Patches Required for iOS 26.4](#8-additional-framework-patches-required-for-ios-264)
9. [How to Reproduce the Fix From Scratch](#9-how-to-reproduce-the-fix-from-scratch)
10. [Quick Troubleshooting Guide](#10-quick-troubleshooting-guide)
11. [Why These Issues Appeared (Root Causes)](#11-why-these-issues-appeared-root-causes)

---

## 1. Overview of Issues

There were **multiple independent, compounding issues** that all had to be resolved before the simulator build succeeded:

| #   | Error                                                                          | Root Cause                                                                  | Quick Fix |
| --- | ------------------------------------------------------------------------------ | --------------------------------------------------------------------------- | --------- |
| 1   | `ld: library 'Pods-MusclogLiftLogRepeat' not found`                            | Xcode 26 regression: implicit cross-project dependencies stopped working    | See Section 2 |
| 2   | `found architecture 'x86_64', required architecture 'arm64'`                   | Pods xcconfigs excluded arm64 for the simulator                             | See Section 3 |
| 3   | `ld: building for 'iOS-simulator', but linking in object file built for 'iOS'` | OpenCV 4.3.0's arm64 slice is tagged as an iOS device binary, not simulator | `python3 fix_opencv_simulator.py` |
| 4   | MLImage/MLKit linking errors                                                   | MLKit frameworks also tagged for iOS device instead of simulator            | `python3 fix_mlimage_simulator.py` and `python3 fix_mlkit_simulator.py` |

Each issue surfaced only after the previous one was fixed.

---

## 2. Issue 1 — Linker cannot find `Pods-MusclogLiftLogRepeat`

### Symptom

```
ld: library 'Pods-MusclogLiftLogRepeat' not found
clang: error: linker command failed with exit code 1
```

### Investigation

The Pods integration in an Expo/React Native project works through a CocoaPods-generated static library target (`Pods-MusclogLiftLogRepeat`) that lives inside `ios/Pods/Pods.xcodeproj`. The main app target links against this library. For Xcode to build it first, the main target must have a **target dependency** on it.

Opened `ios/MusclogLiftLogRepeat.xcodeproj/project.pbxproj` and searched for `dependencies` in the main `PBXNativeTarget` section:

```
/* MusclogLiftLogRepeat */ = {
    isa = PBXNativeTarget;
    ...
    dependencies = (
    );
    ...
};
```

The `dependencies` array was **empty**. In Xcode 14 and earlier this worked via implicit dependency detection — Xcode would infer the dependency from the linked library path. **Xcode 26 broke this implicit detection for cross-workspace projects.** The dependency now has to be explicit.

### Fix

Three objects needed to be added to `project.pbxproj`:

**1. A `PBXFileReference` pointing to `Pods.xcodeproj`:**

```
E8E11EA3CEC44DF7A02CE491 /* Pods.xcodeproj */ = {
    isa = PBXFileReference;
    lastKnownFileType = "wrapper.pb-project";
    name = Pods.xcodeproj;
    path = Pods/Pods.xcodeproj;
    sourceTree = "<group>";
};
```

**2. A `PBXContainerItemProxy` referencing the target inside that project:**

```
51214D45C20A4F599D6C7371 /* PBXContainerItemProxy */ = {
    isa = PBXContainerItemProxy;
    containerPortal = E8E11EA3CEC44DF7A02CE491 /* Pods.xcodeproj */;
    proxyType = 1;
    remoteGlobalIDString = 4B963AE7B5F67531C95022CA7ABE42D0;
    remoteInfo = "Pods-MusclogLiftLogRepeat";
};
```

> **Note**: `remoteGlobalIDString` is the UUID of the `Pods-MusclogLiftLogRepeat` target inside `Pods/Pods.xcodeproj/project.pbxproj`. Find it by searching that file for `"Pods-MusclogLiftLogRepeat"` in a `PBXNativeTarget` section.

**3. A `PBXTargetDependency` tying the proxy to the main target:**

```
AF0E8295EA1C4ED79216E101 /* PBXTargetDependency */ = {
    isa = PBXTargetDependency;
    name = "Pods-MusclogLiftLogRepeat";
    targetProxy = 51214D45C20A4F599D6C7371 /* PBXContainerItemProxy */;
};
```

**4. The main target's `dependencies` array updated:**

```
dependencies = (
    AF0E8295EA1C4ED79216E101 /* PBXTargetDependency */,
);
```

Also ran `pod install` to ensure the Pods project was up to date.

---

## 3. Issue 2 — EXCLUDED_ARCHS mismatch (x86_64 vs arm64)

### Symptom

```
ld: warning: ignoring file .../libPods-MusclogLiftLogRepeat.a,
    found architecture 'x86_64', required architecture 'arm64'
ld: building for 'iOS-simulator', but linking in object file
    (opencv2[arm64][40](alloc.o)) built for 'iOS'
```

The first line is actually issue 2; the second line is issue 3 (addressed below). They appeared together.

### Investigation

iOS 26 simulators run on Apple Silicon Macs and are **arm64 only** — there is no x86_64 simulator slice anymore. The main app target was correctly building for arm64. But the Pods static library was being compiled for x86_64.

Checked the xcconfig files that CocoaPods generated:

```
ios/Pods/Target Support Files/Pods-MusclogLiftLogRepeat/Pods-MusclogLiftLogRepeat.debug.xcconfig
ios/Pods/Target Support Files/Pods-MusclogLiftLogRepeat/Pods-MusclogLiftLogRepeat.release.xcconfig
ios/Pods/Target Support Files/OpenCV/OpenCV.debug.xcconfig
ios/Pods/Target Support Files/OpenCV/OpenCV.release.xcconfig
```

All four contained:

```
EXCLUDED_ARCHS[sdk=iphonesimulator*] = arm64
```

This is a legacy setting from the Intel Mac era — when you had an Apple Silicon Mac, arm64 was excluded from simulator builds so that Rosetta 2 could run x86_64 simulator binaries. This made sense in 2021–2023. It breaks completely on iOS 26, which has no x86_64 simulator.

### Fix

Removed the `EXCLUDED_ARCHS[sdk=iphonesimulator*] = arm64` line from all four xcconfig files.

Also verified that `project.pbxproj` had the main target's setting as:

```
"EXCLUDED_ARCHS[sdk=iphonesimulator*]" = "";
```

(empty string, not inheriting the old exclusion).

> **Warning**: If you re-run `pod install`, CocoaPods may regenerate these xcconfig files and put the line back. You would need to remove it again or add a `post_install` hook (see caveats in Section 5).

#### Quick Fix

**Try running the following command to fix this issue:**

```bash
# Remove EXCLUDED_ARCHS from all xcconfig files
for f in \
  "ios/Pods/Target Support Files/Pods-MusclogLiftLogRepeat/Pods-MusclogLiftLogRepeat.debug.xcconfig" \
  "ios/Pods/Target Support Files/Pods-MusclogLiftLogRepeat/Pods-MusclogLiftLogRepeat.release.xcconfig" \
  "ios/Pods/Target Support Files/OpenCV/OpenCV.debug.xcconfig" \
  "ios/Pods/Target Support Files/OpenCV/OpenCV.release.xcconfig"; do
  sed -i '' '/EXCLUDED_ARCHS\[sdk=iphonesimulator\*\] = arm64/d' "$f"
done
```

Or add this to your `Podfile` to fix it automatically after each `pod install`:

```ruby
post_install do |installer|
  # ... existing post_install code ...
  
  # Fix for iOS 26.4 simulator (arm64 only, no x86_64)
  installer.pods_project.targets.each do |target|
    target.build_configurations.each do |config|
      config.build_settings['EXCLUDED_ARCHS[sdk=iphonesimulator*]'] = ''
    end
  end
  installer.pods_project.build_configurations.each do |config|
    config.build_settings['EXCLUDED_ARCHS[sdk=iphonesimulator*]'] = ''
  end
end
```

---

## 4. Issue 3 — OpenCV 4.3.0 built for iOS device, not simulator

### Symptom

```
ld: building for 'iOS-simulator', but linking in object file
    (opencv2[arm64][40](alloc.o)) built for 'iOS'
ld: building for 'iOS-simulator', but linking in object file
    (opencv2[arm64][41](alloc.o)) built for 'iOS'
... (many more)
```

### Investigation

The `opencv2.framework` is a **fat (universal) binary** containing two architecture slices:

- `x86_64` — for Intel Mac simulator (old, irrelevant now)
- `arm64` — for Apple Silicon simulator AND for iPhone device

The arm64 slice is itself an **AR archive** (a static library) containing 738 compiled object files (`.o`). Each object file is a Mach-O binary with **load commands** in the header.

The arm64 slice had a load command:

```
LC_VERSION_MIN_IPHONEOS  (cmd = 0x25)
    version 3.0
    sdk     n/a
```

This tag tells the linker "this object was compiled for iOS device". Starting with Xcode 15, the linker enforces that simulator builds must not link objects tagged as iOS device binaries. Hence the error.

The correct tag for a simulator object is `LC_BUILD_VERSION` with platform `iossim`, or simply no platform-specific load command at all.

#### Why this happened

OpenCV 4.3.0 was released in 2020. At the time, arm64 simulator support was new and the CocoaPods distribution wasn't properly dual-tagged. The arm64 slice was compiled once for device and reused for simulator. Older Xcode versions accepted this.

#### Structure of the binary

```
opencv2  (fat binary)
├── x86_64 slice  →  AR archive of .o files
└── arm64 slice   →  AR archive of .o files  ← each .o has LC_VERSION_MIN_IPHONEOS
```

The AR format used is macOS extended format where long filenames are stored inline:

```
!<arch>
#1/N  <timestamp> <uid> <gid> <mode> <size>
<N bytes of filename><rest of .o file data>
```

---

## 5. Approaches That Failed

### 5a. Podfile `post_install` hook with `vtool`

Added a hook to the Podfile:

```ruby
post_install do |installer|
  opencv_framework = "#{installer.sandbox.root}/OpenCV/opencv2.framework/opencv2"
  system("vtool -set-build-version iphonesimulator 15.0 15.0 -replace -output #{opencv_framework} #{opencv_framework}")
  react_native_post_install(installer, ...)
end
```

**Failed for two reasons:**

1. `vtool` platform names are `ios` and `iossim` — not `iphoneos` and `iphonesimulator`.
2. Even with the correct name (`iossim`), `LC_BUILD_VERSION` is 24 bytes while `LC_VERSION_MIN_IPHONEOS` is only 16 bytes. vtool cannot replace a smaller load command with a larger one in-place without rewriting the entire binary. It silently did nothing.

Also, `react_native_post_install` crashed with a Ruby 4.0 / xcodeproj / Atomos gem incompatibility when run after any modification to the project, so the hook approach was abandoned entirely.

### 5b. `-ld_classic` linker flag

Added `OTHER_LDFLAGS = -ld_classic` to bypass the new linker's platform checks.

**Failed**: The classic linker does not support xcframeworks. Skia's `libpathops.xcframework` (required by Victory Native charts) immediately caused:

```
ld: can't open output file for writing [...] libpathops, errno=2
```

### 5c. Extract → vtool → repack

```bash
lipo opencv2 -thin arm64 -output opencv2_arm64
ar -x opencv2_arm64  # extract all .o files
vtool -set-build-version iossim 15.0 15.0 -replace -output foo.o foo.o  # for each .o
ar -rcs opencv2_arm64_new *.o
lipo opencv2 -replace arm64 opencv2_arm64_new -output opencv2
```

**Failed**: The AR archive contained multiple object files with **identical filenames** (e.g., many files named `alloc.o`, `matrix.o`, etc. from different OpenCV modules). `ar -x` only keeps the last extracted file for each name, silently discarding the earlier ones. The repacked archive was missing hundreds of symbols:

```
ld: symbol(s) not found for architecture arm64
Undefined symbols:
  cv::fastMalloc(unsigned long)
  cv::fastFree(void*)
  _cvAlloc
  _cvFree_
  ... (many more)
```

### 5d. Python extract → patch → repack

Wrote a Python script to parse the AR binary manually (avoiding the filename collision), patch each `.o`, and repack with a unique name per member. This correctly patched the load commands but the resulting archive was malformed — the standard linker rejected it because member names were changed.

---

## 6. The Working Fix — In-Place Binary Patch of the AR Archive

### Key insight

Instead of extracting and repacking (which loses duplicate-named members), we can **patch the bytes directly inside the AR archive in memory**, then write the modified bytes back. The AR structure is simple enough to parse without any external tools.

The plan:

1. Read the entire fat binary into a `bytearray`.
2. Use `lipo -thin arm64` to find the byte offset and size of the arm64 slice.
3. Walk the AR archive format within that slice in-place.
4. For each AR member that is a Mach-O binary, scan its load commands.
5. Change `cmd = 0x25` (`LC_VERSION_MIN_IPHONEOS`) to `cmd = 0x35` (an unknown/reserved command that the linker ignores). Both are the same size (16 bytes), so no shifting is needed.
6. Use `lipo -replace arm64` to write the patched slice back.

### Why changing 0x25 → 0x35 works

- `LC_VERSION_MIN_IPHONEOS` (0x25) is exactly 16 bytes: `cmd (4) + cmdsize (4) + version (4) + sdk (4)`.
- `0x35` is not a recognized load command. The linker logs a warning at most and skips it.
- No size change means no offset arithmetic is needed — the rest of the binary is untouched.
- The load command being removed was only used for platform matching, not for any symbols or code.

### The Python script

```python
#!/usr/bin/env python3
"""
Patch OpenCV 4.3.0 arm64 AR archive in-place.
Changes LC_VERSION_MIN_IPHONEOS (0x25) to an ignored command (0x35)
so the simulator linker accepts the objects.
"""
import struct, subprocess, os, sys, tempfile

FRAMEWORK = "ios/Pods/OpenCV/opencv2.framework/opencv2"
LC_VERSION_MIN_IPHONEOS = 0x25
PATCHED_CMD = 0x35
MH_MAGIC_64 = 0xfeedfacf
AR_MAGIC = b"!<arch>\n"
AR_HEADER_SIZE = 60

def patch_macho_in_place(data, offset, size):
    """Walk a Mach-O at data[offset:offset+size], patch load commands."""
    if size < 8:
        return 0
    magic = struct.unpack_from("<I", data, offset)[0]
    if magic != MH_MAGIC_64:
        return 0
    # Mach-O 64 header: magic(4) cpu_type(4) cpu_subtype(4) filetype(4)
    #                   ncmds(4) sizeofcmds(4) flags(4) reserved(4) = 32 bytes
    ncmds = struct.unpack_from("<I", data, offset + 16)[0]
    lc_offset = offset + 32
    patched = 0
    for _ in range(ncmds):
        if lc_offset + 8 > offset + size:
            break
        cmd, cmdsize = struct.unpack_from("<II", data, lc_offset)
        if cmd == LC_VERSION_MIN_IPHONEOS:
            struct.pack_into("<I", data, lc_offset, PATCHED_CMD)
            patched += 1
        lc_offset += cmdsize
    return patched

def patch_ar_slice(data, ar_start, ar_size):
    """Walk an AR archive, patching each Mach-O member."""
    end = ar_start + ar_size
    pos = ar_start
    assert data[pos:pos+8] == AR_MAGIC, "Not an AR archive"
    pos += 8
    total_members = 0
    total_patched = 0
    while pos + AR_HEADER_SIZE <= end:
        # AR header: name(16) date(12) uid(6) gid(6) mode(8) size(10) end(2)
        header = data[pos:pos + AR_HEADER_SIZE]
        name_field = header[0:16].decode("ascii", errors="replace").rstrip()
        size_field = header[48:58].decode("ascii", errors="replace").strip()
        member_size = int(size_field)
        pos += AR_HEADER_SIZE
        member_start = pos
        # Extended filename: "#1/N" means filename is N bytes at start of data
        name_len = 0
        if name_field.startswith("#1/"):
            name_len = int(name_field[3:])
        obj_start = member_start + name_len
        obj_size  = member_size  - name_len
        if obj_size > 0:
            total_members += 1
            total_patched += patch_macho_in_place(data, obj_start, obj_size)
        pos += member_size
        if pos % 2 != 0:
            pos += 1  # AR members are 2-byte aligned
    return total_members, total_patched

# ── main ──────────────────────────────────────────────────────────────────────

# 1. Thin the fat binary to get arm64 offset/size
info = subprocess.check_output(["lipo", "-info", FRAMEWORK]).decode()
print(info.strip())

# Extract arm64 slice to a temp file
with tempfile.NamedTemporaryFile(suffix=".arm64", delete=False) as tf:
    arm64_path = tf.name
subprocess.check_call(["lipo", FRAMEWORK, "-thin", "arm64", "-output", arm64_path])

# 2. Read into mutable bytearray
data = bytearray(open(arm64_path, "rb").read())

# 3. Patch in-place
members, patched = patch_ar_slice(data, 0, len(data))
print(f"Found {members} Mach-O members, patched {patched} LC_VERSION_MIN_IPHONEOS commands.")

# 4. Write patched slice back
open(arm64_path, "wb").write(data)

# 5. Replace arm64 slice in fat binary
subprocess.check_call(["lipo", FRAMEWORK, "-replace", "arm64", arm64_path, "-output", FRAMEWORK])
os.unlink(arm64_path)
print("Done! Patched in-place, all symbols preserved.")
```

### Running it

```bash
cd ~/Documents/Projects/musclog-app
python3 fix_opencv_simulator.py
```

Expected output:

```
Architectures in the fat file: ios/Pods/OpenCV/opencv2.framework/opencv2 are: x86_64 arm64
Found 738 Mach-O members, patched 738 LC_VERSION_MIN_IPHONEOS commands.
Done! Patched in-place, all symbols preserved.
```

### Quick Fix

**Try running this script to fix OpenCV:**

```bash
python3 fix_opencv_simulator.py
```

Expected output:
```
Architectures in the fat file: ios/Pods/OpenCV/opencv2.framework/Versions/A/opencv2 are: armv7 armv7s i386 x86_64 arm64
Found 739 Mach-O members, patched 738 LC_VERSION_MIN_IPHONEOS commands.
Done! Patched OpenCV in-place.
```

### Restoring if needed

The original unpatched binary lives in the CocoaPods cache:

```
~/Library/Caches/CocoaPods/Pods/Release/OpenCV/4.3.0-681e0/opencv2.framework/opencv2
```

To restore:

```bash
cp ~/Library/Caches/CocoaPods/Pods/Release/OpenCV/4.3.0-681e0/opencv2.framework/opencv2 \
   ~/Documents/Projects/musclog-app/ios/Pods/OpenCV/opencv2.framework/Versions/A/opencv2
```

Then re-run the patch script if needed.

---

## 7. Summary of All File Changes

### `ios/MusclogLiftLogRepeat.xcodeproj/project.pbxproj`

| Change                                 | What was added/modified                                               |
| -------------------------------------- | --------------------------------------------------------------------- |
| Added `PBXFileReference`               | Points to `Pods/Pods.xcodeproj`                                       |
| Added `PBXContainerItemProxy`          | References `Pods-MusclogLiftLogRepeat` target inside `Pods.xcodeproj` |
| Added `PBXTargetDependency`            | Wraps the proxy                                                       |
| Updated main target `dependencies`     | From `()` to `(AF0E8295EA1C4ED79216E101)`                             |
| `EXCLUDED_ARCHS[sdk=iphonesimulator*]` | Set to `""` (was `arm64` or inherited)                                |

### `ios/Pods/Target Support Files/Pods-MusclogLiftLogRepeat/Pods-MusclogLiftLogRepeat.debug.xcconfig`

- Removed: `EXCLUDED_ARCHS[sdk=iphonesimulator*] = arm64`

### `ios/Pods/Target Support Files/Pods-MusclogLiftLogRepeat/Pods-MusclogLiftLogRepeat.release.xcconfig`

- Removed: `EXCLUDED_ARCHS[sdk=iphonesimulator*] = arm64`

### `ios/Pods/Target Support Files/OpenCV/OpenCV.debug.xcconfig`

- Removed: `EXCLUDED_ARCHS[sdk=iphonesimulator*] = arm64`

### `ios/Pods/Target Support Files/OpenCV/OpenCV.release.xcconfig`

- Removed: `EXCLUDED_ARCHS[sdk=iphonesimulator*] = arm64`

### `ios/Pods/OpenCV/opencv2.framework/opencv2`

- Binary patched in-place: 738 `LC_VERSION_MIN_IPHONEOS` (0x25) load commands changed to 0x35 in the arm64 AR archive slice.

### `ios/Pods/MLImage/Frameworks/MLImage.framework/MLImage`

- Binary patched in-place: `LC_BUILD_VERSION` platform changed from 2 (iOS) to 7 (iOS Simulator) in the arm64 slice.

### `ios/Pods/MLKit*/Frameworks/*.framework/*`

- MLKitCommon: 397/398 objects patched
- MLKitVision: 11/12 objects patched  
- MLKitTextRecognition: 2/3 objects patched
- MLKitTextRecognitionChinese: 1/2 objects patched
- MLKitTextRecognitionDevanagari: 1/2 objects patched
- MLKitTextRecognitionJapanese: 1/2 objects patched
- MLKitTextRecognitionKorean: 1/2 objects patched

All patches change `LC_BUILD_VERSION` platform from 2 (iOS) to 7 (iOS Simulator) in object files.

---

## 8. Additional Framework Patches Required for iOS 26.4

In addition to OpenCV, the following frameworks may also need patching for iOS 26.4 simulator builds:

### MLImage.framework

**Error:** `building for 'iOS-simulator', but linking in object file .../MLImage[arm64][2](GMLImage.o)) built for 'iOS'`

**Fix:** Run the MLImage patch script:

```bash
python3 fix_mlimage_simulator.py
```

### MLKit Frameworks (MLKitCommon, MLKitVision, etc.)

**Error:** `building for 'iOS-simulator', but linking in object file .../MLKitCommon[arm64][2](MLKAnalyticsLogger.o)) built for 'iOS'`

**Fix:** Run the MLKit patch script:

```bash
python3 fix_mlkit_simulator.py
```

This patches all MLKit frameworks (MLKitCommon, MLKitVision, MLKitBarcodeScanning, MLKitTextRecognition, etc.) in one operation.

---

## 9. How to Reproduce the Fix From Scratch

If `pod install` or a clean checkout reverts these changes, here is the complete sequence:

```bash
cd ~/Documents/Projects/musclog-app

# Step 1: Install pods
cd ios && pod install && cd ..

# Step 2: Remove arm64 exclusions from xcconfigs
for f in \
  "ios/Pods/Target Support Files/Pods-MusclogLiftLogRepeat/Pods-MusclogLiftLogRepeat.debug.xcconfig" \
  "ios/Pods/Target Support Files/Pods-MusclogLiftLogRepeat/Pods-MusclogLiftLogRepeat.release.xcconfig" \
  "ios/Pods/Target Support Files/OpenCV/OpenCV.debug.xcconfig" \
  "ios/Pods/Target Support Files/OpenCV/OpenCV.release.xcconfig"; do
  sed -i '' '/EXCLUDED_ARCHS\[sdk=iphonesimulator\*\] = arm64/d' "$f"
done

# Step 3: Restore original OpenCV binary from cache (if already patched before)
cp ~/Library/Caches/CocoaPods/Pods/Release/OpenCV/4.3.0-681e0/opencv2.framework/opencv2 \
   ios/Pods/OpenCV/opencv2.framework/Versions/A/opencv2

# Step 4: Run the patch scripts
python3 fix_opencv_simulator.py
python3 fix_mlimage_simulator.py
python3 fix_mlkit_simulator.py

# Step 5: Build
npx expo run:ios
```

> **Note on project.pbxproj**: The `PBXTargetDependency` and related entries should already be committed to git and not be touched by `pod install`. If they disappear, manually re-add them following Section 2.

---

## 10. Quick Troubleshooting Guide

| Error | Fix |
|-------|-----|
| `ld: library 'Pods-MusclogLiftLogRepeat' not found` | Check that `project.pbxproj` has the `PBXTargetDependency` entries (Section 2) |
| `found architecture 'x86_64', required architecture 'arm64'` | Run the sed command or add the `post_install` hook (Section 3) |
| `building for 'iOS-simulator', but linking in object file ... opencv2[arm64]... built for 'iOS'` | Run `python3 fix_opencv_simulator.py` |
| `building for 'iOS-simulator', but linking in object file ... MLImage[arm64]... built for 'iOS'` | Run `python3 fix_mlimage_simulator.py` |
| `building for 'iOS-simulator', but linking in object file ... MLKitCommon[arm64]... built for 'iOS'` | Run `python3 fix_mlkit_simulator.py` |

---

## 11. Why These Issues Appeared (Root Causes)

### Xcode 26 implicit dependency regression

Xcode has always relied on "implicit dependencies" — inferring that if your app links `-lPods-MusclogLiftLogRepeat`, it should build `Pods-MusclogLiftLogRepeat` first. In Xcode 26, this inference no longer crosses workspace project boundaries reliably. Apple may fix this in a later Xcode release, but until then the explicit `PBXTargetDependency` is required.

### `EXCLUDED_ARCHS = arm64` for simulator

This setting originated in 2021 when Apple Silicon Macs were new and many third-party libraries only had x86_64 simulator slices. To make `pod install` work on those Macs without recompiling everything, CocoaPods added `EXCLUDED_ARCHS[sdk=iphonesimulator*] = arm64` — this told the simulator build to use x86_64 via Rosetta. As of iOS 26 / macOS 26, Rosetta support for simulators is gone. The setting is now harmful.

### OpenCV 4.3.0 platform tag

OpenCV 4.3.0 (released January 2021) predates the enforcement of per-platform Mach-O tags for fat binaries. The CocoaPods distribution packaged the arm64 slice with `LC_VERSION_MIN_IPHONEOS`, meaning "iOS device arm64". Xcode 15+ and Xcode 26 enforce that simulator builds only link objects with `LC_BUILD_VERSION platform=iossim` or with no platform restriction at all. OpenCV 4.3.x will never be updated; upgrading to a newer OpenCV major version would fix this, but that requires `GutenOCR` (the OCR pod that depends on it) to be updated first.
