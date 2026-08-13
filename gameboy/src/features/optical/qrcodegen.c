/*
 * QR Code generator library (C)
 *
 * Copyright (c) Project Nayuki. (MIT License)
 * https://www.nayuki.io/page/qr-code-generator-library
 * Pointer-based module writer adapted from Game Boy QR-Paint.
 * Copyright (c) 2026 bbbbbr. (MIT License)
 * https://github.com/bbbbbr/gameboy_qr_paint
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of
 * this software and associated documentation files (the "Software"), to deal in
 * the Software without restriction, including without limitation the rights to
 * use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
 * the Software, and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 * - The above copyright notice and this permission notice shall be included in
 *   all copies or substantial portions of the Software.
 * - The Software is provided "as is", without warranty of any kind, express or
 *   implied, including but not limited to the warranties of merchantability,
 *   fitness for a particular purpose and noninfringement. In no event shall the
 *   authors or copyright holders be liable for any claim, damages or other
 *   liability, whether in an action of contract, tort or otherwise, arising from,
 *   out of or in connection with the Software or the use or other dealings in the
 *   Software.
 */

#pragma bank 10

#include <gb/gb.h>
#include <gbdk/platform.h>

#include <string.h>
#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>

#include "qrcodegen.h"
#include "qr_rs_products.generated.h"
#define INLINE inline
#define size_t uint16_t

#define assert(a)

/* This cartridge encoder intentionally supports exactly QR version 11-L,
 * alphanumeric mode, and mask 0. Specializing the upstream lookup tables keeps
 * both ROM usage and SDCC compile time bounded. */
#define MASK 0u
#define MODE 2u
#define ECC_CODEWORDS_PER_BLOCK 20u
#define NUM_ERROR_CORRECTION_BLOCKS 4u
#define CHAR_COUNT_BITS 11u

// #define qrcodegen_BUFFER_SZ  (QRPAD * QRSIZE/8)
#define qrcodegen_BUFFER_SZ (QR_OUTPUT_ROW_SZ_BYTES * QRSIZE)

#define QRCODE ((uint8_t *)_SRAM + QR_SRAM_CODE_OFFSET)
#define TMPBUFFER ((uint8_t *)_SRAM + QR_SRAM_TMP_OFFSET)

/*---- Basic QR Code information ----*/

static const uint8_t qr_bitmask[] = {
    0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80,
    0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80,
    0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80,
    0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80,
    0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80,
    0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80,
    0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80,
    0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80,
    0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80,
    0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80,
    0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80,
    0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80,
    0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80,
    0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80,
    0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80,
    0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80,
};

INLINE int int_abs(int value) {
    return value >= 0 ? value : -value;
}

INLINE bool getModule(const uint8_t qrcode[], uint8_t x, uint8_t y) {

    // return qrcode[y * (QRPAD>>3) + (x>>3)] & qr_bitmask[x];
    return qrcode[y * QR_OUTPUT_ROW_SZ_BYTES + (x >> 3)] & qr_bitmask[x];
}

INLINE void setModule(uint8_t qrcode[], uint8_t x, uint8_t y, bool isBlack) {
    // uint8_t v =  qrcode[y * (QRPAD>>3) + (x>>3)];
    uint16_t index = y * QR_OUTPUT_ROW_SZ_BYTES + (x >> 3);
    uint8_t v = qrcode[index];
    v = (v & ~qr_bitmask[x]) | (((uint8_t)((uint8_t)0) - (!!isBlack)) & qr_bitmask[x]);
    // qrcode[y * (QRPAD>>3) + (x>>3)] = v;
    qrcode[index] = v;
}

static void setModuleStatic(uint8_t qrcode[], uint8_t x, uint8_t y, bool isBlack) {
    setModule(qrcode, x, y, isBlack);
}
bool qr_get(uint8_t x, uint8_t y) {
    return getModule(QRCODE, x, y);
}
static void setModuleBounded(uint8_t qrcode[], int x, int y, bool isBlack) {
    if (0 <= x && x < QRSIZE && 0 <= y && y < QRSIZE) setModule(qrcode, x, y, isBlack);
}

