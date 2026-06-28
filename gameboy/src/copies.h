#ifndef MUSCLOG_COPIES_H
#define MUSCLOG_COPIES_H

/* ── App identity ──────────────────────────────────────────────────────── */
#define STR_APP_NAME   "MUSCLOG"
#define STR_APP_TITLE  "MUSCLOG GB"

/* ── Common UI divider ─────────────────────────────────────────────────── */
#define STR_DIVIDER    "--------------------"

/* ── Macro nutrient labels ─────────────────────────────────────────────── */
#define STR_CALORIES  "CALORIES"
#define STR_PROTEIN   "PROTEIN"
#define STR_CARBS     "CARBS"
#define STR_FAT       "FAT"
#define STR_FIBER     "FIBER"

/* ── Footer / navigation prompts ──────────────────────────────────────── */
#define STR_FOOTER_BACK      "B BACK"
#define STR_FOOTER_CANCEL    "B CANCEL"
#define STR_FOOTER_SKIP      "B SKIP"
#define STR_FOOTER_DEL       "B DEL"
#define STR_FOOTER_EDIT      "B EDIT"
#define STR_FOOTER_OK        "A/ST OK"
#define STR_FOOTER_NEXT      "A/ST NEXT"
#define STR_FOOTER_SAVE      "A/ST SAVE"
#define STR_FOOTER_TRACK     "A/ST TRACK"
#define STR_FOOTER_PICK      "A/ST PICK"
#define STR_FOOTER_DONE      "ST DONE"
#define STR_FOOTER_SEL_MENU  "SEL MENU"
#define STR_FOOTER_SEL_DEL   "SEL DEL"
#define STR_FOOTER_RESET     "SEL+B RESET"

/* ── Hint prompts ──────────────────────────────────────────────────────── */
#define STR_HINT_FIELD_SET        "UP/DN FIELD  L/R SET"
#define STR_HINT_CHANGE           "UP/DOWN CHANGE"
#define STR_HINT_STEP_10          "UP/DN 10"
#define STR_HINT_STEP_1           "UP/DN 1"
#define STR_HINT_LEFT_RIGHT_FAST  "LEFT/RIGHT FAST"
#define STR_HINT_TYPING           "UP/DN A=ADD ST=DONE"
#define STR_HINT_PICK             "UP/DN PICK  B EDIT"
#define STR_HINT_AMOUNT           "UP/DN  L/R FAST"

/* ── Home screen ───────────────────────────────────────────────────────── */
#define STR_HOME          "HOME"
#define STR_NUTRITION     "NUTRITION"
#define STR_WORKOUTS      "WORKOUTS"
#define STR_BODY_WEIGHT   "BODY WEIGHT"

/* ── Start screen ──────────────────────────────────────────────────────── */
#define STR_CONTINUE     "CONTINUE"      /* menu label (distinct from STR_FOOTER_CONTINUE) */
#define STR_NEW_GAME     "NEW GAME"
#define STR_NEW_GAME_Q   "ERASE ALL DATA?"   /* confirm message; 15 chars, fits centered */
#define STR_START_YESNO  "A=YES  B=NO"       /* confirm hint; 11 chars, fits centered */

/* ── Start-screen Options sub-screen (SFX / soundtrack toggles) ─────────── */
#define STR_OPTIONS       "OPTIONS"
#define STR_OPTIONS_TITLE "- OPTIONS -"   /* centered title; 11 chars */
#define STR_SFX           "SFX"
#define STR_MUSIC         "MUSIC"
#define STR_ON            "ON"
#define STR_OFF           "OFF"
#define STR_OPT_BACK_HINT "B=BACK"        /* hint; matches the A=YES B=NO style */

/* ── Home SELECT menu ──────────────────────────────────────────────────── */
#define STR_MENU          "MENU"
#define STR_SETTINGS      "SETTINGS"
#define STR_ABOUT         "ABOUT"
#define STR_RESET_DATA    "RESET DATA"
#define STR_RESET_DATA_Q  "ERASE ALL DATA?"

/* ── About screen ──────────────────────────────────────────────────────── */
#define STR_ABOUT_L1   "MUSCLOG GB IS A"
#define STR_ABOUT_L2   "POCKET PORT OF THE"
#define STR_ABOUT_L3   "MUSCLOG APP."
#define STR_ABOUT_L4   "FOR THE FULL"
#define STR_ABOUT_L5   "EXPERIENCE VISIT"
#define STR_ABOUT_URL  "https://musclog.app/"

