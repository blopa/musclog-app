#ifndef MUSCLOG_NUTRITION_DETAIL_H
#define MUSCLOG_NUTRITION_DETAIL_H

#include "database.h"
#include <gb/gb.h>
#include <stdint.h>

uint8_t nutrition_show_food_detail(SaveData *data, uint16_t day_num, uint8_t nth) BANKED;

#endif /* MUSCLOG_NUTRITION_DETAIL_H */
