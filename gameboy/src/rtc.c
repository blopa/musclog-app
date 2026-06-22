#include "rtc.h"

#include "input.h"
#include "ui_text.h"

#include <gb/gb.h>
#include <stdio.h>
#include <string.h>

/*
 * MBC3 RTC hardware notes:
 *
 *  SWITCH_RAM(0x08..0x0C) maps the corresponding RTC register to _SRAM[0].
 *  Latch: write 0x00 then 0x01 to 0x6000 to freeze the running counters into
 *  the readable registers.  This does not stop the clock — the counter keeps
 *  ticking in the background.
 *
 *  Register map (after ENABLE_RAM + SWITCH_RAM):
 *    0x08  Seconds  (0-59)
 *    0x09  Minutes  (0-59)
 *    0x0A  Hours    (0-23)
 *    0x0B  Day lo   (bits 7:0 of the 9-bit day counter)
 *    0x0C  Day hi   [bit 7=carry, bit 6=halt, bit 0=day bit 8]
 */
#define RTC_LATCH (*(volatile uint8_t *)0x6000u)

/* ── Hardware access ──────────────────────────────────────────────────────── */

void rtc_latch(RtcTime *out) {
    uint8_t dhi;

    ENABLE_RAM;

    RTC_LATCH = 0x00u;
    RTC_LATCH = 0x01u;

    SWITCH_RAM(0x08u); out->seconds = _SRAM[0];
    SWITCH_RAM(0x09u); out->minutes = _SRAM[0];
    SWITCH_RAM(0x0Au); out->hours   = _SRAM[0];
    SWITCH_RAM(0x0Bu); out->days    = _SRAM[0];
    SWITCH_RAM(0x0Cu);
    dhi         = _SRAM[0];
    out->days  |= (uint16_t)((uint16_t)(dhi & 0x01u) << 8u);
    out->halt   = (dhi >> 6u) & 0x01u;
    out->carry  = (dhi >> 7u) & 0x01u;

    SWITCH_RAM(0u);  /* restore SRAM bank 0 */
    DISABLE_RAM;
}

void rtc_write_days(uint16_t days) {
    rtc_write_datetime(days, 0u, 0u);
}

void rtc_write_datetime(uint16_t days, uint8_t hours, uint8_t minutes) {
    ENABLE_RAM;

    /* Halt the timer before writing to prevent corrupt mid-tick reads. */
    SWITCH_RAM(0x0Cu);
    _SRAM[0] = 0x40u;  /* halt=1, carry=0, day_bit8=0 */

    SWITCH_RAM(0x08u); _SRAM[0] = 0x00u;    /* seconds = 0 */
    SWITCH_RAM(0x09u); _SRAM[0] = minutes;
    SWITCH_RAM(0x0Au); _SRAM[0] = hours;

    SWITCH_RAM(0x0Bu); _SRAM[0] = (uint8_t)(days & 0xFFu);
    /* Writing day_hi with halt=0 restarts the timer; carry and halt are cleared. */
    SWITCH_RAM(0x0Cu); _SRAM[0] = (uint8_t)((days >> 8u) & 0x01u);

    SWITCH_RAM(0u);
    DISABLE_RAM;
}

/* ── Calendar arithmetic ──────────────────────────────────────────────────── */

uint8_t cal_is_leap(uint16_t year) {
    if ((year % 400u) == 0u) return 1u;
    if ((year % 100u) == 0u) return 0u;
    if ((year %   4u) == 0u) return 1u;
    return 0u;
}

uint8_t cal_days_in_month(uint8_t month, uint16_t year) {
    if (month == 2u) return cal_is_leap(year) ? 29u : 28u;
    if (month == 4u || month == 6u || month == 9u || month == 11u) return 30u;
    return 31u;
}

CalDate cal_advance(CalDate d, uint16_t n_days) {
    uint16_t i;
    uint8_t  dim;

    for (i = 0u; i != n_days; ++i) {
        dim = cal_days_in_month(d.month, d.year);
        d.day++;
        if (d.day > dim) {
            d.day = 1u;
            d.month++;
            if (d.month > 12u) {
                d.month = 1u;
                d.year++;
            }
        }
    }
    return d;
}

int8_t cal_compare(CalDate a, CalDate b) {
    if (a.year  != b.year)  return (a.year  < b.year)  ? (int8_t)(-1) : (int8_t)1;
    if (a.month != b.month) return (a.month < b.month) ? (int8_t)(-1) : (int8_t)1;
    if (a.day   != b.day)   return (a.day   < b.day)   ? (int8_t)(-1) : (int8_t)1;
    return 0;
}

void cal_format(const CalDate *d, char *buf) {
    /* "MM-DD-YY\0" — 8 visible chars, 9 bytes total */
    buf[0] = (char)('0' + d->month / 10u);
    buf[1] = (char)('0' + d->month % 10u);
    buf[2] = '-';
    buf[3] = (char)('0' + d->day / 10u);
    buf[4] = (char)('0' + d->day % 10u);
    buf[5] = '-';
    buf[6] = (char)('0' + (d->year / 10u) % 10u);
    buf[7] = (char)('0' + d->year % 10u);
    buf[8] = '\0';
}