// INLINE uint8_t getModule8(const uint8_t qrcode[], uint8_t x, uint8_t y) { return qrcode[y *
// (QRPAD>>3) + (x>>3)]; } INLINE void setModule8(uint8_t qrcode[], uint8_t x, uint8_t y, uint8_t
// value) { qrcode[y * (QRPAD>>3) + (x>>3)] = value; }
INLINE uint8_t getModule8(const uint8_t qrcode[], uint8_t x, uint8_t y) {
    return qrcode[y * QR_OUTPUT_ROW_SZ_BYTES + (x >> 3)];
}
INLINE void setModule8(uint8_t qrcode[], uint8_t x, uint8_t y, uint8_t value) {
    qrcode[y * QR_OUTPUT_ROW_SZ_BYTES + (x >> 3)] = value;
}
uint8_t qr_get8(uint8_t x, uint8_t y) {
    return getModule8(QRCODE, x, y);
}

// Returns the number of data bytes that can be stored in a QR Code of the given version number,
// after all function modules are excluded. This includes remainder bits, so it might not be a
// multiple of 8. The result is in the range [208, 29648]. This could be implemented as a 40-entry
// lookup table.
INLINE int getNumRawDataModules(void) {
    int result = (16 * QRVERSION + 128) * QRVERSION + 64;
    if (QRVERSION >= 2) {
        result -= (25 * (QRVERSION / 7 + 2) - 10) * (QRVERSION / 7 + 2) - 55;
        if (QRVERSION >= 7) result -= 36;
    }
    return result / 8;
}

// Returns the number of 8-bit codewords that can be used for storing data (not ECC),
// for the given version number and error correction level. The result is in the range [9, 2956].
INLINE int getNumDataCodewords(void) {
    return getNumRawDataModules() - ECC_CODEWORDS_PER_BLOCK * NUM_ERROR_CORRECTION_BLOCKS;
}

/*---- Reed-Solomon ECC generator functions ----*/

static uint8_t rsremainder[QR_RS_DEGREE];
static void reedSolomonComputeRemainder(const uint8_t data_[], uint8_t dataLen) {
    const uint8_t *data = data_;
    const uint8_t *products;
    uint8_t factor;
    uint8_t i;
    uint8_t j;

    memset(rsremainder, 0, QR_RS_DEGREE);
    for (i = 0u; i != dataLen; ++i) {
        factor = *data++ ^ rsremainder[0];
        products = qr_rs_products + (uint16_t)factor * QR_RS_DEGREE;
        for (j = 0u; j != QR_RS_DEGREE - 1u; ++j)
            rsremainder[j] = products[j] ^ rsremainder[j + 1u];
        rsremainder[QR_RS_DEGREE - 1u] = products[QR_RS_DEGREE - 1u];
    }
}

// Appends error correction bytes to each block of the given data array, then interleaves
// bytes from the blocks and stores them in the result array. data[0 : dataLen] contains
// the input data. data[dataLen : rawCodewords] is used as a temporary work area and will
// be clobbered by this function. The final answer is stored in result[0 : rawCodewords].
static void addEccAndInterleave(uint8_t data[], uint8_t result[]) {

    int numBlocks = NUM_ERROR_CORRECTION_BLOCKS;
    int blockEccLen = ECC_CODEWORDS_PER_BLOCK;
    int rawCodewords = getNumRawDataModules();
    int dataLen = getNumDataCodewords();
    int numShortBlocks = numBlocks - rawCodewords % numBlocks;
    int shortBlockDataLen = rawCodewords / numBlocks - blockEccLen;

    const uint8_t *dat = data;
    for (int i = 0; i < numBlocks; i++) {
        int datLen = shortBlockDataLen + (i < numShortBlocks ? 0 : 1);
        reedSolomonComputeRemainder(dat, datLen);
        for (int j = 0, k = i; j < datLen; j++, k += numBlocks) { // Copy data
            if (j == shortBlockDataLen) k -= numShortBlocks;
            result[k] = dat[j];
        }
        for (int j = 0, k = dataLen + i; j < blockEccLen; j++, k += numBlocks) // Copy ECC
            result[k] = rsremainder[j];
        dat += datLen;
    }
}

