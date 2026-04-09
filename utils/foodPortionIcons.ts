import {
  Apple,
  Coffee,
  Croissant,
  Droplet,
  Egg,
  Flame,
  Lightbulb,
  Popcorn,
  Scale,
  Soup,
  UtensilsCrossed,
  Wind,
} from 'lucide-react-native';
import type { ComponentType } from 'react';

/** Lucide components for `FoodPortion.icon` string ids (seed + user portions). */
const FOOD_PORTION_ICON_MAP: Record<string, ComponentType<any>> = {
  droplet: Droplet,
  scale: Scale,
  egg: Egg,
  cup: Popcorn,
  flame: Flame,
  lightbulb: Lightbulb,
  wind: Wind,
  restaurant: UtensilsCrossed,
  'ramen-dining': Soup,
  'dinner-dining': UtensilsCrossed,
  'bakery-dining': Croissant,
  'local-cafe': Coffee,
  nutrition: Apple,
};

export function getFoodPortionIconComponent(iconName?: string | null): ComponentType<any> | null {
  if (!iconName) {
    return null;
  }

  return FOOD_PORTION_ICON_MAP[iconName] ?? null;
}