CalDate cal_current_date(const SaveData *data) {
    RtcTime  rtc;
    uint16_t elapsed;
    CalDate  fallback;
    CalDate  current;

    if (!data->rtc_is_set) {
        fallback.year  = 2025u;
        fallback.month = 1u;
        fallback.day   = 1u;
        return fallback;
    }

    rtc_latch(&rtc);
    elapsed = rtc.days;
    if (rtc.carry) elapsed = (uint16_t)(elapsed + 512u);
    current = cal_advance(data->rtc_base_date, elapsed);
    return current;
}

/* ── Date+time setup screen ───────────────────────────────────────────────── */

/*
 * Show a 5-field year/month/day/hour/minute picker.
 * On confirm (A/Start): writes rtc_base_date + rtc_is_set=1, resets the RTC
 * counter to 0 with the chosen time (so the day boundary falls at midnight),
 * and calls db_save.  On cancel (B): returns without changing anything.
 *
 * The hardware day counter increments automatically every 86400 seconds, so
 * cal_current_date() returns the correct date the next day with no software
 * intervention needed.
 */
void rtc_setup_date(SaveData *data) {
    CalDate    pick;
    uint8_t    pick_hour;
    uint8_t    pick_minute;
    uint8_t    field;       /* 0=year 1=month 2=day 3=hour 4=minute */
    uint8_t    dirty;
    uint8_t    going_right;
    uint8_t    dim;
    InputState input;

    /* Seed with existing calibration date if available; otherwise 2025-01-01 00:00. */
    if (data->rtc_is_set) {
        pick = data->rtc_base_date;
    } else {
        pick.year  = 2025u;
        pick.month = 1u;
        pick.day   = 1u;
    }
    pick_hour   = 0u;
    pick_minute = 0u;
    field       = 0u;
    dirty       = 1u;

    input_init(&input);
    while (1) {
        if (dirty) {
            ui_draw_datetime_picker("SET DATE & TIME", field,
                                    pick.year, pick.month, pick.day,
                                    pick_hour, pick_minute);
            ui_footer("B SKIP", "A/ST SAVE");
            dirty = 0u;
        }

        wait_vbl_done();
        input_update(&input);

        if (input_pressed(&input, J_B)) return;   /* skip — rtc_is_set unchanged */

        if (input_pressed(&input, J_A | J_START)) {
            data->rtc_base_date = pick;
            data->rtc_is_set    = 1u;
            /* Reset day counter to 0 at the chosen time.  The counter ticks every
             * 86400 s, so setting hours+minutes makes the day boundary fall at
             * midnight rather than at the time of calibration. */
            rtc_write_datetime(0u, pick_hour, pick_minute);
            db_save(data);
            return;
        }

        if (input_pressed(&input, J_UP)) {
            field = (field == 0u) ? 4u : (uint8_t)(field - 1u);
            dirty = 1u;
        }
        if (input_pressed(&input, J_DOWN)) {
            field = (uint8_t)((field + 1u) % 5u);
            dirty = 1u;
        }

        if (input_pressed(&input, J_LEFT | J_RIGHT)) {
            going_right = input_pressed(&input, J_RIGHT);

            if (field == 0u) {
                /* Year: 2000–2099, wrapping */
                if (going_right) {
                    pick.year = (pick.year >= 2099u) ? 2000u : (uint16_t)(pick.year + 1u);
                } else {
                    pick.year = (pick.year <= 2000u) ? 2099u : (uint16_t)(pick.year - 1u);
                }
                dim = cal_days_in_month(pick.month, pick.year);
                if (pick.day > dim) pick.day = dim;

            } else if (field == 1u) {
                /* Month: 1–12, wrapping */
                if (going_right) {
                    pick.month = (pick.month >= 12u) ? 1u : (uint8_t)(pick.month + 1u);
                } else {
                    pick.month = (pick.month <= 1u) ? 12u : (uint8_t)(pick.month - 1u);
                }
                dim = cal_days_in_month(pick.month, pick.year);
                if (pick.day > dim) pick.day = dim;

            } else if (field == 2u) {
                /* Day: 1–days_in_month, wrapping */
                dim = cal_days_in_month(pick.month, pick.year);
                if (going_right) {
                    pick.day = (pick.day >= dim) ? 1u : (uint8_t)(pick.day + 1u);
                } else {
                    pick.day = (pick.day <= 1u) ? dim : (uint8_t)(pick.day - 1u);
                }

            } else if (field == 3u) {
                /* Hour: 0–23, wrapping */
                if (going_right) {
                    pick_hour = (pick_hour >= 23u) ? 0u : (uint8_t)(pick_hour + 1u);
                } else {
                    pick_hour = (pick_hour == 0u) ? 23u : (uint8_t)(pick_hour - 1u);
                }

            } else {
                /* Minute: 0–59, wrapping */
                if (going_right) {
                    pick_minute = (pick_minute >= 59u) ? 0u : (uint8_t)(pick_minute + 1u);
                } else {
                    pick_minute = (pick_minute == 0u) ? 59u : (uint8_t)(pick_minute - 1u);
                }
            }

            dirty = 1u;
        }
    }
}
