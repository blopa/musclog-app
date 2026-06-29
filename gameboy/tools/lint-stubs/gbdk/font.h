/* Clang-compatible stub for <gbdk/font.h>. */
#ifndef _LINT_GBDK_FONT_H
#define _LINT_GBDK_FONT_H

#include <stdint.h>

typedef uint16_t font_t;

extern uint8_t font_spect[];
extern uint8_t font_italic[];
extern uint8_t font_ibm[];
extern uint8_t font_min[];
extern uint8_t font_ibm_fixed[];

void   font_init(void);
font_t font_load(void *font);
font_t font_set(font_t font_handle);
void   font_color(uint8_t forecolor, uint8_t backcolor);

#endif /* _LINT_GBDK_FONT_H */
