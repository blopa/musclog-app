import type { TFunction } from 'i18next';

/**
 * The food search modal's content as one flat list of rows, so it renders in a virtualized
 * `FlatList` instead of a `ScrollView` + `.map()` per section. Pure (no React Native imports) so
 * the section and paging rules run in the Jest `node` project.
 *
 * Paging: a search stacks up to three independently paginated sources (your foods, Open Food Facts,
 * USDA). Only the LAST section can page on scroll — the end of a middle section is never the end of
 * the list, and inserting rows above the viewport would shift what the user is reading. So the tail
 * section is returned as `endReached` (the screen loads it from `onEndReached`), and every earlier
 * section that has more gets an inline `showMore` row instead.
 */

export type PagedSource = 'local' | 'openfood' | 'usda' | 'favorites' | 'meals';
export type ResultSource = 'local' | 'openfood' | 'usda';
export type FoodSearchFilter = 'all' | 'myFoods' | 'openfood' | 'usda' | 'meals';

type FoodLike = { id: string; name?: string | null };
type MealLike = { meal: { id: string } };

/** How the card draws a food's icon: by the source it came from in a search, or as stored. */
export type FoodRowDecoration = 'local' | 'api' | 'usda' | 'plain';

export type FoodSearchRow<TFood extends FoodLike, TMeal extends MealLike> =
  | {
      kind: 'header';
      key: string;
      title: string;
      icon?: 'suggested';
      action?: 'viewAllRecent';
    }
  | { kind: 'sourceDivider'; key: string; source: ResultSource; label: string }
  | { kind: 'food'; key: string; food: TFood; decoration: FoodRowDecoration }
  | { kind: 'meal'; key: string; mealData: TMeal }
  | { kind: 'sourceError'; key: string; source: 'openfood' | 'usda' }
  | { kind: 'loading'; key: string; size: 'large' | 'small'; label?: string; cancellable: boolean }
  | { kind: 'message'; key: string; text: string; hint?: string }
  | { kind: 'showMore'; key: string; source: ResultSource; label: string; loading: boolean }
  | { kind: 'loadingMore'; key: string }
  | { kind: 'yesterday'; key: string };

type Paging = { source: PagedSource; hasMore: boolean; isLoadingMore: boolean };

export type SourcePaging = { hasMore: boolean; isLoadingMore: boolean };

export type FoodSearchRowsInput<TFood extends FoodLike, TMeal extends MealLike> = {
  t: TFunction;
  searchQuery: string;
  activeFilter: FoodSearchFilter;
  search: {
    isInitialLoad: boolean;
    isLoadingLocal: boolean;
    isLoadingAPI: boolean;
    hasLocalResults: boolean;
    hasApiResults: boolean;
    localCount: number;
    apiCount: number;
    apiError: boolean;
    usdaError: boolean;
    showCancel: boolean;
    firstResolvedApi: ResultSource | null | undefined;
    results: { local: TFood[]; api: TFood[]; usda: TFood[] };
    /** The results the active tab counts (`all` for the All tab, one source otherwise). */
    filteredCount: number;
    paging: Record<ResultSource, SourcePaging>;
  };
  favorites: { foods: TFood[]; isLoading: boolean; hasError: boolean; paging: SourcePaging };
  meals: { all: TMeal[]; filtered: TMeal[]; isLoading: boolean; paging: SourcePaging };
  recent: TFood[];
  showYesterday: boolean;
  suggested: { title: string; foods: TFood[] | null; isLoading: boolean };
};

export type FoodSearchRows<TFood extends FoodLike, TMeal extends MealLike> = {
  rows: FoodSearchRow<TFood, TMeal>[];
  /** The source `onEndReached` loads, or `null` when the list's tail has no more pages. */
  endReached: PagedSource | null;
};

type Section<TFood extends FoodLike, TMeal extends MealLike> = {
  rows: FoodSearchRow<TFood, TMeal>[];
  paging?: Paging;
};

/**
 * Only the search sources can sit above another section. Favorites and meals are always the only
 * paged section on their tab, so they always page on scroll and never show this row.
 */
const SHOW_MORE_KEYS: Record<ResultSource, string> = {
  local: 'foodSearch.loadMoreLocal',
  openfood: 'foodSearch.loadMoreAPI',
  usda: 'foodSearch.loadMoreUSDA',
};

const isResultSource = (source: PagedSource): source is ResultSource => source in SHOW_MORE_KEYS;

export function searchSectionTitle(
  isInitialLoad: boolean,
  hasLocalResults: boolean,
  hasApiResults: boolean,
  isLoadingAPI: boolean,
  t: TFunction
): string {
  if (isInitialLoad) {
    return t('foodSearch.searching');
  }

  if (hasLocalResults || hasApiResults || isLoadingAPI) {
    return t('foodSearch.bestMatches');
  }

  return t('foodSearch.noResults');
}

