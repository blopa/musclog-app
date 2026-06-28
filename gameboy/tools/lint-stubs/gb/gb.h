/* Clang-compatible stub for <gb/gb.h>. Replaces all SDCC/GBDK-specific
 * constructs with plain C that clang can parse, so clang-tidy can analyse
 * the Game Boy source files without SDCC installed. */
#ifndef _LINT_GB_H
#define _LINT_GB_H

#include <stdint.h>

/* ── Attribute stubs ──────────────────────────────────────────────────────── */
#define OLDCALL
#define NONBANKED
#define BANKED
#define PRESERVES_REGS(...)
#define CRITICAL
#define INTERRUPT
#define NAKED
#define AT(A)
#define NORETURN

/* ── Basic types ──────────────────────────────────────────────────────────── */
typedef int8_t   INT8;
typedef uint8_t  UINT8;
typedef int16_t  INT16;
typedef uint16_t UINT16;
typedef int32_t  INT32;
typedef uint32_t UINT32;
typedef INT8     BOOLEAN;
typedef INT8     BYTE;
typedef UINT8    UBYTE;
typedef INT16    WORD;
typedef UINT16   UWORD;
typedef INT32    LWORD;
typedef UINT32   ULWORD;
typedef INT32    DWORD;
typedef UINT32   UDWORD;
typedef UINT16   size_t;
typedef UINT16   palette_color_t;

/* SDCC banked-call helpers — no-ops for static analysis */
#define BANKREF(x)
#define BANKREF_EXTERN(x)
#define BANK(x) ((uint8_t)0)
#define CURRENT_BANK ((uint8_t)0)

/* ── Joypad ───────────────────────────────────────────────────────────────── */
#define J_RIGHT  0x01U
#define J_LEFT   0x02U
#define J_UP     0x04U
#define J_DOWN   0x08U
#define J_A      0x10U
#define J_B      0x20U
#define J_SELECT 0x40U
#define J_START  0x80U

/* ── Screen mode flags ────────────────────────────────────────────────────── */
#define M_DRAWING    0x01U
#define M_TEXT_OUT   0x02U
#define M_TEXT_INOUT 0x03U
#define M_NO_SCROLL  0x04U
#define M_NO_INTERP  0x08U

/* ── Sprite property bits ─────────────────────────────────────────────────── */
#define S_BANK     0x08U
#define S_PALETTE  0x10U
#define S_FLIPX    0x20U
#define S_FLIPY    0x40U
#define S_PRIORITY 0x80U
#define S_PAL(n)   (n)

/* ── Interrupt flags ──────────────────────────────────────────────────────── */
#define EMPTY_IFLAG 0x00U
#define VBL_IFLAG   0x01U
#define LCD_IFLAG   0x02U
#define TIM_IFLAG   0x04U
#define SIO_IFLAG   0x08U
#define JOY_IFLAG   0x10U

/* ── Window position constants ────────────────────────────────────────────── */
#define WIN_X_MIN 7U
#define WIN_Y_MIN 0U
#define WIN_X_MAX 166U
#define WIN_Y_MAX 143U

/* ── Hardware registers (plain extern uint8_t for clang) ──────────────────── */
extern volatile uint8_t _SRAM[];
extern volatile uint8_t _VRAM[];
extern volatile uint8_t _SCRN0[];
extern volatile uint8_t _SCRN1[];
extern volatile uint8_t _AUD3WAVERAM[];

extern volatile uint8_t rRAMG;
extern volatile uint8_t rROMB0;
extern volatile uint8_t rROMB1;
extern volatile uint8_t rRAMB;

extern volatile uint8_t LCDC_REG;
extern volatile uint8_t STAT_REG;
extern volatile uint8_t SCY_REG;
extern volatile uint8_t SCX_REG;
extern volatile uint8_t LY_REG;
extern volatile uint8_t LYC_REG;
extern volatile uint8_t DMA_REG;
extern volatile uint8_t BGP_REG;
extern volatile uint8_t OBP0_REG;
extern volatile uint8_t OBP1_REG;
extern volatile uint8_t WY_REG;
extern volatile uint8_t WX_REG;
extern volatile uint8_t IE_REG;
extern volatile uint8_t IF_REG;
extern volatile uint8_t VBK_REG;

