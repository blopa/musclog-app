#pragma bank 10

#include "optical_share.h"

#include <gb/cgb.h>
#include <gb/gb.h>
#include <gbdk/console.h>
#include <gbdk/platform.h>

#include "copies.h"
#include "fountain.h"
#include "input.h"
#include "optical_export.h"
#include "qrcodegen.h"
#include "ui_text.h"

#define QR_TILE_LEFT 1u
#define QR_TILE_TOP 0u
#define QR_TILE_GRID 18u
#define QR_LOGICAL_SIZE 72u
#define QR_MODULE_OFFSET 5u
#define QR_DWELL_FRAMES 30u

static const palette_color_t qr_palette[4] = {
    RGB8(0xFF, 0xFF, 0xFF),
    RGB8(0xFF, 0xFF, 0xFF),
    RGB8(0x00, 0x00, 0x00),
    RGB8(0x00, 0x00, 0x00),
};

static uint8_t qr_module_at(uint8_t x, uint8_t y) {
    if (x < QR_MODULE_OFFSET || y < QR_MODULE_OFFSET || x >= (uint8_t)(QR_MODULE_OFFSET + QRSIZE) ||
        y >= (uint8_t)(QR_MODULE_OFFSET + QRSIZE)) {
        return 0u;
    }
    return qr_get((uint8_t)(x - QR_MODULE_OFFSET), (uint8_t)(y - QR_MODULE_OFFSET));
}

static void make_qr_tile(uint8_t tile_x, uint8_t tile_y, uint8_t tile[16]) {
    uint8_t module_y;
    uint8_t module_x;
    uint8_t bits;
    uint8_t row;
    for (module_y = 0u; module_y != 4u; ++module_y) {
        bits = 0u;
        for (module_x = 0u; module_x != 4u; ++module_x) {
            if (qr_module_at((uint8_t)(tile_x * 4u + module_x),
                             (uint8_t)(tile_y * 4u + module_y))) {
                bits |= (uint8_t)(0xC0u >> (module_x * 2u));
            }
        }
        row = (uint8_t)(module_y * 4u);
        tile[row] = bits;
        tile[row + 1u] = bits;
        tile[row + 2u] = bits;
        tile[row + 3u] = bits;
    }
}

static void upload_qr(void) {
    uint8_t tile[16];
    uint8_t *vram;
    uint8_t map[20];
    uint8_t attr[20];
    uint8_t x;
    uint8_t y;
    uint8_t byte;
    uint8_t tile_id;
    uint8_t tile_bank;
    uint16_t tile_number = 0u;

    DISPLAY_OFF;
    /* The console font uses signed background tile addressing (0x8800). QR
     * frames upload tiles starting at 0x8000 in both VRAM banks, so select the
     * unsigned tile-data region before tile IDs 0-127 are displayed. Without
     * this bit, the upper half of the tile map resolves to font glyphs. */
    LCDC_REG |= LCDCF_BG8000;
    set_bkg_palette(0u, 1u, qr_palette);
    for (x = 0u; x != 20u; ++x) {
        map[x] = 0u;
        attr[x] = 0u;
    }
    VBK_REG = 0u;
    for (y = 0u; y != 18u; ++y)
        set_bkg_tiles(0u, y, 20u, 1u, map);
    VBK_REG = 1u;
    for (y = 0u; y != 18u; ++y)
        set_bkg_tiles(0u, y, 20u, 1u, attr);
    VBK_REG = 0u;

    for (y = 0u; y != QR_TILE_GRID; ++y) {
        for (x = 0u; x != QR_TILE_GRID; ++x) {
            make_qr_tile(x, y, tile);
            tile_bank = (uint8_t)(tile_number >= 256u);
            tile_id = (uint8_t)tile_number;
            /* LCD is off, so a direct VRAM copy avoids pulling another generic
             * tile-upload helper into the full fixed ROM bank. Version 11 needs
             * 324 tiles, so the final 68 live in CGB VRAM bank 1. */
            VBK_REG = tile_bank;
            vram = (uint8_t *)0x8000u + (uint16_t)tile_id * 16u;
            for (byte = 0u; byte != 16u; ++byte)
                vram[byte] = tile[byte];
            map[x] = tile_id;
            attr[x] = tile_bank ? S_BANK : 0u;
            ++tile_number;
        }
        VBK_REG = 0u;
        set_bkg_tiles(QR_TILE_LEFT, (uint8_t)(QR_TILE_TOP + y), QR_TILE_GRID, 1u, map);
        VBK_REG = 1u;
        set_bkg_tiles(QR_TILE_LEFT, (uint8_t)(QR_TILE_TOP + y), QR_TILE_GRID, 1u, attr);
    }
    VBK_REG = 0u;
    SHOW_BKG;
    DISPLAY_ON;
}

