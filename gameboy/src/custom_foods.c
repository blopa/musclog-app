#pragma bank 4

#include "custom_foods.h"

#include <gb/gb.h>
#include <stdio.h>
#include <string.h>

#include "copies.h"
#include "input.h"
#include "list_cursor.h"
#include "spinner.h"
#include "sram.h"
#include "ui_text.h"

/* ── Bank-3 layout constants ──────────────────────────────────────────────── */
#define CF_BANK            3u
#define CF_MAGIC           0x4346u  /* 'CF' */
#define CF_VERSION         1u

#define CF_OFF_MAGIC       0x00u
#define CF_OFF_VERSION     0x02u
#define CF_OFF_CHECKSUM    0x04u
#define CF_ENTRIES_OFFSET  0x08u

#define CF_NAME_BYTES      16u
#define CF_ENTRY_SIZE      26u   /* name[16] + 5 x uint16 */
#define CF_ENTRIES_BYTES   ((uint16_t)(MAX_CUSTOM_FOODS * CF_ENTRY_SIZE))

/* Macro offsets within a slot. */
#define CF_OFF_KCAL        16u
#define CF_OFF_PROTEIN     18u
#define CF_OFF_FAT         20u
#define CF_OFF_CARBS       22u
#define CF_OFF_FIBER       24u

/* ── Raw SRAM bank-3 access (caller must have ENABLE_RAM + SWITCH_RAM(CF_BANK)) ─ */

static uint16_t cf_entry_off(uint8_t slot) {
    return (uint16_t)(CF_ENTRIES_OFFSET + (uint16_t)slot * CF_ENTRY_SIZE);
}

static uint8_t cf_slot_empty(uint8_t slot) {
    return (uint8_t)(_SRAM[cf_entry_off(slot)] == 0u);
}

/* Rolling hash over the whole fixed entries region (mirrors fl_checksum). */
static uint16_t cf_checksum(void) {
    return sram_hash(0xA55Au, _SRAM, CF_ENTRIES_OFFSET, CF_ENTRIES_BYTES);
}

static void cf_finalize(void) {
    sram_wr16(_SRAM, CF_OFF_MAGIC, CF_MAGIC);
    _SRAM[CF_OFF_VERSION] = CF_VERSION;
    sram_wr16(_SRAM, CF_OFF_CHECKSUM, cf_checksum());
}

static uint8_t cf_header_ok(void) {
    return (uint8_t)(sram_rd16(_SRAM, CF_OFF_MAGIC) == CF_MAGIC &&
                     _SRAM[CF_OFF_VERSION] == CF_VERSION);
}

/* Zero the entries region (all slots empty) and stamp a fresh header. */
static void cf_reset(void) {
    uint16_t i;
    for (i = 0u; i != CF_ENTRIES_BYTES; ++i) {
        _SRAM[CF_ENTRIES_OFFSET + i] = 0u;
    }
    cf_finalize();
}

static void cf_read_entry(uint8_t slot, FoodCache *out) {
    uint16_t off = cf_entry_off(slot);
    uint8_t  i;

    for (i = 0u; i != CF_NAME_BYTES && _SRAM[off + i] != 0u; ++i) {
        out->name[i] = (char)_SRAM[off + i];
    }
    out->name[i]    = '\0';
    out->kcal       = sram_rd16(_SRAM, (uint16_t)(off + CF_OFF_KCAL));
    out->protein_dg = sram_rd16(_SRAM, (uint16_t)(off + CF_OFF_PROTEIN));
    out->fat_dg     = sram_rd16(_SRAM, (uint16_t)(off + CF_OFF_FAT));
    out->carbs_dg   = sram_rd16(_SRAM, (uint16_t)(off + CF_OFF_CARBS));
    out->fiber_dg   = sram_rd16(_SRAM, (uint16_t)(off + CF_OFF_FIBER));
}

