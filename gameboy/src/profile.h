#ifndef MUSCLOG_PROFILE_H
#define MUSCLOG_PROFILE_H

#include <stdint.h>

/* ── Save-file header ─────────────────────────────────────────────────────── */
#define SAVE_MAGIC   0x4D47u  /* 'MG' */
#define SAVE_VERSION 3u       /* v3: packed layout + MBC3 RTC calendar fields */

/* ── Profile constants ────────────────────────────────────────────────────── */
#define UNITS_METRIC   0u
#define UNITS_IMPERIAL 1u

#define GENDER_MALE   0u
#define GENDER_FEMALE 1u
#define GENDER_OTHER  2u

#define EXPERIENCE_BEGINNER     0u
#define EXPERIENCE_INTERMEDIATE 1u
#define EXPERIENCE_ADVANCED     2u

#define FITNESS_MUSCLE    0u
#define FITNESS_STRENGTH  1u
#define FITNESS_ENDURANCE 2u
#define FITNESS_GENERAL   3u

#define WEIGHT_GOAL_LOSE     0u
#define WEIGHT_GOAL_MAINTAIN 1u
#define WEIGHT_GOAL_GAIN     2u

/* ── Spinner/validation bounds (also drive SRAM offset encoding) ──────────── */
#define DB_HEIGHT_CM_MIN        120u   /* stored as: height_cm - DB_HEIGHT_CM_MIN (1 byte, 0-110) */
#define DB_HEIGHT_CM_MAX        230u
#define DB_WEIGHT_KG_TENTHS_MIN 300u   /* stored as: weight_kg_tenths - DB_WEIGHT_KG_TENTHS_MIN */
#define DB_WEIGHT_KG_TENTHS_MAX 2500u

/* ── Calendar date (year is full, e.g. 2026) ──────────────────────────────── */
typedef struct CalDate {
    uint16_t year;
    uint8_t  month;  /* 1-12 */
    uint8_t  day;    /* 1-31 */
} CalDate;

/* ── SRAM byte-address map ────────────────────────────────────────────────── */
/*
 *  Addr  | Bytes | Constant            | Content
 *  ------|-------|---------------------|-------------------------------------------
 *  0x00  |   2   | SRAM_MAGIC          | 0x4D47 (lo, hi)
 *  0x02  |   1   | SRAM_VERSION        | Save format version
 *  0x03  |   2   | SRAM_CHECKSUM       | 16-bit integrity checksum (lo, hi)
 *  0x05  |   1   | SRAM_FLAGS1         | [7:6]=experience [5:3]=activity-1 [2:1]=gender [0]=units
 *  0x06  |   1   | SRAM_FLAGS2         | [5]=rtc_is_set [4]=onboarding [3:2]=weight_goal [1:0]=fitness
 *  0x07  |   1   | SRAM_AGE            | Age in years (13-99)
 *  0x08  |   1   | SRAM_HEIGHT         | height_cm - DB_HEIGHT_CM_MIN (0-110)
 *  0x09  |   2   | SRAM_WEIGHT         | weight_kg_tenths - DB_WEIGHT_KG_TENTHS_MIN (lo, hi)
 *  0x0B  |   2   | SRAM_CAL_GOAL       | Calorie goal kcal (lo, hi)
 *  0x0D  |   2   | SRAM_PROTEIN_GOAL   | Protein goal g (lo, hi)
 *  0x0F  |   2   | SRAM_CARBS_GOAL     | Carbs goal g (lo, hi)
 *  0x11  |   2   | SRAM_FAT_GOAL       | Fat goal g (lo, hi)
 *  0x13  |   1   | SRAM_FIBER_GOAL     | Fiber goal g (0-99)
 *  0x14  |   1   | SRAM_RTC_YEAR_OFS   | rtc_base_date.year - 2000 (0-99)
 *  0x15  |   1   | SRAM_RTC_MONTH      | rtc_base_date.month (1-12)
 *  0x16  |   1   | SRAM_RTC_DAY        | rtc_base_date.day (1-31)
 *  ------|-------|---------------------|------------------------------------------- (checksummed: 23 bytes)
 *  0x17  |   1   | SRAM_RTC_HOUR       | seed hint: hour   (0-23) — NOT checksummed
 *  0x18  |   1   | SRAM_RTC_MINUTE     | seed hint: minute (0-59) — NOT checksummed
 *  ------|-------|---------------------|-------------------------------------------
 *  0x38  |   1   | (audio.c) magic     | 0xA7 marks a written audio-settings store
 *  0x39  |   1   | (audio.c) flags     | bit0 = SFX on, bit1 = soundtrack on
 *  ------|-------|---------------------|-------------------------------------------
 *  Total: 23 checksummed bytes + 2 seed-hint bytes
 *
 *  The audio-settings micro-store (0x38-0x39) lives in the free part of the
 *  profile-reserved region (the metrics store starts at 0x40). db_load/db_save/
 *  db_erase only touch the 23-byte checksummed block, so the audio flags persist
 *  across a NEW GAME erase. It is owned entirely by audio.c (AUDIO_SRAM_*); future
 *  profile growth from 0x19 must stop before 0x38.
 */
