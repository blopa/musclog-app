#pragma bank 11

#include "optical_export.h"

#include <gb/gb.h>
#include <string.h>

#include "common_foods.h"
#include "custom_foods.h"
#include "exercise_db.h"
#include "food_db.h"
#include "foodlog.h"
#include "foundation_foods.h"
#include "metrics.h"
#include "optical_math.h"
#include "rtc.h"
#include "sha256.h"
#include "sram.h"
#include "workoutlog.h"

#define BUNDLED_FOOD_COUNT (FOUNDATION_FOOD_COUNT + COMMON_FOOD_COUNT)
#define FOOD_BITMAP_BYTES ((BUNDLED_FOOD_COUNT + 7u) / 8u)
#define CUSTOM_BITMAP_BYTES ((MAX_CUSTOM_FOODS + 7u) / 8u)
#define EXERCISE_BITMAP_BYTES ((EXERCISE_COUNT + 7u) / 8u)

#define CONTAINER_VERSION 1u
#define CONTAINER_EXPORT_VERSION OPTICAL_EXPORT_DATABASE_VERSION
#define DAY_ZERO_UNIX_SECONDS 946684800ul
#define DAY_SECONDS 86400ul

typedef enum SinkMode {
    SINK_COUNT_SHA,
    SINK_FNV,
    SINK_XOR,
} SinkMode;

typedef struct JsonSink {
    SinkMode mode;
    uint32_t pos;
    uint32_t fnv;
    OpticalSha256 *sha;
    const uint16_t *selected;
    uint8_t degree;
    uint8_t selected_cursor;
    uint8_t *block;
} JsonSink;

static const SaveData *export_data;
static uint16_t export_today_day;
static uint32_t export_plain_len;
static uint32_t export_payload_fnv;
static uint8_t export_digest[32];
static uint8_t food_referenced[FOOD_BITMAP_BYTES];
static uint8_t custom_referenced[CUSTOM_BITMAP_BYTES];
static uint8_t custom_live[CUSTOM_BITMAP_BYTES];
static uint8_t exercise_referenced[EXERCISE_BITMAP_BYTES];
static OpticalSha256 sha_context;

static void bitmap_set(uint8_t *bitmap, uint16_t index) {
    bitmap[index >> 3u] |= (uint8_t)(1u << (index & 7u));
}

static uint8_t bitmap_get(const uint8_t *bitmap, uint16_t index) {
    return (uint8_t)((bitmap[index >> 3u] >> (index & 7u)) & 1u);
}

static uint32_t fnv_byte(uint32_t hash, uint8_t value) {
    hash ^= value;
    return hash + (hash << 1u) + (hash << 4u) + (hash << 7u) + (hash << 8u) + (hash << 24u);
}

static void sink_byte(JsonSink *sink, uint8_t value) {
    if (sink->mode == SINK_COUNT_SHA) {
        optical_sha256_byte(sink->sha, value);
    } else if (sink->mode == SINK_FNV) {
        sink->fnv = fnv_byte(sink->fnv, value);
    } else {
        uint16_t block_index = (uint16_t)(sink->pos / OPTICAL_FOUNTAIN_BLOCK_LEN);
        while (sink->selected_cursor < sink->degree &&
               sink->selected[sink->selected_cursor] < block_index) {
            ++sink->selected_cursor;
        }
        if (sink->selected_cursor < sink->degree &&
            sink->selected[sink->selected_cursor] == block_index) {
            sink->block[(uint16_t)(sink->pos % OPTICAL_FOUNTAIN_BLOCK_LEN)] ^= value;
        }
    }
    ++sink->pos;
}

static void json_text(JsonSink *sink, const char *text) {
    while (*text != '\0')
        sink_byte(sink, (uint8_t)*text++);
}

static void json_uint32(JsonSink *sink, uint32_t value) {
    char digits[10];
    uint8_t count = 0u;
    if (value == 0ul) {
        sink_byte(sink, '0');
        return;
    }
    while (value != 0ul) {
        digits[count++] = (char)('0' + value % 10ul);
        value /= 10ul;
    }
    while (count != 0u)
        sink_byte(sink, (uint8_t)digits[--count]);
}

static void json_string(JsonSink *sink, const char *value) {
    uint8_t c;
    static const char hex[] = "0123456789ABCDEF";
    sink_byte(sink, '"');
    while (*value != '\0') {
        c = (uint8_t)*value++;
        if (c == '"' || c == '\\') {
            sink_byte(sink, '\\');
            sink_byte(sink, c);
        } else if (c < 0x20u) {
            json_text(sink, "\\u00");
            sink_byte(sink, (uint8_t)hex[c >> 4u]);
            sink_byte(sink, (uint8_t)hex[c & 15u]);
        } else {
            sink_byte(sink, c);
        }
    }
    sink_byte(sink, '"');
}