static void cf_clear_cache(FoodCache *out) {
    out->name[0]    = '\0';
    out->kcal       = 0u;
    out->protein_dg = 0u;
    out->fat_dg     = 0u;
    out->carbs_dg   = 0u;
    out->fiber_dg   = 0u;
}

static char cf_upper(char c) {
    return (c >= 'a' && c <= 'z') ? (char)(c - 32) : c;
}

static uint8_t cf_name_matches(uint8_t slot, const char *query) {
    uint16_t off = cf_entry_off(slot);
    uint8_t  j;
    char     nc;

    for (j = 0u; query[j] != '\0'; ++j) {
        if (j >= CF_NAME_BYTES) return 0u;
        nc = (char)_SRAM[off + j];
        if (nc == '\0') return 0u;            /* name shorter than query */
        if (cf_upper(nc) != query[j]) return 0u;
    }
    return 1u;
}

/* ── Store API ────────────────────────────────────────────────────────────── */

void custom_foods_init(void) BANKED {
    uint8_t valid;

    ENABLE_RAM;
    SWITCH_RAM(CF_BANK);

    valid = cf_header_ok();
    if (valid) {
        valid = (uint8_t)(sram_rd16(_SRAM, CF_OFF_CHECKSUM) == cf_checksum());
    }
    if (!valid) {
        cf_reset();
    }

    SWITCH_RAM(0u);
    DISABLE_RAM;
}

void custom_foods_erase(void) BANKED {
    ENABLE_RAM;
    SWITCH_RAM(CF_BANK);
    cf_reset();
    SWITCH_RAM(0u);
    DISABLE_RAM;
}

uint8_t custom_foods_add(const char *name, uint16_t kcal, uint16_t protein_dg,
                         uint16_t fat_dg, uint16_t carbs_dg, uint16_t fiber_dg) BANKED {
    uint8_t  slot  = 0u;
    uint8_t  found = 0u;
    uint8_t  done  = 0u;
    uint8_t  i;
    char     c;
    uint16_t off;

    ENABLE_RAM;
    SWITCH_RAM(CF_BANK);

    if (cf_header_ok()) {
        for (slot = 0u; slot != MAX_CUSTOM_FOODS; ++slot) {
            if (cf_slot_empty(slot)) { found = 1u; break; }
        }
    }

    if (found) {
        off = cf_entry_off(slot);
        for (i = 0u; i != CF_NAME_BYTES; ++i) {
            c = done ? '\0' : name[i];
            if (c == '\0') done = 1u;
            _SRAM[off + i] = (uint8_t)c;
        }
        sram_wr16(_SRAM, (uint16_t)(off + CF_OFF_KCAL),    kcal);
        sram_wr16(_SRAM, (uint16_t)(off + CF_OFF_PROTEIN), protein_dg);
        sram_wr16(_SRAM, (uint16_t)(off + CF_OFF_FAT),     fat_dg);
        sram_wr16(_SRAM, (uint16_t)(off + CF_OFF_CARBS),   carbs_dg);
        sram_wr16(_SRAM, (uint16_t)(off + CF_OFF_FIBER),   fiber_dg);
        cf_finalize();
    }

    SWITCH_RAM(0u);
    DISABLE_RAM;
    return found;
}

void custom_foods_load(uint8_t slot, FoodCache *out) BANKED {
    ENABLE_RAM;
    SWITCH_RAM(CF_BANK);

    if (cf_header_ok() && slot < MAX_CUSTOM_FOODS && !cf_slot_empty(slot)) {
        cf_read_entry(slot, out);
    } else {
        cf_clear_cache(out);
    }

    SWITCH_RAM(0u);
    DISABLE_RAM;
}

uint8_t custom_foods_count(void) BANKED {
    uint8_t slot;
    uint8_t n = 0u;

    ENABLE_RAM;
    SWITCH_RAM(CF_BANK);

    if (cf_header_ok()) {
        for (slot = 0u; slot != MAX_CUSTOM_FOODS; ++slot) {
            if (!cf_slot_empty(slot)) ++n;
        }
    }

    SWITCH_RAM(0u);
    DISABLE_RAM;
    return n;
}

