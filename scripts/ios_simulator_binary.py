#!/usr/bin/env python3
"""Shared Mach-O patching for legacy iOS-only framework slices."""

from dataclasses import dataclass
import os
import struct
import subprocess
import tempfile


AR_HEADER_SIZE = 60
AR_MAGIC = b"!<arch>\n"
LC_BUILD_VERSION = 0x32
LC_VERSION_MIN_IPHONEOS = 0x25
MH_MAGIC_64 = 0xFEEDFACF
NEUTRALIZED_VERSION_COMMAND = 0x35
PLATFORM_IOS = 2
PLATFORM_IOSSIMULATOR = 7


@dataclass
class PatchStats:
    macho_members: int = 0
    legacy_version_commands_patched: int = 0
    build_version_commands_patched: int = 0
    simulator_commands: int = 0
    neutralized_commands: int = 0

    @property
    def patched_commands(self):
        return self.legacy_version_commands_patched + self.build_version_commands_patched

    def include(self, other):
        self.macho_members += other.macho_members
        self.legacy_version_commands_patched += other.legacy_version_commands_patched
        self.build_version_commands_patched += other.build_version_commands_patched
        self.simulator_commands += other.simulator_commands
        self.neutralized_commands += other.neutralized_commands


@dataclass
class Arm64PatchResult:
    architecture_info: str
    stats: PatchStats


def patch_macho_in_place(data, offset, size):
    stats = PatchStats()
    if size < 4 or struct.unpack_from("<I", data, offset)[0] != MH_MAGIC_64:
        return stats
    if size < 32:
        raise ValueError("Truncated 64-bit Mach-O header")

    stats.macho_members = 1
    member_end = offset + size
    command_offset = offset + 32
    command_count = struct.unpack_from("<I", data, offset + 16)[0]

    for _ in range(command_count):
        if command_offset + 8 > member_end:
            raise ValueError("Truncated Mach-O load command")

        command, command_size = struct.unpack_from("<II", data, command_offset)
        if command_size < 8 or command_offset + command_size > member_end:
            raise ValueError("Invalid Mach-O load command size")

        if command == LC_VERSION_MIN_IPHONEOS:
            struct.pack_into("<I", data, command_offset, NEUTRALIZED_VERSION_COMMAND)
            stats.legacy_version_commands_patched += 1
        elif command == NEUTRALIZED_VERSION_COMMAND and command_size == 16:
            stats.neutralized_commands += 1
        elif command == LC_BUILD_VERSION:
            if command_size < 24:
                raise ValueError("Invalid LC_BUILD_VERSION command size")
            platform = struct.unpack_from("<I", data, command_offset + 8)[0]
            if platform == PLATFORM_IOS:
                struct.pack_into("<I", data, command_offset + 8, PLATFORM_IOSSIMULATOR)
                stats.build_version_commands_patched += 1
            elif platform == PLATFORM_IOSSIMULATOR:
                stats.simulator_commands += 1

        command_offset += command_size

    return stats


def patch_binary_data(data):
    if data[: len(AR_MAGIC)] != AR_MAGIC:
        return patch_macho_in_place(data, 0, len(data))

    stats = PatchStats()
    position = len(AR_MAGIC)
    while position + AR_HEADER_SIZE <= len(data):
        header = data[position : position + AR_HEADER_SIZE]
        if header[58:60] != b"`\n":
            raise ValueError("Invalid AR member header")

        name_field = header[0:16].decode("ascii", errors="replace").rstrip()
        size_field = header[48:58].decode("ascii", errors="replace").strip()
        try:
            member_size = int(size_field)
        except ValueError as error:
            raise ValueError("Invalid AR member size") from error

        position += AR_HEADER_SIZE
        filename_size = int(name_field[3:]) if name_field.startswith("#1/") else 0
        object_offset = position + filename_size
        object_size = member_size - filename_size
        if object_size < 0 or position + member_size > len(data):
            raise ValueError("AR member extends beyond the archive")

        stats.include(patch_macho_in_place(data, object_offset, object_size))
        position += member_size
        if position % 2:
            position += 1

    return stats


def patch_arm64_binary(binary_path):
    architecture_info = subprocess.check_output(["lipo", "-info", binary_path]).decode().strip()
    architectures = subprocess.check_output(["lipo", "-archs", binary_path]).decode().split()
    if "arm64" not in architectures:
        return Arm64PatchResult(architecture_info, PatchStats())

    if len(architectures) == 1:
        with open(binary_path, "rb") as binary:
            data = bytearray(binary.read())
        stats = _patch_and_verify(data, binary_path)
        if stats.patched_commands:
            with open(binary_path, "wb") as binary:
                binary.write(data)
        return Arm64PatchResult(architecture_info, stats)

    with tempfile.NamedTemporaryFile(suffix=".arm64", delete=False) as temporary_file:
        arm64_path = temporary_file.name

    try:
        subprocess.check_call(["lipo", binary_path, "-thin", "arm64", "-output", arm64_path])
        with open(arm64_path, "rb") as binary:
            data = bytearray(binary.read())
        stats = _patch_and_verify(data, binary_path)
        if stats.patched_commands:
            with open(arm64_path, "wb") as binary:
                binary.write(data)
            subprocess.check_call(
                ["lipo", binary_path, "-replace", "arm64", arm64_path, "-output", binary_path]
            )
        return Arm64PatchResult(architecture_info, stats)
    finally:
        if os.path.exists(arm64_path):
            os.unlink(arm64_path)


def _patch_and_verify(data, binary_path):
    stats = patch_binary_data(data)
    if not stats.macho_members:
        raise ValueError(f"No arm64 Mach-O members found in {binary_path}")
    if stats.patched_commands:
        verification = patch_binary_data(bytearray(data))
        if verification.patched_commands:
            raise ValueError(f"Device-only load commands remain in {binary_path}")
    return stats
