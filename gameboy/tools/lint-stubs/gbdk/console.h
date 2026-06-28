/* Clang-compatible stub for <gbdk/console.h>. */
#ifndef _LINT_GBDK_CONSOLE_H
#define _LINT_GBDK_CONSOLE_H

#include <stdint.h>

void    gotoxy(uint8_t x, uint8_t y);
uint8_t posx(void);
uint8_t posy(void);
void    setchar(char c);
void    cls(void);

#endif /* _LINT_GBDK_CONSOLE_H */