uint8_t custom_foods_get(uint8_t nth, uint8_t *slot, FoodCache *out) BANKED {
    uint8_t s;
    uint8_t seen  = 0u;
    uint8_t found = 0u;

    ENABLE_RAM;
    SWITCH_RAM(CF_BANK);

    if (cf_header_ok()) {
        for (s = 0u; s != MAX_CUSTOM_FOODS; ++s) {
            if (cf_slot_empty(s)) continue;
            if (seen == nth) {
                *slot = s;
                cf_read_entry(s, out);
                found = 1u;
                break;
            }
            ++seen;
        }
    }

    SWITCH_RAM(0u);
    DISABLE_RAM;
    return found;
}

void custom_foods_delete(uint8_t slot) BANKED {
    ENABLE_RAM;
    SWITCH_RAM(CF_BANK);

    if (cf_header_ok() && slot < MAX_CUSTOM_FOODS) {
        _SRAM[cf_entry_off(slot)] = 0u;  /* tombstone: name[0] = '\0' */
        cf_finalize();
    }

    SWITCH_RAM(0u);
    DISABLE_RAM;
}

uint8_t custom_foods_filter(const char *query, uint16_t *matches,
                            uint8_t cap, uint8_t count) BANKED {
    uint8_t slot;

    ENABLE_RAM;
    SWITCH_RAM(CF_BANK);

    if (cf_header_ok()) {
        for (slot = 0u; slot != MAX_CUSTOM_FOODS && count != cap; ++slot) {
            if (cf_slot_empty(slot)) continue;
            if (cf_name_matches(slot, query)) {
                matches[count++] = (uint16_t)(CUSTOM_FOOD_BASE + slot);
            }
        }
    }

    SWITCH_RAM(0u);
    DISABLE_RAM;
    return count;
}

/* ── Create screen ────────────────────────────────────────────────────────── */

static const char ALPHABET[] = "ABCDEFGHIJKLMNOPQRSTUVWXYZ ";
#define ALPHABET_LEN 27u

/* Per-100g macro fields, in `vals[]` order. kcal is whole; the rest are whole grams. */
#define FIELD_COUNT 5u
#define FIELD_KCAL  0u
#define FIELD_CARB  1u
#define FIELD_FIB   2u
#define FIELD_FAT   3u
#define FIELD_PRO   4u

static const char *const FIELD_LABEL[FIELD_COUNT] = {
    STR_CAL_100, STR_CARB_100, STR_FIB_100, STR_FAT_100, STR_PRO_100,
};
static const uint16_t FIELD_SMALL[FIELD_COUNT] = { 10u, 1u, 1u, 1u, 1u };
static const uint16_t FIELD_LARGE[FIELD_COUNT] = { 50u, 10u, 10u, 10u, 10u };
static const uint16_t FIELD_MAX[FIELD_COUNT]   = { 950u, 100u, 100u, 100u, 100u };
static const uint8_t  FIELD_ROW[FIELD_COUNT]   = { 4u, 6u, 8u, 10u, 12u };

/* On-screen A-Z + space name picker. Returns 1 and fills `out` if confirmed
 * (>= 1 char), 0 if the user cancelled (B with an empty name). */
