#ifndef MUSCLOG_RTC_H
#define MUSCLOG_RTC_H

#include "database.h"  /* for CalDate, SaveData */

/* MBC3 real-time clock register snapshot. */
typedef struct RtcTime {
    uint8_t  seconds;
    uint8_t  minutes;
    uint8_t  hours;
    uint16_t days;    /* 9-bit day counter (0–511) */
    uint8_t  halt;    /* 1 = timer is halted */
    uint8_t  carry;   /* 1 = day counter overflowed 511, stays set until cleared */
} RtcTime;

/* ── Hardware access ──────────────────────────────────────────────────────── */

/* Latch current RTC counters and read all registers into *out. */
void rtc_latch(RtcTime *out);

/*
 * Reset the day counter to `days`, clear halt and carry, and restart the
 * timer.  Call with days=0 after every calibration to keep the arithmetic
 * simple: elapsed = rtc.days + (rtc.carry ? 512 : 0).
 */
void rtc_write_days(uint16_t days);

/*
 * Same as rtc_write_days(days) but also sets the hours and minutes registers.
 * Seconds are always cleared to 0.  Use this when the user provides a time
 * during setup so the day boundary (every 86400 s) aligns to midnight.
 */
void rtc_write_datetime(uint16_t days, uint8_t hours, uint8_t minutes);

/* ── Calendar arithmetic ──────────────────────────────────────────────────── */

uint8_t cal_is_leap(uint16_t year);
uint8_t cal_days_in_month(uint8_t month, uint16_t year);

/* Advance `base` by `n_days` days and return the resulting CalDate. */
CalDate cal_advance(CalDate base, uint16_t n_days);

/*
 * Compare two CalDates.
 * Returns -1 if a < b, 0 if a == b, +1 if a > b.
 */
int8_t  cal_compare(CalDate a, CalDate b);

/*
 * Format d as "MM-DD-YY\0" (8 visible chars, 9 bytes including null).
 * buf must be at least 9 bytes.
 */
void    cal_format(const CalDate *d, char *buf);

/*
 * Compute today's CalDate from the RTC and the calibration stored in data.
 * Accurate for up to 1023 elapsed days (~2.8 years) without re-calibration.
 * Returns a 2025-01-01 placeholder when rtc_is_set is 0.
 */
CalDate cal_current_date(const SaveData *data);

/* ── Date setup screen ────────────────────────────────────────────────────── */

/*
 * Show a year/month/day picker so the user can set today's date.
 * On confirm (A/Start): writes rtc_base_date + rtc_is_set=1, resets the RTC
 * day counter to 0, and calls db_save.
 * On cancel (B): returns without changing anything.
 */
void rtc_setup_date(SaveData *data);

#endif /* MUSCLOG_RTC_H */