/* ── Settings screen ───────────────────────────────────────────────────── */
#define STR_UNITS         "UNITS"
#define STR_SEX           "SEX"
#define STR_ACTIVITY      "ACTIVITY"
#define STR_EXP           "EXP"          /* short row label; full word is STR_EXPERIENCE */
#define STR_ACT_VERY      "V.ACTIVE"     /* short row value; full is STR_ACTIVITY_VERY_ACTIVE */
#define STR_HINT_LR_EDIT  "L/R CHANGE"

/* ── Body-weight tracking ──────────────────────────────────────────────── */
#define STR_LOG_WEIGHT    "LOG WEIGHT"
#define STR_CURRENT       "CURRENT"
#define STR_MIN           "MIN"
#define STR_MAX           "MAX"
#define STR_TREND         "TREND"
#define STR_NO_DATA       "NO DATA"
#define STR_FOOTER_LOG    "A/ST LOG"
#define STR_NEW_ENTRY     "NEW ENTRY"

/* ── Workout tracking ─────────────────────────────────────────────────── */
#define STR_START_WORKOUT "START WORKOUT"
#define STR_FREE_SESSION  "FREE SESSION"
#define STR_SELECT_EXERCISE "SELECT EXERCISE"
#define STR_FILTER        "FILTER"
#define STR_ALL           "ALL"
#define STR_SETS          "SETS"
#define STR_REPS          "REPS"
#define STR_SET_OPTIONS   "SET OPTIONS"
#define STR_EDIT_SET      "EDIT SET"
#define STR_SAVE_SET      "SAVE SET"
#define STR_EX_OVERVIEW   "EX OVERVIEW"
#define STR_NEXT_EXERCISE "NEXT EXERCISE"
#define STR_END_WORKOUT   "END WORKOUT"
#define STR_WELL_DONE     "WELL DONE!"
#define STR_ADD_EXERCISE  "ADD EXERCISE"
#define STR_FINISH_WORKOUT "FINISH WORKOUT"
#define STR_WORKOUT_DONE   "WORKOUT DONE"
#define STR_WORKOUT_DETAIL "WORKOUT DETAIL"
#define STR_EXERCISES      "EXERCISES"
#define STR_VOLUME         "VOLUME"
#define STR_REPS_SHORT     "REPS"
#define STR_FOOTER_CONTINUE "A/ST CONTINUE"
#define STR_REST          "REST"
#define STR_NO_EXERCISES  "NO EXERCISES"
#define STR_HINT_FILTER   "<-/-> FILTER"
#define STR_HINT_EDIT_ROW "UP/DN FIELD L/R EDIT"
#define STR_HINT_SET_OPTIONS "SEL OPTIONS"
#define STR_HINT_SAVE_SET "A/ST SAVE SET"
#define STR_HINT_REST_SKIP "A/ST SKIP"
#define STR_FOOTER_SKIP_TIMER "A/ST SKIP"
#define STR_THIS_WEEK     "THIS WEEK"
#define STR_AVG           "AVG"
#define STR_VOL           "VOL"
#define STR_DONE          "DONE"

/* ── Progress dashboard ────────────────────────────────────────────────── */
#define STR_PROGRESS      "PROGRESS"
#define STR_SUMMARY       "SUMMARY"
#define STR_MUSCLES       "MUSCLES"
#define STR_LOGGED        "LOGGED"
#define STR_DAYS          "DAYS"
#define STR_AVG_PER_DAY   "AVG / DAY"
#define STR_RANGE_7       "7D"
#define STR_RANGE_30      "30D"
#define STR_LBL_CAL       "CAL"
#define STR_LBL_PRO       "PRO"
#define STR_LBL_CARB      "CARB"
#define STR_LBL_FAT       "FAT"
#define STR_PER_DAY       "/DAY"
#define STR_FOOTER_PROG   "<>PAGE ^vRNG"

/* ── Coming soon ───────────────────────────────────────────────────────── */
#define STR_COMING_SOON   "COMING SOON"
#define STR_COMING_IN_A   "COMING IN A"
#define STR_FUTURE_UPDATE "FUTURE UPDATE"

/* ── Onboarding: welcome / setup ───────────────────────────────────────── */
#define STR_LETS_START      "LET'S START"
#define STR_UNIT_SYSTEM     "UNIT SYSTEM"
#define STR_BIOLOGICAL_SEX  "BIOLOGICAL SEX"
#define STR_ACTIVITY_LEVEL  "ACTIVITY LEVEL"
#define STR_METRIC          "METRIC"
#define STR_IMPERIAL        "IMP"

/* ── Onboarding: gender ────────────────────────────────────────────────── */
#define STR_MALE    "MALE"
#define STR_FEMALE  "FEMALE"
#define STR_OTHER   "OTHER"

