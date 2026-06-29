/* Minimal stub for <stdio.h> — only the functions used in gameboy/src. */
#ifndef _LINT_STDIO_H
#define _LINT_STDIO_H

int sprintf(char *buf, const char *fmt, ...);
int snprintf(char *buf, unsigned long n, const char *fmt, ...);
int puts(const char *s);
int printf(const char *fmt, ...);

#endif /* _LINT_STDIO_H */