export function searchingStatusText(
  isLoadingLocal: boolean,
  isLoadingAPI: boolean,
  t: TFunction
): string {
  if (isLoadingLocal && isLoadingAPI) {
    return t('foodSearch.searchingLocalAndAPI');
  }

  if (isLoadingLocal) {
    return t('foodSearch.searchingLocal');
  }

  return t('foodSearch.searchingAPI');
}

function foodRows<TFood extends FoodLike, TMeal extends MealLike>(
  prefix: string,
  foods: TFood[],
  decoration: FoodRowDecoration
): FoodSearchRow<TFood, TMeal>[] {
  return foods.map((food) => ({
    kind: 'food' as const,
    key: `${prefix}-${food.id}`,
    food: decoration === 'local' ? { ...food, name: food.name ?? '' } : food,
    decoration,
  }));
}

function mealRows<TFood extends FoodLike, TMeal extends MealLike>(
  meals: TMeal[]
): FoodSearchRow<TFood, TMeal>[] {
  return meals.map((mealData) => ({
    kind: 'meal' as const,
    key: `meal-${mealData.meal.id}`,
    mealData,
  }));
}

function searchSections<TFood extends FoodLike, TMeal extends MealLike>(
  input: FoodSearchRowsInput<TFood, TMeal>
): Section<TFood, TMeal>[] {
  const { t, searchQuery, activeFilter, search, meals } = input;

  if (activeFilter === 'meals') {
    const header: FoodSearchRow<TFood, TMeal> = {
      kind: 'header',
      key: 'header-meals',
      title: t('foodSearch.filters.meals'),
    };
    if (meals.isLoading) {
      return [
        {
          rows: [
            header,
            { kind: 'loading', key: 'loading-meals', size: 'small', cancellable: false },
          ],
        },
      ];
    }

    return [
      {
        rows: [
          header,
          ...(meals.filtered.length > 0
            ? mealRows<TFood, TMeal>(meals.filtered)
            : [
                {
                  kind: 'message' as const,
                  key: 'no-meal-results',
                  text: t('foodSearch.noResultsFor', { query: searchQuery }),
                  hint: t('foodSearch.trySomethingElse'),
                },
              ]),
        ],
      },
    ];
  }

  const sections: Section<TFood, TMeal>[] = [
    {
      rows: [
        {
          kind: 'header',
          key: 'header-search',
          title: searchSectionTitle(
            search.isInitialLoad,
            search.hasLocalResults,
            search.hasApiResults,
            search.isLoadingAPI,
            t
          ),
        },
      ],
    },
  ];

  if (search.isInitialLoad) {
    sections.push({
      rows: [
        {
          kind: 'loading',
          key: 'loading-search',
          size: 'large',
          label: searchingStatusText(search.isLoadingLocal, search.isLoadingAPI, t),
          cancellable: search.showCancel,
        },
      ],
    });

    return sections;
  }

  const { results, paging } = search;
  if (search.filteredCount > 0 || search.apiError || search.usdaError) {
    if ((activeFilter === 'all' || activeFilter === 'myFoods') && results.local.length > 0) {
      sections.push({
        rows: [
          {
            kind: 'sourceDivider',
            key: 'divider-local',
            source: 'local',
            label: t('foodSearch.yourFoods', { count: results.local.length }),
          },
          ...foodRows<TFood, TMeal>('local', results.local, 'local'),
        ],
        paging: { source: 'local', ...paging.local },
      });
    }

    // Open Food Facts and USDA, ordered by whichever answered first.
    const apiOrder: ('openfood' | 'usda')[] =
      search.firstResolvedApi === 'usda' ? ['usda', 'openfood'] : ['openfood', 'usda'];
    for (const source of apiOrder) {
      const foods = source === 'openfood' ? results.api : results.usda;
      const error = source === 'openfood' ? search.apiError : search.usdaError;
      if (!(activeFilter === 'all' || activeFilter === source) || (foods.length === 0 && !error)) {
        continue;
      }

      sections.push({
        rows: [
          {
            kind: 'sourceDivider',
            key: `divider-${source}`,
            source,
            label: t(source === 'openfood' ? 'foodSearch.openFoodFacts' : 'foodSearch.usda', {
              count: foods.length,
            }),
          },
          ...foodRows<TFood, TMeal>(source, foods, source === 'openfood' ? 'api' : 'usda'),
          // The error is for the page that failed (Retry refetches it), so the pages already
          // loaded stay on screen above it. Paging on scroll makes a late failure likely, and
          // replacing 20 results with an error card threw away what the user was reading.
          ...(error ? [{ kind: 'sourceError' as const, key: `error-${source}`, source }] : []),
        ],
        paging: { source, ...paging[source] },
      });
    }
  }

  if (search.isLoadingAPI) {
    sections.push({
      rows: [
        {
          kind: 'loading',
          key: 'loading-api',
          size: 'small',
          label: t('foodSearch.searchingAPI'),
          cancellable: search.showCancel,
        },
      ],
    });
  } else if (
    !search.apiError &&
    !search.usdaError &&
    search.filteredCount === 0 &&
    searchQuery.trim()
  ) {
    sections.push({
      rows: [
        {
          kind: 'message',
          key: 'no-results',
          text: t('foodSearch.noResultsFor', { query: searchQuery }),
          hint:
            search.localCount === 0 && search.apiCount === 0
              ? t('foodSearch.trySomethingElse')
              : undefined,
        },
      ],
    });
  }

  return sections;
}