/* ── Onboarding: activity levels ───────────────────────────────────────── */
#define STR_ACTIVITY_LOW         "LOW"
#define STR_ACTIVITY_LIGHT       "LIGHT"
#define STR_ACTIVITY_MODERATE    "MODERATE"
#define STR_ACTIVITY_ACTIVE      "ACTIVE"
#define STR_ACTIVITY_VERY_ACTIVE "VERY ACTIVE"

/* ── Onboarding: experience options ────────────────────────────────────── */
#define STR_BEGINNER     "BEGINNER"
#define STR_INTERMEDIATE "INTERMEDIATE"
#define STR_ADVANCED     "ADVANCED"

/* ── Onboarding: fitness focus ─────────────────────────────────────────── */
#define STR_MUSCLE    "MUSCLE"
#define STR_STRENGTH  "STRENGTH"
#define STR_ENDURANCE "ENDURANCE"
#define STR_GENERAL   "GENERAL"

/* ── Onboarding: weight goal ───────────────────────────────────────────── */
#define STR_LOSE     "LOSE"
#define STR_MAINTAIN "MAINTAIN"
#define STR_GAIN     "GAIN"

/* ── Onboarding: review ────────────────────────────────────────────────── */
#define STR_REVIEW       "REVIEW"
#define STR_SAVE_PROFILE "SAVE PROFILE"
#define STR_EDIT_TARGETS "EDIT TARGETS"

/* ── Onboarding: measurement screens ──────────────────────────────────── */
#define STR_AGE         "AGE"
#define STR_YOUR_AGE    "YOUR AGE"
#define STR_HEIGHT      "HEIGHT"
#define STR_YOUR_HEIGHT "YOUR HEIGHT"
#define STR_WEIGHT      "WEIGHT"
#define STR_YOUR_WEIGHT "YOUR WEIGHT"
#define STR_EXPERIENCE  "EXPERIENCE"
#define STR_FOCUS       "FOCUS"
#define STR_GOAL        "GOAL"

/* ── Onboarding: edit macro targets ───────────────────────────────────── */
#define STR_EDIT_CAL   "EDIT CAL"
#define STR_EDIT_PRO   "EDIT PRO"
#define STR_EDIT_CARB  "EDIT CARB"
#define STR_EDIT_FAT   "EDIT FAT"
#define STR_EDIT_FIBER "EDIT FIBER"

/* ── Onboarding: box-drawing borders ──────────────────────────────────── */
#define STR_BOX_BORDER "+------------------+"
#define STR_BOX_EMPTY  "|                  |"
#define STR_BOX_SPLIT  "|        |         |"

/* ── Nutrition / food tracking ─────────────────────────────────────────── */
#define STR_TRACK_FOOD    "TRACK FOOD"
#define STR_GO_TO_DATE    "GO TO DATE"
#define STR_SELECT_DATE   "SELECT DATE"
#define STR_FOOD_DETAIL   "FOOD DETAIL"
#define STR_SERVING       "SERVING"
#define STR_DELETE_FOOD   "DELETE FOOD"
#define STR_DELETE_FOOD_Q "DELETE FOOD?"
#define STR_NAME_LABEL    "NAME:"
#define STR_NO_MATCHES    "NO MATCHES"
#define STR_AMOUNT        "AMOUNT"
#define STR_TRACK_FOOD_Q  "TRACK FOOD?"
#define STR_TRACKED       "TRACKED"
#define STR_FOOD_TRACKED  "FOOD TRACKED!"

/* ── Custom foods ──────────────────────────────────────────────────────────── */
#define STR_CUSTOM_FOODS  "CUSTOM FOODS"
#define STR_NEW_FOOD      "NEW FOOD"
#define STR_MY_FOODS      "MY FOODS"
#define STR_NO_CUSTOM     "NO CUSTOM FOODS"
#define STR_CAL_100       "CAL/100G"
#define STR_CARB_100      "CARB/100G"
#define STR_FIB_100       "FIBER/100G"
#define STR_FAT_100       "FAT/100G"
#define STR_PRO_100       "PROTEIN/100G"
#define STR_HINT_MACRO    "UP/DN/LR  A NEXT"
#define STR_FOOTER_SAVE_ST "ST SAVE"
#define STR_FOOD_SAVED    "FOOD SAVED!"
#define STR_FOODS_FULL    "STORAGE FULL"

/* ── Date / time picker labels ─────────────────────────────────────────── */
#define STR_YEAR   "YEAR"
#define STR_MONTH  "MONTH"
#define STR_DAY    "DAY"
#define STR_HOUR   "HOUR"
#define STR_MINUTE "MINUTE"

/* ── RTC / clock setup ─────────────────────────────────────────────────── */
#define STR_SET_DATE_TIME "SET DATE & TIME"

#endif /* MUSCLOG_COPIES_H */
