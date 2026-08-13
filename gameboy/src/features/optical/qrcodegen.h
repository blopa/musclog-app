#ifndef MUSCLOG_QRCODEGEN_H
#define MUSCLOG_QRCODEGEN_H

#include <stdbool.h>
#include <stdint.h>

/* Fixed QR version 9-L, alphanumeric mode, mask 0. The 53x53 symbol is shown
 * at two Game Boy pixels per module with a >=4-module quiet zone. */
#define QRVERSION 9
#define QRSIZE 53u
#define QR_MAX_ALPHANUMERIC_CHARS 335u
#define QR_OUTPUT_ROW_SZ_BYTES 7u

/* Buffers live after the custom-food store in SRAM bank 3, not in scarce WRAM. */
#define QR_SRAM_BANK 3u
#define QR_SRAM_CODE_OFFSET 0x0B00u
#define QR_SRAM_TMP_OFFSET 0x0C80u

void qrcodegen(const char *text, uint16_t len);
bool qr_get(uint8_t x, uint8_t y);

#endif /* MUSCLOG_QRCODEGEN_H */
