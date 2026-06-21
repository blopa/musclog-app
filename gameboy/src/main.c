/*
 * Musclog GB — boot splash.
 *
 * Loads the Musclog logo (generated from assets/icon-pixel.png by the build) and
 * shows it centered on a Game Boy Color screen, then idles. This is Milestone 1 of
 * gameboy/PLAN.md, reduced to just the boot screen.
 */
#include <gbdk/platform.h>
#include <gb/gb.h>

#include "logo.h"

/* The visible background is 20x18 tiles; center the 8x8-tile logo within it. */
#define SCREEN_TILE_W 20
#define SCREEN_TILE_H 18
#define ORIGIN_X ((SCREEN_TILE_W - logo_TILE_W) / 2) /* (20 - 8) / 2 = 6 */
#define ORIGIN_Y ((SCREEN_TILE_H - logo_TILE_H) / 2) /* (18 - 8) / 2 = 5 */

/* The app's dark-green surface color (theme token `green800` = #0d4a2d, "Deep green
 * surface"). The literal page background (swampGreen #091310) is so dark it reads as
 * pitch black on the Game Boy Color, so we use this clearly-green surface tone instead.
 * Loaded as CGB background palette 1; only color 0 is used (blank fill tile is all index 0). */
#define BG_PALETTE 1
static const palette_color_t bg_palette[4] = {
    RGB8(0x0d, 0x4a, 0x2d),
    RGB8(0x0d, 0x4a, 0x2d),
    RGB8(0x0d, 0x4a, 0x2d),
    RGB8(0x0d, 0x4a, 0x2d),
};

/* A solid tile of color index 0, filled around the logo. In the 2bpp tile format
 * index 0 = both bitplanes clear, so every byte is 0x00. Loaded past the logo tiles;
 * paired with BG_PALETTE so it shows the app background color. */
#define BLANK_TILE logo_TILE_COUNT
static const uint8_t blank_tile[16] = { 0 };

void main(void) {
    DISPLAY_OFF;

    /* Palette 0 = logo colors; palette 1 = the app background color. */
    set_bkg_palette(0, logo_PALETTE_COUNT, logo_palettes);
    set_bkg_palette(BG_PALETTE, 1, bg_palette);
    set_bkg_data(0, logo_TILE_COUNT, logo_tiles);
    set_bkg_data(BLANK_TILE, 1, blank_tile);

    /* Clear the whole background to the blank tile on the app-background palette before
     * drawing the logo, so the area around it is the app's dark-green page color.
     * The attribute map lives in VRAM bank 1, the tile indices in bank 0. */
    VBK_REG = 1;
    init_bkg(BG_PALETTE); /* every tile -> app background palette */
    VBK_REG = 0;
    init_bkg(BLANK_TILE);

    VBK_REG = 1;
    set_bkg_tiles(ORIGIN_X, ORIGIN_Y, logo_TILE_W, logo_TILE_H, logo_map_attributes);
    VBK_REG = 0;
    set_bkg_tiles(ORIGIN_X, ORIGIN_Y, logo_TILE_W, logo_TILE_H, logo_map);

    SHOW_BKG;
    DISPLAY_ON;

    while (1) {
        wait_vbl_done();
    }
}
