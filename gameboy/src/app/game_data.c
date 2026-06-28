#pragma bank 1

#include "game_data.h"

#include "custom_foods.h"
#include "foodlog.h"
#include "metrics.h"
#include "profile.h"
#include "workoutlog.h"

void game_data_erase_all(void) BANKED {
    db_erase();
    foodlog_erase();
    workoutlog_erase();
    metrics_erase();
    custom_foods_erase();
}
