#ifndef MUSCLOG_LIST_CURSOR_H
#define MUSCLOG_LIST_CURSOR_H

#include <stdint.h>

/*
 * A scrolling-list cursor shared by every "pick a row from a longer list than
 * fits on screen" screen (workout history, exercise picker, food log, food
 * search results). `focused` is the highlighted row inside the visible window;
 * `scroll` is the index of the first visible row. The absolute selected index
 * is `scroll + focused`.
 *
 * The window-vs-scroll arithmetic used to be hand-copied into each screen's
 * input loop (and had already drifted); these helpers are its single home.
 * Each `_down`/`_up` returns 1 if the selection actually moved, so callers can
 * set their dirty flag without re-deriving it.
 *
 * Defined `static` in the header (like utils.h) so each translation unit gets
 * its own bank-local copy — no cross-bank trampolines.
 */
typedef struct ListCursor {
    uint8_t scroll;
    uint8_t focused;
} ListCursor;

static void list_cursor_reset(ListCursor *c) {
    c->scroll = 0u;
    c->focused = 0u;
}

static uint8_t list_cursor_index(const ListCursor *c) {
    return (uint8_t)(c->scroll + c->focused);
}

/* Move down one row, scrolling the window when at its bottom edge. */
static uint8_t list_cursor_down(ListCursor *c, uint8_t count, uint8_t visible) {
    if (count == 0u || (uint8_t)(list_cursor_index(c) + 1u) >= count) return 0u;

    if (c->focused < (uint8_t)(visible - 1u)) {
        ++c->focused;
    } else {
        ++c->scroll;
    }
    return 1u;
}

/* Move up one row, scrolling the window when at its top edge. */
static uint8_t list_cursor_up(ListCursor *c) {
    if (c->focused > 0u) {
        --c->focused;
        return 1u;
    }
    if (c->scroll > 0u) {
        --c->scroll;
        return 1u;
    }
    return 0u;
}

/* Pull the cursor back inside [0, count) after the list shrank (e.g. a delete). */
static void list_cursor_clamp(ListCursor *c, uint8_t count) {
    uint8_t target;

    if (count == 0u) {
        list_cursor_reset(c);
        return;
    }
    if (list_cursor_index(c) < count) return;

    target = (uint8_t)(count - 1u);
    if (target < c->scroll) {
        c->scroll = target;
        c->focused = 0u;
    } else {
        c->focused = (uint8_t)(target - c->scroll);
    }
}

#endif /* MUSCLOG_LIST_CURSOR_H */