/*---- Drawing function modules ----*/

// Calculates and stores an ascending list of positions of alignment patterns
// for this version number, returning the length of the list (in the range [0,7]).
// Each position is in the range [0,177), and are used on both the x and y axes.
// This could be implemented as lookup table of 40 variable-length lists of unsigned bytes.
static int getAlignmentPatternPositions(uint8_t result[7]) {
    if (QRVERSION == 1) return 0;
    int step = (QRVERSION == 32) ? 26
                                 : (QRVERSION * 4 + (QRVERSION / 7 + 2) * 2 + 1) /
                                       ((QRVERSION / 7 + 2) * 2 - 2) * 2;
    for (int i = (QRVERSION / 7 + 2) - 1, pos = QRVERSION * 4 + 10; i >= 1; i--, pos -= step)
        result[i] = (uint8_t)pos;
    result[0] = 6;
    return (QRVERSION / 7 + 2);
}

// Sets every pixel in the range [left : left + width] * [top : top + height] to black.
static void fillRectangle(int left, int top, int width, int height, uint8_t qrcode[]) {
    for (int dy = 0; dy < height; dy++) {
        for (int dx = 0; dx < width; dx++)
            setModuleStatic(qrcode, left + dx, top + dy, true);
    }
}

// Clears the given QR Code grid with white modules for the given
// version's size, then marks every function module as black.
static void initializeFunctionModules(int version, uint8_t qrcode[]) {
    // Initialize QR Code
    memset(qrcode, 0, (size_t)qrcodegen_BUFFER_SZ * sizeof(qrcode[0]));

    // Fill horizontal and vertical timing patterns
    fillRectangle(6, 0, 1, QRSIZE, qrcode);
    fillRectangle(0, 6, QRSIZE, 1, qrcode);

    // Fill 3 finder patterns (all corners except bottom right) and format bits
    fillRectangle(0, 0, 9, 9, qrcode);
    fillRectangle(QRSIZE - 8, 0, 8, 9, qrcode);
    fillRectangle(0, QRSIZE - 8, 9, 8, qrcode);

    // Fill numerous alignment patterns
    uint8_t alignPatPos[7];
    int numAlign = getAlignmentPatternPositions(alignPatPos);
    for (int i = 0; i < numAlign; i++) {
        for (int j = 0; j < numAlign; j++) {
            // Don't draw on the three finder corners
            if (!((i == 0 && j == 0) || (i == 0 && j == numAlign - 1) ||
                  (i == numAlign - 1 && j == 0)))
                fillRectangle(alignPatPos[i] - 2, alignPatPos[j] - 2, 5, 5, qrcode);
        }
    }

    // Fill version blocks
    if (version >= 7) {
        fillRectangle(QRSIZE - 11, 0, 3, 6, qrcode);
        fillRectangle(0, QRSIZE - 11, 6, 3, qrcode);
    }
}