static void tuple_separator(JsonSink *sink, uint8_t *first) {
    if (*first) {
        *first = 0u;
    } else {
        sink_byte(sink, ',');
    }
}

static uint16_t foodlog_entry_offset(uint16_t index) {
    return (uint16_t)(FOODLOG_ENTRIES_OFFSET + index * FOODLOG_ENTRY_SIZE);
}

static void scan_references(void) {
    uint16_t count;
    uint16_t i;
    uint16_t off;
    uint16_t food_index;
    uint8_t workout_count;
    uint8_t workout;
    uint8_t set;
    uint8_t slot;
    FoodCache food;
    WorkoutLogSummary summary;
    WorkoutLogSet workout_set;

    memset(food_referenced, 0, sizeof(food_referenced));
    memset(custom_referenced, 0, sizeof(custom_referenced));
    memset(custom_live, 0, sizeof(custom_live));
    memset(exercise_referenced, 0, sizeof(exercise_referenced));

    ENABLE_RAM;
    SWITCH_RAM(FOODLOG_SRAM_BANK);
    count = sram_rd16(_SRAM, FOODLOG_OFF_COUNT);
    if (count > FOODLOG_CAPACITY) count = 0u;
    for (i = 0u; i != count; ++i) {
        off = foodlog_entry_offset(i);
        food_index = sram_rd16(_SRAM, (uint16_t)(off + 2u));
        if (food_index < BUNDLED_FOOD_COUNT) {
            bitmap_set(food_referenced, food_index);
        } else if (food_index >= CUSTOM_FOOD_BASE &&
                   (uint16_t)(food_index - CUSTOM_FOOD_BASE) < MAX_CUSTOM_FOODS) {
            bitmap_set(custom_referenced, (uint16_t)(food_index - CUSTOM_FOOD_BASE));
        }
    }
    SWITCH_RAM(0u);
    DISABLE_RAM;

    for (slot = 0u; slot != MAX_CUSTOM_FOODS; ++slot) {
        custom_foods_load(slot, &food);
        if (food.name[0] != '\0') bitmap_set(custom_live, slot);
    }

    workout_count = workoutlog_count();
    for (workout = 0u; workout != workout_count; ++workout) {
        if (!workoutlog_get_summary(workout, &summary)) continue;
        for (set = 0u; set != summary.set_count; ++set) {
            if (workoutlog_get_set(workout, set, &workout_set) &&
                workout_set.exercise_idx < EXERCISE_COUNT) {
                bitmap_set(exercise_referenced, workout_set.exercise_idx);
            }
        }
    }
}

static void render_profile(JsonSink *sink) {
    const SaveData *d = export_data;
    json_text(sink, "\"profile\":{\"units\":");
    json_uint32(sink, d->units);
    json_text(sink, ",\"gender\":");
    json_uint32(sink, d->gender);
    json_text(sink, ",\"age\":");
    json_uint32(sink, d->age);
    json_text(sink, ",\"heightCm\":");
    json_uint32(sink, d->height_cm);
    json_text(sink, ",\"weightKgTenths\":");
    json_uint32(sink, d->weight_kg_tenths);
    json_text(sink, ",\"activity\":");
    json_uint32(sink, d->activity_level);
    json_text(sink, ",\"experience\":");
    json_uint32(sink, d->lifting_experience);
    json_text(sink, ",\"focus\":");
    json_uint32(sink, d->fitness_focus);
    json_text(sink, ",\"weightGoal\":");
    json_uint32(sink, d->weight_goal);
    json_text(sink, ",\"calories\":");
    json_uint32(sink, d->calorie_goal);
    json_text(sink, ",\"protein\":");
    json_uint32(sink, d->protein_goal);
    json_text(sink, ",\"carbs\":");
    json_uint32(sink, d->carbs_goal);
    json_text(sink, ",\"fat\":");
    json_uint32(sink, d->fat_goal);
    json_text(sink, ",\"fiber\":");
    json_uint32(sink, d->fiber_goal);
    json_text(sink, ",\"todayDay\":");
    json_uint32(sink, export_today_day);
    sink_byte(sink, '}');
}