extern volatile uint8_t NR10_REG;
extern volatile uint8_t NR11_REG;
extern volatile uint8_t NR12_REG;
extern volatile uint8_t NR13_REG;
extern volatile uint8_t NR14_REG;
extern volatile uint8_t NR21_REG;
extern volatile uint8_t NR22_REG;
extern volatile uint8_t NR23_REG;
extern volatile uint8_t NR24_REG;
extern volatile uint8_t NR30_REG;
extern volatile uint8_t NR31_REG;
extern volatile uint8_t NR32_REG;
extern volatile uint8_t NR33_REG;
extern volatile uint8_t NR34_REG;
extern volatile uint8_t NR41_REG;
extern volatile uint8_t NR42_REG;
extern volatile uint8_t NR43_REG;
extern volatile uint8_t NR44_REG;
extern volatile uint8_t NR50_REG;
extern volatile uint8_t NR51_REG;
extern volatile uint8_t NR52_REG;

extern volatile uint8_t _current_bank;
extern volatile uint8_t _shadow_OAM_base;
extern volatile uint8_t _vbl_done;

/* ── LCDC flags ───────────────────────────────────────────────────────────── */
#define LCDCF_OFF    0x00U
#define LCDCF_ON     0x01U
#define LCDCF_WINON  0x04U
#define LCDCF_BGON   0x80U
#define LCDCF_OBJON  0x40U
#define LCDCF_OBJ16  0x20U
#define LCDCF_WINOFF 0x00U
#define LCDCF_BGOFF  0x00U
#define LCDCF_OBJOFF 0x00U

/* ── VBK constants ────────────────────────────────────────────────────────── */
#define VBK_BANK_0      0x00U
#define VBK_BANK_1      0x01U
#define VBK_TILES       0x00U
#define VBK_ATTRIBUTES  0x01U

/* ── Display macros ───────────────────────────────────────────────────────── */
#define DISPLAY_ON   (LCDC_REG |= LCDCF_ON)
#define DISPLAY_OFF  (LCDC_REG &= (uint8_t)(~LCDCF_ON))
#define SHOW_BKG     (LCDC_REG |= LCDCF_BGON)
#define HIDE_BKG     (LCDC_REG &= (uint8_t)(~LCDCF_BGON))
#define SHOW_WIN     (LCDC_REG |= LCDCF_WINON)
#define HIDE_WIN     (LCDC_REG &= (uint8_t)(~LCDCF_WINON))
#define SHOW_SPRITES (LCDC_REG |= LCDCF_OBJON)
#define HIDE_SPRITES (LCDC_REG &= (uint8_t)(~LCDCF_OBJON))
#define SPRITES_8x16 (LCDC_REG |= LCDCF_OBJ16)
#define SPRITES_8x8  (LCDC_REG &= (uint8_t)(~LCDCF_OBJ16))

/* ── MBC3 RAM/ROM switching ───────────────────────────────────────────────── */
#define ENABLE_RAM    (rRAMG = 0x0Au)
#define DISABLE_RAM   (rRAMG = 0x00u)
#define SWITCH_RAM(b) (rRAMB = (uint8_t)(b))
#define SWITCH_ROM(b) (_current_bank = (uint8_t)(b), rROMB0 = (uint8_t)(b))

/* ── Palette helper ───────────────────────────────────────────────────────── */
#define RGB8(r, g, b) \
    ((palette_color_t)(((uint16_t)(((b) >> 3) & 0x1fu) << 10) | \
                       ((uint16_t)(((g) >> 3) & 0x1fu) << 5)  | \
                       (((r) >> 3) & 0x1fu)))
#define RGB(r, g, b)    RGB8(((r) << 3), ((g) << 3), ((b) << 3))
#define RGBHTML(c)      RGB8(((c) >> 16) & 0xffu, ((c) >> 8) & 0xffu, (c) & 0xffu)

/* ── OAM shadow ───────────────────────────────────────────────────────────── */
typedef struct OAM_item_t {
    uint8_t y;
    uint8_t x;
    uint8_t tile;
    uint8_t prop;
} OAM_item_t;
extern volatile OAM_item_t shadow_OAM[];

/* ── Interrupt handler type ───────────────────────────────────────────────── */
typedef void (*int_handler)(void);

/* ── Function declarations ────────────────────────────────────────────────── */
void add_VBL(int_handler h);
void remove_VBL(int_handler h);
void add_LCD(int_handler h);
void remove_LCD(int_handler h);
void add_TIM(int_handler h);
void remove_TIM(int_handler h);
void add_SIO(int_handler h);
void remove_SIO(int_handler h);
void add_JOY(int_handler h);
void remove_JOY(int_handler h);
void nowait_int_handler(void);
void wait_int_handler(void);