// Draws white function modules and possibly some black modules onto the given QR Code, without
// changing non-function modules. This does not draw the format bits. This requires all function
// modules to be previously marked black (namely by initializeFunctionModules()), because this may
// skip redrawing black function modules.
static void drawWhiteFunctionModules(void) {
    // Draw horizontal and vertical timing patterns
    int i;
    for (i = 7; i < QRSIZE - 7; i += 2) {
        setModuleStatic(QRCODE, 6, i, false);
        setModuleStatic(QRCODE, i, 6, false);
    }

    // Draw 3 finder patterns (all corners except bottom right; overwrites some timing modules)
    for (int dy = -4; dy <= 4; dy++) {
        for (int dx = -4; dx <= 4; dx++) {
            int dist = int_abs(dx);
            if (int_abs(dy) > dist) dist = int_abs(dy);
            if (dist == 2 || dist == 4) {
                setModuleBounded(QRCODE, 3 + dx, 3 + dy, false);
                setModuleBounded(QRCODE, QRSIZE - 4 + dx, 3 + dy, false);
                setModuleBounded(QRCODE, 3 + dx, QRSIZE - 4 + dy, false);
            }
        }
    }

    // Draw numerous alignment patterns
    uint8_t alignPatPos[7];
    int numAlign = getAlignmentPatternPositions(alignPatPos);
    for (i = 0; i < numAlign; i++) {
        for (int j = 0; j < numAlign; j++) {
            if ((i == 0 && j == 0) || (i == 0 && j == numAlign - 1) ||
                (i == numAlign - 1 && j == 0))
                continue; // Don't draw on the three finder corners
            for (int dy = -1; dy <= 1; dy++) {
                for (int dx = -1; dx <= 1; dx++)
                    setModuleStatic(QRCODE, alignPatPos[i] + dx, alignPatPos[j] + dy,
                                    dx == 0 && dy == 0);
            }
        }
    }

    // Draw version blocks
    if (QRVERSION >= 7) {
        // Calculate error correction code and pack bits
        int rem = QRVERSION; // version is uint6, in the range [7, 40]
        for (i = 0; i < 12; i++)
            rem = (rem << 1) ^ ((rem >> 11) * 0x1F25);
        long bits = (long)QRVERSION << 12 | rem; // uint18
        assert(bits >> 18 == 0);

        // Draw two copies
        for (i = 0; i < 6; i++) {
            for (int j = 0; j < 3; j++) {
                int k = QRSIZE - 11 + j;
                setModuleStatic(QRCODE, k, i, (bits & 1) != 0);
                setModuleStatic(QRCODE, i, k, (bits & 1) != 0);
                bits >>= 1;
            }
        }
    }
}

static void drawFormatBitsCopy0(uint16_t bits) {

    uint8_t b = bits & 0xFF;
    setModuleStatic(QRCODE, 8, 0, b & 1);
    b >>= 1;
    setModuleStatic(QRCODE, 8, 1, b & 1);
    b >>= 1;
    setModuleStatic(QRCODE, 8, 2, b & 1);
    b >>= 1;
    setModuleStatic(QRCODE, 8, 3, b & 1);
    b >>= 1;
    setModuleStatic(QRCODE, 8, 4, b & 1);
    b >>= 1;
    setModuleStatic(QRCODE, 8, 5, b & 1);
    b >>= 1;

    setModuleStatic(QRCODE, 8, 7, b & 1);
    b >>= 1;
    setModuleStatic(QRCODE, 8, 8, b & 1);

    b = bits >> 8;
    setModuleStatic(QRCODE, 7, 8, b & 1);
    b >>= 1;

    setModuleStatic(QRCODE, 14 - 9, 8, b & 1);
    b >>= 1;
    setModuleStatic(QRCODE, 14 - 10, 8, b & 1);
    b >>= 1;
    setModuleStatic(QRCODE, 14 - 11, 8, b & 1);
    b >>= 1;
    setModuleStatic(QRCODE, 14 - 12, 8, b & 1);
    b >>= 1;
    setModuleStatic(QRCODE, 14 - 13, 8, b & 1);
    b >>= 1;
    setModuleStatic(QRCODE, 0, 8, b & 1);
}

static void drawFormatBitsCopy1(uint16_t bits) {

    uint8_t b = bits & 0xFF;
    uint8_t i;
    for (i = 0; i < 8; i++) {
        setModuleStatic(QRCODE, QRSIZE - 1 - i, 8, b & 1);
        b >>= 1;
    }
    b = bits >> 8;
    for (i = 8; i < 15; i++) {
        setModuleStatic(QRCODE, 8, QRSIZE - 15 + i, b & 1);
        b >>= 1;
    }
    setModuleStatic(QRCODE, 8, QRSIZE - 8, true); // Always black
}
static void drawFormatBits(void) {

    int data = 1 << 3 | (int)MASK; // low ECC format bits plus mask
    int rem = data;
    for (uint8_t i = 0; i < 10; i++)
        rem = (rem << 1) ^ ((rem >> 9) * 0x537);
    uint16_t bits = (data << 10 | rem) ^ 0x5412; // uint15

    drawFormatBitsCopy0(bits);
    drawFormatBitsCopy1(bits);
}