#define SRAM_MAGIC         0x00u
#define SRAM_VERSION       0x02u
#define SRAM_CHECKSUM      0x03u
#define SRAM_FLAGS1        0x05u
#define SRAM_FLAGS2        0x06u
#define SRAM_AGE           0x07u
#define SRAM_HEIGHT        0x08u
#define SRAM_WEIGHT        0x09u
#define SRAM_CAL_GOAL      0x0Bu
#define SRAM_PROTEIN_GOAL  0x0Du
#define SRAM_CARBS_GOAL    0x0Fu
#define SRAM_FAT_GOAL      0x11u
#define SRAM_FIBER_GOAL    0x13u
#define SRAM_RTC_YEAR_OFS  0x14u
#define SRAM_RTC_MONTH     0x15u
#define SRAM_RTC_DAY       0x16u
#define SRAM_SAVE_SIZE     0x17u  /* 23 bytes — size of the checksummed profile block */

/* ── Onboarding seed hints (NOT part of the checksummed profile block) ──────── */
/* Written by the website emulator before boot so the onboarding date/time picker
 * can pre-fill the time of day (the date itself lives in the block above). They
 * sit in the free gap before the metrics store (0x40), are excluded from
 * SRAM_CHECKSUM, and are never read/written/erased by db_load/db_save/db_erase —
 * so they do not affect save validity. Future profile growth must resume at 0x19. */
#define SRAM_RTC_HOUR      0x17u  /* seed hint: hour   (0-23) */
#define SRAM_RTC_MINUTE    0x18u  /* seed hint: minute (0-59) */

/* ── SRAM_FLAGS1 bit layout ───────────────────────────────────────────────── */
/* bit  0    : units             (UNITS_METRIC=0, UNITS_IMPERIAL=1)           */
/* bits 2:1  : gender            (GENDER_MALE=0, FEMALE=1, OTHER=2)           */
/* bits 5:3  : activity_level-1  (stored 0-4; add 1 to decode → levels 1-5)  */
/* bits 7:6  : lifting_experience (BEGINNER=0, INTERMEDIATE=1, ADVANCED=2)   */
#define FLAGS1_UNITS_BIT        0u
#define FLAGS1_GENDER_SHIFT     1u
#define FLAGS1_ACTIVITY_SHIFT   3u
#define FLAGS1_EXPERIENCE_SHIFT 6u

/* ── SRAM_FLAGS2 bit layout ───────────────────────────────────────────────── */
/* bits 1:0  : fitness_focus    (MUSCLE=0, STRENGTH=1, ENDURANCE=2, GENERAL=3) */
/* bits 3:2  : weight_goal      (LOSE=0, MAINTAIN=1, GAIN=2)                  */
/* bit  4    : onboarding_complete                                             */
/* bit  5    : rtc_is_set       (1 = user has calibrated the MBC3 RTC)        */
/* bits 7:6  : reserved                                                        */
#define FLAGS2_FITNESS_SHIFT      0u
#define FLAGS2_WEIGHT_GOAL_SHIFT  2u
#define FLAGS2_ONBOARDING_BIT     4u
#define FLAGS2_RTC_IS_SET_BIT     5u

/* ── In-memory save record (decoded form used by all game code) ───────────── */
typedef struct SaveData {
    uint16_t magic;
    uint8_t  version;
    uint16_t checksum;
    uint8_t  onboarding_complete;

    uint8_t  units;
    uint8_t  gender;
    uint8_t  age;
    uint16_t height_cm;
    uint16_t weight_kg_tenths;

    uint8_t  activity_level;
    uint8_t  lifting_experience;
    uint8_t  fitness_focus;
    uint8_t  weight_goal;

    uint16_t calorie_goal;
    uint16_t protein_goal;
    uint16_t carbs_goal;
    uint16_t fat_goal;
    uint16_t fiber_goal;

    /*
     * MBC3 RTC calibration.
     * rtc_base_date is the calendar date when the user set the clock.
     * The RTC day counter is reset to 0 at that moment.
     * current_date = cal_advance(rtc_base_date, rtc.days + (rtc.carry ? 512 : 0))
     * Accurate for up to 1023 days (~2.8 years) without re-calibration.
     */
    uint8_t  rtc_is_set;       /* 1 = rtc_base_date is valid */
    CalDate  rtc_base_date;    /* calendar date when day counter was last reset to 0 */
} SaveData;

/* ── Public API ───────────────────────────────────────────────────────────── */
void    db_init_defaults(SaveData *data);
uint8_t db_is_valid(const SaveData *data);
uint8_t db_load(SaveData *out);
void    db_save(const SaveData *data);
void    db_erase(void);

#endif /* MUSCLOG_PROFILE_H */