void set_interrupts(uint8_t flags);
void enable_interrupts(void);
void disable_interrupts(void);

void vsync(void);
void wait_vbl_done(void);
void display_off(void);
void refresh_OAM(void);
void delay(uint16_t d);

uint8_t joypad(void);
uint8_t waitpad(uint8_t mask);
void    waitpadup(void);

void    mode(uint8_t m);
uint8_t get_mode(void);

void init_bkg(uint8_t c);
void init_win(uint8_t c);

void set_bkg_data(uint8_t first_tile, uint8_t nb_tiles, const uint8_t *data);
void set_bkg_1bpp_data(uint8_t first_tile, uint8_t nb_tiles, const uint8_t *data);
void get_bkg_data(uint8_t first_tile, uint8_t nb_tiles, uint8_t *data);
void set_bkg_tiles(uint8_t x, uint8_t y, uint8_t w, uint8_t h, const uint8_t *tiles);
void get_bkg_tiles(uint8_t x, uint8_t y, uint8_t w, uint8_t h, uint8_t *tiles);
uint8_t get_bkg_tile_xy(uint8_t x, uint8_t y);
void set_bkg_submap(uint8_t x, uint8_t y, uint8_t w, uint8_t h, const uint8_t *map, uint8_t map_w);

void set_win_data(uint8_t first_tile, uint8_t nb_tiles, const uint8_t *data);
void set_win_1bpp_data(uint8_t first_tile, uint8_t nb_tiles, const uint8_t *data);
void get_win_data(uint8_t first_tile, uint8_t nb_tiles, uint8_t *data);
void set_win_tiles(uint8_t x, uint8_t y, uint8_t w, uint8_t h, const uint8_t *tiles);
void get_win_tiles(uint8_t x, uint8_t y, uint8_t w, uint8_t h, uint8_t *tiles);
uint8_t get_win_tile_xy(uint8_t x, uint8_t y);
void set_win_submap(uint8_t x, uint8_t y, uint8_t w, uint8_t h, const uint8_t *map, uint8_t map_w);

static inline void move_win(uint8_t x, uint8_t y) {
    WX_REG = x;
    WY_REG = y;
}

void set_sprite_data(uint8_t first_tile, uint8_t nb_tiles, const uint8_t *data);
void set_sprite_1bpp_data(uint8_t first_tile, uint8_t nb_tiles, const uint8_t *data);
void get_sprite_data(uint8_t first_tile, uint8_t nb_tiles, uint8_t *data);

static inline void set_sprite_tile(uint8_t nb, uint8_t tile) { shadow_OAM[nb].tile = tile; }
static inline uint8_t get_sprite_tile(uint8_t nb)            { return shadow_OAM[nb].tile; }
static inline void set_sprite_prop(uint8_t nb, uint8_t prop) { shadow_OAM[nb].prop = prop; }
static inline uint8_t get_sprite_prop(uint8_t nb)            { return shadow_OAM[nb].prop; }
static inline void move_sprite(uint8_t nb, uint8_t x, uint8_t y) {
    shadow_OAM[nb].x = x;
    shadow_OAM[nb].y = y;
}
static inline void hide_sprite(uint8_t nb) { shadow_OAM[nb].y = 0; }
void hide_sprites_range(uint8_t from, uint8_t to);

/* CGB palette functions (from cgb.h, included via platform.h) */
void set_bkg_palette(uint8_t first_palette, uint8_t nb_palettes, const palette_color_t *rgb_data);
void set_sprite_palette(uint8_t first_palette, uint8_t nb_palettes, const palette_color_t *rgb_data);
void set_bkg_palette_entry(uint8_t palette, uint8_t entry, uint16_t rgb_data);
void set_sprite_palette_entry(uint8_t palette, uint8_t entry, uint16_t rgb_data);

uint8_t *get_bkg_xy_addr(uint8_t x, uint8_t y);
uint8_t *get_win_xy_addr(uint8_t x, uint8_t y);
void set_vram_byte(uint8_t *addr, uint8_t v);
uint8_t get_vram_byte(uint8_t *addr);

void hiramcpy(uint8_t dst, const void *src, uint8_t n);
void set_1bpp_colors_ex(uint8_t fgcolor, uint8_t bgcolor, uint8_t mode);

#endif /* _LINT_GB_H */