static uint8_t name_entry(char *out) {
    InputState input;
    char       name[CUSTOM_NAME_MAX + 1u];
    char       line[CUSTOM_NAME_MAX + 1u];
    char       slot[2];
    uint8_t    len   = 0u;
    uint8_t    spin  = 0u;
    uint8_t    dirty = 1u;
    uint8_t    i;

    name[0] = '\0';
    input_init(&input);

    while (1) {
        if (dirty) {
            ui_clear();
            ui_fill_attr(0u, 0u, 20u, 1u, UI_PAL_HEADER);
            ui_print_center(0u, STR_NEW_FOOD);
            ui_print_at(0u, 2u, STR_NAME_LABEL);

            for (i = 0u; i != len; ++i) line[i] = name[i];
            line[len] = '\0';
            ui_fill_attr(0u, 3u, 20u, 1u, UI_PAL_PANEL);
            ui_print_at(0u, 3u, line);

            slot[0] = ALPHABET[spin];
            slot[1] = '\0';
            ui_fill_attr(len, 3u, 1u, 1u, UI_PAL_SELECTED);
            ui_print_at(len, 3u, slot);

            ui_print_center(5u, STR_HINT_TYPING);
            ui_footer(STR_FOOTER_DEL, STR_FOOTER_DONE);
            dirty = 0u;
        }

        wait_vbl_done();
        ui_input_update(&input);

        if (input_pressed(&input, J_UP)) {
            spin = (spin == 0u) ? (uint8_t)(ALPHABET_LEN - 1u) : (uint8_t)(spin - 1u);
            dirty = 1u;
        }
        if (input_pressed(&input, J_DOWN)) {
            spin = (uint8_t)((spin + 1u) % ALPHABET_LEN);
            dirty = 1u;
        }
        if (input_pressed(&input, J_A) && len < CUSTOM_NAME_MAX) {
            name[len++] = ALPHABET[spin];
            name[len] = '\0';
            dirty = 1u;
        }
        if (input_pressed(&input, J_B)) {
            if (len == 0u) return 0u;
            name[--len] = '\0';
            dirty = 1u;
        }
        if (input_pressed(&input, J_START) && len > 0u) {
            for (i = 0u; i != (uint8_t)(len + 1u); ++i) out[i] = name[i];
            return 1u;
        }
    }
}

static void draw_macro_fields(const char *name, const uint16_t *vals, uint8_t field) {
    char    buf[22];
    uint8_t i, row;

    ui_clear();
    ui_fill_attr(0u, 0u, 20u, 1u, UI_PAL_HEADER);
    ui_print_center(0u, STR_NEW_FOOD);
    ui_fill_attr(0u, 1u, 20u, 1u, UI_PAL_PANEL);
    ui_print_center(1u, name);
    ui_print_at(0u, 2u, STR_DIVIDER);

    for (i = 0u; i != FIELD_COUNT; ++i) {
        row = FIELD_ROW[i];
        if (i == field) ui_fill_attr(0u, row, 20u, 1u, UI_PAL_SELECTED);
        ui_print_at(0u, row, FIELD_LABEL[i]);
        if (i == FIELD_KCAL) sprintf(buf, "%u KCAL", (unsigned int)vals[i]);
        else                 sprintf(buf, "%u G",    (unsigned int)vals[i]);
        ui_print_at((uint8_t)(19u - (uint8_t)strlen(buf)), row, buf);
    }

    ui_print_center(14u, STR_HINT_MACRO);
    ui_footer(STR_FOOTER_BACK, STR_FOOTER_SAVE_ST);
}

void custom_food_create(SaveData *data) BANKED {
    InputState input;
    char       name[CUSTOM_NAME_MAX + 1u];
    uint16_t   vals[FIELD_COUNT];
    uint16_t   nv;
    uint8_t    field = 0u;
    uint8_t    dirty = 1u;
    uint8_t    full;
    uint8_t    i;

    (void)data;  /* macros are per-100g grams/kcal — unit-system independent */

    if (!name_entry(name)) return;

    for (i = 0u; i != FIELD_COUNT; ++i) vals[i] = 0u;

    input_init(&input);
    while (1) {
        if (dirty) {
            draw_macro_fields(name, vals, field);
            dirty = 0u;
        }

        wait_vbl_done();
        ui_input_update(&input);

        if (input_pressed(&input, J_B)) return;

        if (input_pressed(&input, J_A)) {
            field = (uint8_t)((field + 1u) % FIELD_COUNT);
            dirty = 1u;
        }

        nv = spinner_u16(&input, vals[field], FIELD_SMALL[field], FIELD_LARGE[field],
                         0u, FIELD_MAX[field]);
        if (nv != vals[field]) {
            vals[field] = nv;
            dirty = 1u;
        }

        if (input_pressed(&input, J_START)) break;
    }

    /* The loop only falls through here on J_START (J_B returns early). */
    full = (uint8_t)(custom_foods_add(name, vals[FIELD_KCAL],
                                      (uint16_t)(vals[FIELD_PRO]  * 10u),
                                      (uint16_t)(vals[FIELD_FAT]  * 10u),
                                      (uint16_t)(vals[FIELD_CARB] * 10u),
                                      (uint16_t)(vals[FIELD_FIB]  * 10u)) == 0u);
    ui_title(STR_NEW_FOOD);
    ui_print_center(8u, full ? STR_FOODS_FULL : STR_FOOD_SAVED);
    ui_present();
    for (i = 0u; i != 75u; ++i) wait_vbl_done();
}