function browseSections<TFood extends FoodLike, TMeal extends MealLike>(
  input: FoodSearchRowsInput<TFood, TMeal>
): Section<TFood, TMeal>[] {
  const { t, activeFilter, favorites, meals, recent, suggested } = input;

  if (activeFilter === 'myFoods') {
    const header: FoodSearchRow<TFood, TMeal> = {
      kind: 'header',
      key: 'header-favorites',
      title: t('foodSearch.yourFavoriteFoods'),
    };
    if (favorites.isLoading) {
      return [
        {
          rows: [
            header,
            { kind: 'loading', key: 'loading-favorites', size: 'small', cancellable: false },
          ],
        },
      ];
    }

    if (favorites.hasError || favorites.foods.length === 0) {
      return [
        {
          rows: [
            header,
            {
              kind: 'message',
              key: 'favorites-message',
              text: t(
                favorites.hasError ? 'foodSearch.loadFavoritesError' : 'foodSearch.noFavoriteFoods'
              ),
            },
          ],
        },
      ];
    }

    return [
      {
        rows: [header, ...foodRows<TFood, TMeal>('favorite', favorites.foods, 'plain')],
        paging: { source: 'favorites', ...favorites.paging },
      },
    ];
  }

  if (activeFilter === 'meals') {
    const header: FoodSearchRow<TFood, TMeal> = {
      kind: 'header',
      key: 'header-meals',
      title: t('foodSearch.filters.meals'),
    };
    if (meals.isLoading) {
      return [
        {
          rows: [
            header,
            {
              kind: 'loading',
              key: 'loading-meals',
              size: 'small',
              label: t('foodSearch.loadingMeals'),
              cancellable: false,
            },
          ],
        },
      ];
    }

    if (meals.all.length === 0) {
      return [
        {
          rows: [header, { kind: 'message', key: 'no-meals', text: t('foodSearch.noMeals') }],
        },
      ];
    }

    return [
      {
        rows: [header, ...mealRows<TFood, TMeal>(meals.all)],
        paging: { source: 'meals', ...meals.paging },
      },
    ];
  }

  const sections: Section<TFood, TMeal>[] = [
    {
      rows: [
        {
          kind: 'header',
          key: 'header-recent',
          title: t('foodSearch.recentHistory'),
          action: 'viewAllRecent',
        },
        ...(recent.length > 0
          ? foodRows<TFood, TMeal>('recent', recent, 'plain')
          : [{ kind: 'message' as const, key: 'no-recent', text: t('foodSearch.noRecentFoods') }]),
        ...(activeFilter === 'all' && input.showYesterday
          ? [{ kind: 'yesterday' as const, key: 'yesterday' }]
          : []),
      ],
    },
  ];

  if (suggested.foods && suggested.foods.length > 0) {
    sections.push({
      rows: [
        { kind: 'header', key: 'header-suggested', title: suggested.title, icon: 'suggested' },
        ...(suggested.isLoading
          ? [
              {
                kind: 'loading' as const,
                key: 'loading-suggested',
                size: 'small' as const,
                cancellable: false,
              },
            ]
          : foodRows<TFood, TMeal>('suggested', suggested.foods, 'plain')),
      ],
    });
  }

  return sections;
}

export function buildFoodSearchRows<TFood extends FoodLike, TMeal extends MealLike>(
  input: FoodSearchRowsInput<TFood, TMeal>
): FoodSearchRows<TFood, TMeal> {
  const sections = input.searchQuery ? searchSections(input) : browseSections(input);
  const last = sections.length - 1;
  const rows: FoodSearchRow<TFood, TMeal>[] = [];
  let endReached: PagedSource | null = null;

  sections.forEach((section, index) => {
    rows.push(...section.rows);
    const { paging } = section;
    if (!paging?.hasMore) {
      return;
    }

    if (index === last || !isResultSource(paging.source)) {
      endReached = paging.source;
      if (paging.isLoadingMore) {
        rows.push({ kind: 'loadingMore', key: `loading-more-${paging.source}` });
      }
    } else {
      rows.push({
        kind: 'showMore',
        key: `show-more-${paging.source}`,
        source: paging.source,
        label: input.t(
          paging.isLoadingMore ? 'foodSearch.loadingMore' : SHOW_MORE_KEYS[paging.source]
        ),
        loading: paging.isLoadingMore,
      });
    }
  });

  return { rows, endReached };
}