/*---- Drawing data modules and masking ----*/
static uint16_t dc_i;
static const uint8_t data_bitmasks[8] = {0x80u, 0x40u, 0x20u, 0x10u, 0x08u, 0x04u, 0x02u, 0x01u};

static void drawCodewordsLR(uint8_t x) {
    uint8_t y = 0;
    const uint8_t *data = TMPBUFFER + (dc_i >> 3u);
    uint8_t data_mask = data_bitmasks[dc_i & 7u];
    uint8_t *right = QRCODE + (x >> 3u);
    uint8_t *left = QRCODE + ((x - 1u) >> 3u);
    const uint8_t right_mask = qr_bitmask[x];
    const uint8_t left_mask = qr_bitmask[x - 1u];

    while (y < QRSIZE) {
        if (!(*right & right_mask)) {
            if (*data & data_mask) *right |= right_mask;
            ++dc_i;
            data_mask >>= 1u;
            if (data_mask == 0u) {
                data_mask = 0x80u;
                ++data;
            }
        }
        if (!(*left & left_mask)) {
            if (*data & data_mask) *left |= left_mask;
            ++dc_i;
            data_mask >>= 1u;
            if (data_mask == 0u) {
                data_mask = 0x80u;
                ++data;
            }
        }
        ++y;
        right += QR_OUTPUT_ROW_SZ_BYTES;
        left += QR_OUTPUT_ROW_SZ_BYTES;
    }
}

static void drawCodewordsRL(uint8_t x) {
    uint8_t y = QRSIZE - 1u;
    const uint8_t *data = TMPBUFFER + (dc_i >> 3u);
    uint8_t data_mask = data_bitmasks[dc_i & 7u];
    uint8_t *right = QRCODE + (uint16_t)y * QR_OUTPUT_ROW_SZ_BYTES + (x >> 3u);
    uint8_t *left = QRCODE + (uint16_t)y * QR_OUTPUT_ROW_SZ_BYTES + ((x - 1u) >> 3u);
    const uint8_t right_mask = qr_bitmask[x];
    const uint8_t left_mask = qr_bitmask[x - 1u];

    while (1) {
        if (!(*right & right_mask)) {
            if (*data & data_mask) *right |= right_mask;
            ++dc_i;
            data_mask >>= 1u;
            if (data_mask == 0u) {
                data_mask = 0x80u;
                ++data;
            }
        }
        if (!(*left & left_mask)) {
            if (*data & data_mask) *left |= left_mask;
            ++dc_i;
            data_mask >>= 1u;
            if (data_mask == 0u) {
                data_mask = 0x80u;
                ++data;
            }
        }
        if (y == 0u) return;
        --y;
        right -= QR_OUTPUT_ROW_SZ_BYTES;
        left -= QR_OUTPUT_ROW_SZ_BYTES;
    }
}

static void drawCodewords(void) {

    dc_i = 0;

    uint8_t x = QRSIZE - 1;

    drawCodewordsRL(x);
    x -= 2;

    while (x > 7) {

        drawCodewordsLR(x);
        x -= 2;
        drawCodewordsRL(x);
        x -= 2;
    }
    x = 5;

    drawCodewordsLR(x);
    x -= 2;

    drawCodewordsRL(x);
    x -= 2;

    drawCodewordsLR(x);
}

static void applyMask0(void) {
    uint8_t invert;
    for (uint8_t y = 0; y < QRSIZE; y++) {
        invert = ((y & 1) ? 0xAA : ~0xAA);
        for (uint8_t x = 0; x < QRSIZE; x += 8) {
            uint8_t tmp = invert & ~getModule8(TMPBUFFER, x, y);

            setModule8(QRCODE, x, y, getModule8(QRCODE, x, y) ^ tmp);
        }
    }
}