static void render_food_tuple(JsonSink *sink, uint16_t index, const FoodCache *food,
                              uint8_t *first) {
    tuple_separator(sink, first);
    sink_byte(sink, '[');
    json_uint32(sink, index);
    sink_byte(sink, ',');
    json_string(sink, food->name[0] != '\0' ? food->name : "DELETED FOOD");
    sink_byte(sink, ',');
    json_uint32(sink, food->kcal);
    sink_byte(sink, ',');
    json_uint32(sink, food->protein_dg);
    sink_byte(sink, ',');
    json_uint32(sink, food->fat_dg);
    sink_byte(sink, ',');
    json_uint32(sink, food->carbs_dg);
    sink_byte(sink, ',');
    json_uint32(sink, food->fiber_dg);
    sink_byte(sink, ']');
}

static void render_foods(JsonSink *sink) {
    uint16_t index;
    uint8_t slot;
    uint8_t first = 1u;
    FoodCache food;
    json_text(sink, ",\"foods\":[");
    for (index = 0u; index != BUNDLED_FOOD_COUNT; ++index) {
        if (!bitmap_get(food_referenced, index)) continue;
        ff_load(index, &food);
        render_food_tuple(sink, index, &food, &first);
    }
    for (slot = 0u; slot != MAX_CUSTOM_FOODS; ++slot) {
        if (!bitmap_get(custom_live, slot) && !bitmap_get(custom_referenced, slot)) continue;
        custom_foods_load(slot, &food);
        render_food_tuple(sink, (uint16_t)(CUSTOM_FOOD_BASE + slot), &food, &first);
    }
    sink_byte(sink, ']');
}

static void render_food_logs(JsonSink *sink) {
    uint16_t count;
    uint16_t i;
    uint16_t off;
    uint8_t first = 1u;
    json_text(sink, ",\"foodLogs\":[");
    ENABLE_RAM;
    SWITCH_RAM(FOODLOG_SRAM_BANK);
    count = sram_rd16(_SRAM, FOODLOG_OFF_COUNT);
    if (count > FOODLOG_CAPACITY) count = 0u;
    for (i = 0u; i != count; ++i) {
        off = foodlog_entry_offset(i);
        tuple_separator(sink, &first);
        sink_byte(sink, '[');
        json_uint32(sink, sram_rd16(_SRAM, off));
        sink_byte(sink, ',');
        json_uint32(sink, sram_rd16(_SRAM, (uint16_t)(off + 2u)));
        sink_byte(sink, ',');
        json_uint32(sink, sram_rd16(_SRAM, (uint16_t)(off + 4u)));
        sink_byte(sink, ']');
    }
    SWITCH_RAM(0u);
    DISABLE_RAM;
    sink_byte(sink, ']');
}

static void render_weights(JsonSink *sink) {
    uint16_t count = metrics_count();
    uint16_t i;
    uint16_t day;
    uint16_t weight;
    uint8_t first = 1u;
    json_text(sink, ",\"weights\":[");
    for (i = 0u; i != count; ++i) {
        if (!metrics_get(i, &day, &weight)) continue;
        tuple_separator(sink, &first);
        sink_byte(sink, '[');
        json_uint32(sink, day);
        sink_byte(sink, ',');
        json_uint32(sink, weight);
        sink_byte(sink, ']');
    }
    sink_byte(sink, ']');
}

static void render_exercises(JsonSink *sink) {
    uint16_t index;
    uint8_t first = 1u;
    ExerciseCache exercise;
    json_text(sink, ",\"exercises\":[");
    for (index = 0u; index != EXERCISE_COUNT; ++index) {
        if (!bitmap_get(exercise_referenced, index)) continue;
        ex_load((uint8_t)index, &exercise);
        tuple_separator(sink, &first);
        sink_byte(sink, '[');
        json_uint32(sink, index);
        sink_byte(sink, ',');
        json_string(sink, exercise.name);
        sink_byte(sink, ',');
        json_uint32(sink, exercise.muscle_group);
        sink_byte(sink, ',');
        json_uint32(sink, exercise.equipment_type);
        sink_byte(sink, ',');
        json_uint32(sink, exercise.mechanic_type);
        sink_byte(sink, ',');
        json_uint32(sink, exercise.load_multiplier_centi);
        sink_byte(sink, ']');
    }
    sink_byte(sink, ']');
}