static uint8_t confirm_stop_sharing(void) {
    static const char *options[] = {STR_CONTINUE, STR_STOP_SHARING};
    ui_init_text();
    return (uint8_t)(ui_menu_select(STR_SHARE_DATA, options, 2u) == 1u);
}

/*
 * Stream a prepared payload as QR frames until the user stops.
 *
 * Shared by both share actions rather than copied: the frame loop owns the CPU speed switch, the
 * SRAM bank dance around the encoder, and the VRAM restore on the way out — three things that must
 * not drift between "share everything" and "share this day".
 */
static void share_stream(const SaveData *data, uint8_t day_share, uint16_t day_num,
                         const char *title) {
    OpticalExportInfo info;
    InputState input;
    uint32_t next_seq = 0ul;
    uint8_t frame;
    uint8_t stop = 0u;
    uint8_t prepared;
    const char *text;

    cpu_fast();

    ui_title(title);
    ui_print_center(7u, day_share ? STR_SHARE_PREPARING_DAY : STR_SHARE_PREPARING);
    ui_print_center(9u, STR_SHARE_KEEP_POWER);
    ui_footer(STR_FOOTER_CANCEL, "");

    prepared = day_share ? optical_export_prepare_day(data, day_num, &info)
                         : optical_export_prepare(data, &info);
    if (!prepared) {
        cpu_slow();
        ui_title(title);
        ui_print_center(8u, STR_SHARE_FAILED);
        ui_footer(STR_FOOTER_BACK, "");
        input_init(&input);
        do {
            wait_vbl_done();
            ui_input_update(&input);
        } while (!input_pressed(&input, J_B | J_A | J_START));
        return;
    }

    fountain_prepare(info.block_count);
    input_init(&input);
    while (!stop) {
        fountain_build_next(&info, &next_seq);
        ENABLE_RAM;
        SWITCH_RAM(QR_SRAM_BANK);
        text = (const char *)_SRAM + OPTICAL_SRAM_TEXT_OFFSET;
        qrcodegen(text, OPTICAL_FRAME_TEXT_LEN);
        upload_qr();
        SWITCH_RAM(0u);
        DISABLE_RAM;

        for (frame = 0u; frame != QR_DWELL_FRAMES; ++frame) {
            wait_vbl_done();
            ui_input_update(&input);
            if (input_pressed(&input, J_B)) {
                stop = confirm_stop_sharing();
                if (!stop) {
                    ENABLE_RAM;
                    SWITCH_RAM(QR_SRAM_BANK);
                    upload_qr();
                    SWITCH_RAM(0u);
                    DISABLE_RAM;
                    input_init(&input);
                }
                break;
            }
        }
    }

    cpu_slow();
    /* QR frames replace both background tile banks. Restore the font, palettes,
     * tilemap, and UI shadow before returning to the menu. */
    ui_init_text();
}

void optical_share_show(const SaveData *data) BANKED {
    if (!ui_confirm(STR_SHARE_DATA, STR_SHARE_ALL_Q)) return;
    share_stream(data, 0u, 0u, STR_SHARE_DATA);
}

void optical_share_show_day(const SaveData *data, uint16_t day_num) BANKED {
    if (!ui_confirm(STR_SHARE_DAY, STR_SHARE_DAY_Q)) return;
    share_stream(data, 1u, day_num, STR_SHARE_DAY);
}
