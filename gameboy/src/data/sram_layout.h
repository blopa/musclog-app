#ifndef MUSCLOG_SRAM_LAYOUT_H
#define MUSCLOG_SRAM_LAYOUT_H

/*
 * Shared SRAM bank-0 subregions.
 *
 * Keep every bank-0 owner on these constants instead of copying raw offsets into
 * feature modules. The profile save block grows upward from 0x00, metrics starts
 * at 0x40, and the gap in between is reserved for small non-checksummed stores.
 */
#define SRAM_LAYOUT_BANK0 0u
#define SRAM_LAYOUT_PROFILE_SAVE_SIZE 0x17u
#define SRAM_LAYOUT_RTC_HOUR 0x17u
#define SRAM_LAYOUT_RTC_MINUTE 0x18u
#define SRAM_LAYOUT_AUDIO_MAGIC 0x38u
#define SRAM_LAYOUT_AUDIO_FLAGS 0x39u
#define SRAM_LAYOUT_PROFILE_GROW_LIMIT SRAM_LAYOUT_AUDIO_MAGIC
#define SRAM_LAYOUT_METRICS_BASE 0x40u

#endif /* MUSCLOG_SRAM_LAYOUT_H */