static void render_workouts(JsonSink *sink) {
    uint8_t count = workoutlog_count();
    uint8_t ordinal;
    uint8_t newest_index;
    uint8_t set;
    uint8_t first_workout = 1u;
    WorkoutLogSummary summary;
    WorkoutLogSet workout_set;
    json_text(sink, ",\"workouts\":[");
    for (ordinal = 0u; ordinal != count; ++ordinal) {
        newest_index = (uint8_t)(count - 1u - ordinal); /* oldest first */
        if (!workoutlog_get_summary(newest_index, &summary)) continue;
        tuple_separator(sink, &first_workout);
        sink_byte(sink, '[');
        json_uint32(sink, summary.day_num);
        sink_byte(sink, ',');
        json_uint32(sink, summary.volume_kg);
        json_text(sink, ",[");
        for (set = 0u; set != summary.set_count; ++set) {
            if (!workoutlog_get_set(newest_index, set, &workout_set)) continue;
            if (set != 0u) sink_byte(sink, ',');
            sink_byte(sink, '[');
            json_uint32(sink, workout_set.exercise_idx);
            sink_byte(sink, ',');
            json_uint32(sink, workout_set.reps);
            sink_byte(sink, ',');
            json_uint32(sink, workout_set.weight_kg_tenths);
            sink_byte(sink, ']');
        }
        json_text(sink, "]]");
    }
    sink_byte(sink, ']');
}

static void render_json(JsonSink *sink) {
    json_text(sink, "{\"_exportVersion\":26,\"_gameBoyExport\":1,");
    render_profile(sink);
    render_foods(sink);
    render_food_logs(sink);
    render_weights(sink);
    render_exercises(sink);
    render_workouts(sink);
    sink_byte(sink, '}');
}

static uint8_t container_byte(uint8_t offset) {
    uint32_t created = DAY_ZERO_UNIX_SECONDS + optical_mul32(export_today_day, DAY_SECONDS);
    if (offset < 4u) return (uint8_t) "MLOG"[offset];
    if (offset == 4u) return CONTAINER_VERSION;
    if (offset == 5u) return 0u;
    if (offset < 8u) return (uint8_t)(CONTAINER_EXPORT_VERSION >> ((offset - 6u) * 8u));
    if (offset < 12u) return (uint8_t)(created >> ((offset - 8u) * 8u));
    if (offset < 16u) return (uint8_t)(export_plain_len >> ((offset - 12u) * 8u));
    if (offset < 20u) return (uint8_t)(export_plain_len >> ((offset - 16u) * 8u));
    if (offset < 52u) return export_digest[offset - 20u];
    return 0u; /* no KDF, cipher, share kind, salt, or IV */
}

uint8_t optical_export_prepare(const SaveData *data, OpticalExportInfo *info) BANKED {
    JsonSink sink;
    CalDate today;
    uint8_t i;

    export_data = data;
    today = cal_current_date(data);
    export_today_day = cal_day_number(today);
    scan_references();

    optical_sha256_init(&sha_context);
    sink.mode = SINK_COUNT_SHA;
    sink.pos = 0ul;
    sink.sha = &sha_context;
    render_json(&sink);
    export_plain_len = sink.pos;
    optical_sha256_finish(&sha_context, export_digest);

    sink.mode = SINK_FNV;
    sink.pos = 0ul;
    sink.fnv = 0x811C9DC5ul;
    for (i = 0u; i != OPTICAL_CONTAINER_HEADER_LEN; ++i) {
        sink.fnv = fnv_byte(sink.fnv, container_byte(i));
        ++sink.pos;
    }
    render_json(&sink);
    export_payload_fnv = sink.fnv;

    info->plain_len = export_plain_len;
    info->total_len = export_plain_len + OPTICAL_CONTAINER_HEADER_LEN;
    info->payload_fnv = export_payload_fnv;
    info->session_id = (uint16_t)(export_payload_fnv ^ (export_payload_fnv >> 16u));
    if (info->session_id == 0u) info->session_id = 1u;
    info->block_count = (uint16_t)((info->total_len + OPTICAL_FOUNTAIN_BLOCK_LEN - 1u) /
                                   OPTICAL_FOUNTAIN_BLOCK_LEN);
    return (uint8_t)(info->block_count != 0u && info->block_count <= 512u);
}

void optical_export_xor_blocks(const uint16_t *selected, uint8_t degree, uint8_t *out) BANKED {
    JsonSink sink;
    uint8_t i;
    memset(out, 0, OPTICAL_FOUNTAIN_BLOCK_LEN);
    sink.mode = SINK_XOR;
    sink.pos = 0ul;
    sink.selected = selected;
    sink.degree = degree;
    sink.selected_cursor = 0u;
    sink.block = out;
    for (i = 0u; i != OPTICAL_CONTAINER_HEADER_LEN; ++i)
        sink_byte(&sink, container_byte(i));
    render_json(&sink);
}
