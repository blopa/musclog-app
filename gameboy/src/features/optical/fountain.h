#ifndef MUSCLOG_OPTICAL_FOUNTAIN_H
#define MUSCLOG_OPTICAL_FOUNTAIN_H

#include <gb/gb.h>
#include <stdint.h>

#include "optical_export.h"

#define OPTICAL_FRAME_HEADER_LEN 20u
#define OPTICAL_FRAME_LEN (OPTICAL_FRAME_HEADER_LEN + OPTICAL_FOUNTAIN_BLOCK_LEN)
#define OPTICAL_FRAME_TEXT_LEN 468u
#define OPTICAL_SRAM_FRAME_OFFSET 0x0F00u
#define OPTICAL_SRAM_TEXT_OFFSET 0x1040u

/* Build the next exact frozen-protocol frame and base44 text. Unsupported
 * high-degree/float-boundary sequences are omitted; sequence gaps are legal. */
void fountain_prepare(uint16_t block_count) BANKED;
void fountain_build_next(const OpticalExportInfo *info, uint32_t *next_seq) BANKED;

#endif /* MUSCLOG_OPTICAL_FOUNTAIN_H */