/* ── Manage / delete screen ───────────────────────────────────────────────── */

#define MANAGE_VISIBLE 6u

static void draw_manage(const ListCursor *cursor, uint8_t count) {
    FoodCache fc;
    char      buf[8];
    char      nm[13];
    uint8_t   i, nth, slot, row, focused, klen, kx, k;

    ui_clear();
    ui_fill_attr(0u, 0u, 20u, 1u, UI_PAL_HEADER);
    ui_print_center(0u, STR_MY_FOODS);
    ui_print_at(0u, 2u, STR_DIVIDER);

    if (count == 0u) {
        ui_print_center(8u, STR_NO_CUSTOM);
        ui_footer(STR_FOOTER_BACK, "");
        return;
    }

    for (i = 0u; i != MANAGE_VISIBLE; ++i) {
        nth = (uint8_t)(cursor->scroll + i);
        if (nth >= count) break;
        if (!custom_foods_get(nth, &slot, &fc)) break;

        row     = (uint8_t)(4u + i);
        focused = (uint8_t)(i == cursor->focused);
        if (focused) ui_fill_attr(0u, row, 20u, 1u, UI_PAL_PANEL);
        ui_print_at(0u, row, focused ? ">" : " ");

        for (k = 0u; k != 12u && fc.name[k] != '\0'; ++k) nm[k] = fc.name[k];
        nm[k] = '\0';
        ui_print_at(2u, row, nm);

        sprintf(buf, "%uK", (unsigned int)fc.kcal);
        klen = (uint8_t)strlen(buf);
        kx   = (klen < 6u) ? (uint8_t)(20u - klen) : 14u;
        ui_print_at(kx, row, buf);
    }

    ui_footer(STR_FOOTER_BACK, STR_FOOTER_SEL_DEL);
}

void custom_foods_manage(SaveData *data) BANKED {
    InputState input;
    ListCursor cursor;
    FoodCache  fc;
    uint8_t    count;
    uint8_t    nth, slot;
    uint8_t    dirty = 1u;

    (void)data;
    list_cursor_reset(&cursor);
    input_init(&input);

    while (1) {
        count = custom_foods_count();
        if (dirty) {
            draw_manage(&cursor, count);
            dirty = 0u;
        }

        wait_vbl_done();
        ui_input_update(&input);

        if (input_pressed(&input, J_B)) return;
        if (count == 0u) continue;

        if (input_pressed(&input, J_SELECT)) {
            nth = list_cursor_index(&cursor);
            if (custom_foods_get(nth, &slot, &fc)) {
                if (ui_confirm(STR_DELETE_FOOD, STR_DELETE_FOOD_Q)) {
                    custom_foods_delete(slot);
                    list_cursor_clamp(&cursor, custom_foods_count());
                }
            }
            dirty = 1u;
            continue;
        }

        if (input_pressed(&input, J_DOWN) && list_cursor_down(&cursor, count, MANAGE_VISIBLE)) {
            dirty = 1u;
        }
        if (input_pressed(&input, J_UP) && list_cursor_up(&cursor)) {
            dirty = 1u;
        }
    }
}
