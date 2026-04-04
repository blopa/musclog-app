#!/usr/bin/env python3
"""
Patch OpenCV 4.3.0 arm64 AR archive in-place.
Changes LC_VERSION_MIN_IPHONEOS (0x25) to an ignored command (0x35)
so the simulator linker accepts the objects.
"""
import struct, subprocess, os, sys, tempfile

FRAMEWORK = "../ios/Pods/OpenCV/opencv2.framework/Versions/A/opencv2"
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

if not os.path.exists(FRAMEWORK):
    print(f"Error: {FRAMEWORK} not found")
    sys.exit(1)

# 1. Thin the fat binary to get arm64 offset/size
info = subprocess.check_output(["lipo", "-info", FRAMEWORK]).decode()
print(info.strip())

# Extract arm64 slice to a temp file
with tempfile.NamedTemporaryFile(suffix=".arm64", delete=False) as tf:
    arm64_path = tf.name
subprocess.check_call(["lipo", FRAMEWORK, "-thin", "arm64", "-output", arm64_path])

# 2. Read into mutable bytearray
with open(arm64_path, "rb") as f:
    data = bytearray(f.read())

# 3. Patch in-place
members, patched = patch_ar_slice(data, 0, len(data))
print(f"Found {members} Mach-O members, patched {patched} LC_VERSION_MIN_IPHONEOS commands.")

# 4. Write patched slice back
with open(arm64_path, "wb") as f:
    f.write(data)

# 5. Replace arm64 slice in fat binary
subprocess.check_call(["lipo", FRAMEWORK, "-replace", "arm64", arm64_path, "-output", FRAMEWORK])
os.unlink(arm64_path)
print("Done! Patched OpenCV in-place.")
