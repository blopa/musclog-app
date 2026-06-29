/* Minimal stub for <string.h> — only the functions used in gameboy/src. */
#ifndef _LINT_STRING_H
#define _LINT_STRING_H

#include <stddef.h>

void  *memcpy(void *dst, const void *src, size_t n);
void  *memset(void *dst, int c, size_t n);
void  *memmove(void *dst, const void *src, size_t n);
char  *strcpy(char *dst, const char *src);
char  *strncpy(char *dst, const char *src, size_t n);
int    strcmp(const char *a, const char *b);
int    strncmp(const char *a, const char *b, size_t n);
size_t strlen(const char *s);
size_t strnlen(const char *s, size_t maxlen);

#endif /* _LINT_STRING_H */
