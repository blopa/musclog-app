#!/usr/bin/env python3
"""
Patch MLKit framework arm64 slices in-place.
Changes LC_BUILD_VERSION platform from 2 (iOS) to 7 (iOS Simulator)
in the arm64 slice so the simulator linker accepts the objects.
"""
import struct, subprocess, os, sys, tempfile, glob

# List of MLKit frameworks to patch
FRAMEWORKS = [
    "ios/Pods/MLKitCommon/Frameworks/MLKitCommon.framework/MLKitCommon",
    "ios/Pods/MLKitBarcodeScanning/Frameworks/MLKitBarcodeScanning.framework/MLKitBarcodeScanning",
    "ios/Pods/MLKitVision/Frameworks/MLKitVision.framework/MLKitVision",
    "ios/Pods/MLKitTextRecognition/Frameworks/MLKitTextRecognition.framework/MLKitTextRecognition",
    "ios/Pods/MLKitTextRecognitionCommon/Frameworks/MLKitTextRecognitionCommon.framework/MLKitTextRecognitionCommon",
    "ios/Pods/MLKitTextRecognitionChinese/Frameworks/MLKitTextRecognitionChinese.framework/MLKitTextRecognitionChinese",
    "ios/Pods/MLKitTextRecognitionDevanagari/Frameworks/MLKitTextRecognitionDevanagari.framework/MLKitTextRecognitionDevanagari",
    "ios/Pods/MLKitTextRecognitionJapanese/Frameworks/MLKitTextRecognitionJapanese.framework/MLKitTextRecognitionJapanese",
    "ios/Pods/MLKitTextRecognitionKorean/Frameworks/MLKitTextRecognitionKorean.framework/MLKitTextRecognitionKorean",
]

LC_VERSION_MIN_IPHONEOS = 0x25
LC_BUILD_VERSION = 0x32  # 50 in decimal
PLATFORM_IOS = 2
PLATFORM_IOSSIMULATOR = 7
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
        elif cmd == LC_BUILD_VERSION:
            # LC_BUILD_VERSION structure:
            # cmd (4) + cmdsize (4) + platform (4) + minos (4) + sdk (4) + ntools (4) = 24 bytes
            if lc_offset + 12 <= offset + size:
                platform = struct.unpack_from("<I", data, lc_offset + 8)[0]
                if platform == PLATFORM_IOS:
                    struct.pack_into("<I", data, lc_offset + 8, PLATFORM_IOSSIMULATOR)
                    patched += 1
        lc_offset += cmdsize
    return patched

def patch_ar_slice(data, ar_start, ar_size):
    """Walk an AR archive, patching each Mach-O member."""
    end = ar_start + ar_size
    pos = ar_start
    if data[pos:pos+8] != AR_MAGIC:
        # Not an AR archive, might be a single object file
        return patch_macho_in_place(data, ar_start, ar_size)
    pos += 8
    total_members = 0
    total_patched = 0
    while pos + AR_HEADER_SIZE <= end:
        # AR header: name(16) date(12) uid(6) gid(6) mode(8) size(10) end(2)
        header = data[pos:pos + AR_HEADER_SIZE]
        name_field = header[0:16].decode("ascii", errors="replace").rstrip()
        size_field = header[48:58].decode("ascii", errors="replace").strip()
        try:
            member_size = int(size_field)
        except ValueError:
            break
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

def patch_framework(framework_path):
    """Patch a single framework."""
    if not os.path.exists(framework_path):
        print(f"  Skip: {framework_path} not found")
        return 0, 0
    
    # Check architectures
    try:
        info = subprocess.check_output(["lipo", "-info", framework_path], stderr=subprocess.DEVNULL).decode()
    except subprocess.CalledProcessError:
        print(f"  Error: Cannot get info for {framework_path}")
        return 0, 0
    
    if "arm64" not in info:
        print(f"  Skip: {framework_path} has no arm64 slice")
        return 0, 0
    
    # Extract arm64 slice to a temp file
    with tempfile.NamedTemporaryFile(suffix=".arm64", delete=False) as tf:
        arm64_path = tf.name
    try:
        subprocess.check_call(["lipo", framework_path, "-thin", "arm64", "-output", arm64_path], 
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        
        # Read into mutable bytearray
        with open(arm64_path, "rb") as f:
            data = bytearray(f.read())
        
        # Patch in-place
        result = patch_ar_slice(data, 0, len(data))
        
        if isinstance(result, tuple):
            members, patched = result
            if patched > 0:
                # Write patched slice back
                with open(arm64_path, "wb") as f:
                    f.write(data)
                # Replace arm64 slice in fat binary
                subprocess.check_call(["lipo", framework_path, "-replace", "arm64", arm64_path, "-output", framework_path],
                                    stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                print(f"  Patched {patched}/{members} objects in {os.path.basename(framework_path)}")
                return members, patched
            else:
                return members, 0
        else:
            if result > 0:
                with open(arm64_path, "wb") as f:
                    f.write(data)
                subprocess.check_call(["lipo", framework_path, "-replace", "arm64", arm64_path, "-output", framework_path],
                                    stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                print(f"  Patched {result} objects in {os.path.basename(framework_path)}")
            return result, result
    finally:
        if os.path.exists(arm64_path):
            os.unlink(arm64_path)

# ── main ──────────────────────────────────────────────────────────────────────

print("Patching MLKit frameworks for iOS Simulator...\n")

total_members = 0
total_patched = 0

for framework in FRAMEWORKS:
    m, p = patch_framework(framework)
    total_members += m
    total_patched += p

print(f"\nDone! Patched {total_patched}/{total_members} objects across all MLKit frameworks.")
