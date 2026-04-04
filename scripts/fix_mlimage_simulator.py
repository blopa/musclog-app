#!/usr/bin/env python3
"""
Patch MLImage framework arm64 slice in-place.
Changes LC_BUILD_VERSION platform from 2 (iOS device) to 7 (iOS simulator)
in the arm64 slice so the simulator linker accepts it.
"""
import struct, subprocess, os, sys, tempfile

FRAMEWORK = "../ios/Pods/MLImage/Frameworks/MLImage.framework/MLImage"
LC_BUILD_VERSION = 0x32  # 50 in decimal
PLATFORM_IOS = 2
PLATFORM_IOSSIMULATOR = 7
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
        if lc_offset + 24 > offset + size:
            break
        cmd, cmdsize = struct.unpack_from("<II", data, lc_offset)
        if cmd == LC_BUILD_VERSION:
            # LC_BUILD_VERSION structure:
            # cmd (4) + cmdsize (4) + platform (4) + minos (4) + sdk (4) + ntools (4) = 24 bytes
            platform = struct.unpack_from("<I", data, lc_offset + 8)[0]
            if platform == PLATFORM_IOS:
                # Change platform from iOS (2) to iOS Simulator (7)
                struct.pack_into("<I", data, lc_offset + 8, PLATFORM_IOSSIMULATOR)
                patched += 1
                print(f"  Patched LC_BUILD_VERSION platform: {platform} -> {PLATFORM_IOSSIMULATOR} at offset {lc_offset}")
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
            p = patch_macho_in_place(data, obj_start, obj_size)
            if p > 0:
                print(f"  Patched member at offset {obj_start}, size {obj_size}")
            total_patched += p
        pos += member_size
        if pos % 2 != 0:
            pos += 1  # AR members are 2-byte aligned
    return total_members, total_patched

# ── main ──────────────────────────────────────────────────────────────────────

if not os.path.exists(FRAMEWORK):
    print(f"Error: {FRAMEWORK} not found")
    sys.exit(1)

# 1. Check architectures
info = subprocess.check_output(["lipo", "-info", FRAMEWORK]).decode()
print(f"Original: {info.strip()}")

# Extract arm64 slice to a temp file
with tempfile.NamedTemporaryFile(suffix=".arm64", delete=False) as tf:
    arm64_path = tf.name
subprocess.check_call(["lipo", FRAMEWORK, "-thin", "arm64", "-output", arm64_path])

# 2. Read into mutable bytearray
data = bytearray(open(arm64_path, "rb").read())

# 3. Patch in-place
print("Patching arm64 slice...")
result = patch_ar_slice(data, 0, len(data))
if isinstance(result, tuple):
    members, patched = result
    print(f"Found {members} members, patched {patched} LC_BUILD_VERSION commands.")
else:
    patched = result
    print(f"Patched {patched} LC_BUILD_VERSION commands.")

# 4. Write patched slice back
open(arm64_path, "wb").write(data)

# 5. Replace arm64 slice in fat binary
subprocess.check_call(["lipo", FRAMEWORK, "-replace", "arm64", arm64_path, "-output", FRAMEWORK])
os.unlink(arm64_path)

# Verify
print("\nVerifying patch...")
info = subprocess.check_output(["otool", "-l", FRAMEWORK]).decode()
lines = info.split('\n')
for i, line in enumerate(lines):
    if 'LC_BUILD_VERSION' in line and i + 3 < len(lines):
        platform_line = lines[i + 3]
        if 'platform' in platform_line:
            print(f"  {line.strip()}")
            print(f"  {lines[i+1].strip()}")
            print(f"  {lines[i+2].strip()}")
            print(f"  {platform_line.strip()}")

print("\nDone! Patched MLImage in-place.")