/*---- Segment handling ----*/

INLINE int numCharCountBits(void) {
    return CHAR_COUNT_BITS;
}

static uint8_t alphaValue(char c) {
    if (c >= '0' && c <= '9') return (uint8_t)(c - '0');
    if (c >= 'A' && c <= 'Z') return (uint8_t)(c - 'A' + 10);
    switch (c) {
    case '$':
        return 37u;
    case '%':
        return 38u;
    case '*':
        return 39u;
    case '+':
        return 40u;
    case '-':
        return 41u;
    case '.':
        return 42u;
    case '/':
        return 43u;
    default:
        return 44u; /* ':'; base44 input is validated by construction */
    }
}

////////////////////////////////////////////////////////////////////////
//

// Appends the given number of low-order bits of the given value to the given byte-based
// bit buffer, increasing the bit length. Requires 0 <= numBits <= 16 and val < 2^numBits.
INLINE void appendBitsToBuffer(unsigned int val, int numBits, uint8_t buffer[], int *bitLen) {
    assert(0 <= numBits && numBits <= 16 && (unsigned long)val >> numBits == 0);
    for (int i = numBits - 1; i >= 0; i--, (*bitLen)++)
        buffer[*bitLen >> 3] |= ((val >> i) & 1) << (7 - (*bitLen & 7));
}

/*---- Low-level QR Code encoding functions ----*/

////////////////////////////////////////////////////////////////////////
//

// uint8_t *qrcodegen(const char *text) {
void qrcodegen(const char *text, uint16_t len) {
    int dataCapacityBits = getNumDataCodewords() * 8;
    int terminatorBits;

    // uint8_t len = 0;
    // while (text[len]!=0) len++;

    // Concatenate all segments to create the data bit string
    memset(QRCODE, 0, (size_t)qrcodegen_BUFFER_SZ * sizeof(QRCODE[0]));
    int bitLen = 0;
    appendBitsToBuffer((unsigned int)MODE, 4, QRCODE, &bitLen);
    appendBitsToBuffer((unsigned int)len, numCharCountBits(), QRCODE, &bitLen);
    {
        uint16_t j = 0u;
        while ((uint16_t)(j + 1u) < len) {
            appendBitsToBuffer((unsigned int)(alphaValue(text[j]) * 45u + alphaValue(text[j + 1u])),
                               11, QRCODE, &bitLen);
            j = (uint16_t)(j + 2u);
        }
        if (j < len) appendBitsToBuffer(alphaValue(text[j]), 6, QRCODE, &bitLen);
    }

    // Add as much of the four-bit terminator as fits. A full 468-character
    // QR11-L payload leaves exactly three bits, which is valid per ISO/IEC
    // 18004 and must not spill into a codeword the symbol does not carry.
    terminatorBits = dataCapacityBits - bitLen;
    if (terminatorBits > 4) terminatorBits = 4;
    if (terminatorBits > 0) appendBitsToBuffer(0, terminatorBits, QRCODE, &bitLen);
    while ((bitLen & 7) != 0)
        appendBitsToBuffer(0, 1, QRCODE, &bitLen);

    // Pad with alternating bytes until data capacity is reached
    for (uint8_t padByte = 0xEC; bitLen < dataCapacityBits; padByte ^= 0xEC ^ 0x11)
        appendBitsToBuffer(padByte, 8, QRCODE, &bitLen);

    // Draw function and data codeword modules
    // debugBorder(BWhite);
    addEccAndInterleave(QRCODE, TMPBUFFER);
    // debugBorder(BLightBlue);
    initializeFunctionModules(QRVERSION, QRCODE);
    // debugBorder(BLightGreen); //***
    drawCodewords();
    // debugBorder(BLightRed);
    drawWhiteFunctionModules();
    // debugBorder(BLightYellow);
    initializeFunctionModules(QRVERSION, TMPBUFFER);
    // debugBorder(BDarkRed);
    applyMask0();
    // debugBorder(BDarkYellow);
    drawFormatBits();
    // debugBorder(BBlack);
}
