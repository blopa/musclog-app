import type { TFunction } from 'i18next';

import {
  buildFoodSearchRows,
  type FoodSearchRowsInput,
  type SourcePaging,
} from '@/components/modals/foodSearchRows';

type Food = { id: string; name?: string | null };
type MealCard = { meal: { id: string } };

const t = ((key: string) => key) as unknown as TFunction;
const foods = (prefix: string, count: number): Food[] =>
  Array.from({ length: count }, (_, i) => ({ id: `${prefix}${i}`, name: `${prefix} ${i}` }));
const done: SourcePaging = { hasMore: false, isLoadingMore: false };
const more: SourcePaging = { hasMore: true, isLoadingMore: false };

function input(
  overrides: Partial<FoodSearchRowsInput<Food, MealCard>> & {
    search?: Partial<FoodSearchRowsInput<Food, MealCard>['search']>;
  } = {}
): FoodSearchRowsInput<Food, MealCard> {
  const { search, ...rest } = overrides;
  const results = search?.results ?? {
    local: foods('l', 2),
    api: foods('o', 3),
    usda: foods('u', 2),
  };

  return {
    t,
    searchQuery: 'apple',
    activeFilter: 'all',
    favorites: { foods: [], isLoading: false, hasError: false, paging: done },
    meals: { all: [], filtered: [], isLoading: false, paging: done },
    recent: [],
    showYesterday: false,
    suggested: { title: 'Suggested', foods: null, isLoading: false },
    ...rest,
    search: {
      isInitialLoad: false,
      isLoadingLocal: false,
      isLoadingAPI: false,
      hasLocalResults: results.local.length > 0,
      hasApiResults: results.api.length + results.usda.length > 0,
      localCount: results.local.length,
      apiCount: results.api.length,
      apiError: false,
      usdaError: false,
      showCancel: false,
      firstResolvedApi: 'openfood',
      results,
      filteredCount: results.local.length + results.api.length + results.usda.length,
      paging: { local: done, openfood: done, usda: done },
      ...search,
    },
  };
}

const kinds = (rows: { kind: string }[]) => rows.map((row) => row.kind);

describe('buildFoodSearchRows: search results', () => {
  it('stacks your foods, Open Food Facts and USDA under one header, each behind a divider', () => {
    const { rows, endReached } = buildFoodSearchRows(input());
    expect(rows.filter((row) => row.kind === 'sourceDivider').map((row) => row.key)).toEqual([
      'divider-local',
      'divider-openfood',
      'divider-usda',
    ]);
    expect(rows[0]).toMatchObject({ kind: 'header', title: 'foodSearch.bestMatches' });
    expect(rows.filter((row) => row.kind === 'food')).toHaveLength(7);
    expect(endReached).toBeNull();
  });

  it('puts USDA first when it answered first', () => {
    const { rows } = buildFoodSearchRows(input({ search: { firstResolvedApi: 'usda' } }));
    expect(rows.filter((row) => row.kind === 'sourceDivider').map((row) => row.key)).toEqual([
      'divider-local',
      'divider-usda',
      'divider-openfood',
    ]);
  });

  it('pages the LAST section on scroll and gives earlier sections an inline "show more" row', () => {
    const { rows, endReached } = buildFoodSearchRows(
      input({ search: { paging: { local: more, openfood: more, usda: more } } })
    );
    expect(endReached).toBe('usda');
    expect(rows.filter((row) => row.kind === 'showMore').map((row) => row.key)).toEqual([
      'show-more-local',
      'show-more-openfood',
    ]);
    // The inline row follows its own section, before the next divider.
    const showLocal = rows.findIndex((row) => row.key === 'show-more-local');
    expect(rows[showLocal + 1]).toMatchObject({ key: 'divider-openfood' });
  });

  it('does not page on scroll while more results may still arrive below', () => {
    const { rows, endReached } = buildFoodSearchRows(
      input({ search: { isLoadingAPI: true, paging: { local: done, openfood: done, usda: more } } })
    );
    expect(endReached).toBeNull();
    expect(rows.at(-2)).toMatchObject({ key: 'show-more-usda' });
    expect(rows.at(-1)).toMatchObject({ kind: 'loading', label: 'foodSearch.searchingAPI' });
  });

  it('shows a spinner row at the tail while its next page loads', () => {
    const { rows } = buildFoodSearchRows(
      input({
        search: {
          paging: { local: done, openfood: done, usda: { hasMore: true, isLoadingMore: true } },
        },
      })
    );
    expect(rows.at(-1)).toMatchObject({ kind: 'loadingMore' });
  });

  it('shows only the picked source on a source tab', () => {
    const { rows } = buildFoodSearchRows(input({ activeFilter: 'openfood' }));
    expect(rows.filter((row) => row.kind === 'sourceDivider').map((row) => row.key)).toEqual([
      'divider-openfood',
    ]);
  });

  it('keeps the pages a source already loaded and puts its error after them', () => {
    const { rows } = buildFoodSearchRows(
      input({
        search: { usdaError: true, results: { local: [], api: [], usda: foods('u', 2) } },
      })
    );
    expect(kinds(rows)).toEqual(['header', 'sourceDivider', 'food', 'food', 'sourceError']);
  });

  it('shows the error row alone when a source failed before any results', () => {
    const { rows } = buildFoodSearchRows(
      input({
        search: {
          apiError: true,
          results: { local: [], api: [], usda: foods('u', 1) },
        },
      })
    );
    expect(kinds(rows)).toEqual([
      'header',
      'sourceDivider',
      'sourceError',
      'sourceDivider',
      'food',
    ]);
  });

  it('shows one large spinner during the first load', () => {
    const { rows } = buildFoodSearchRows(
      input({ search: { isInitialLoad: true, isLoadingLocal: true, isLoadingAPI: true } })
    );
    expect(kinds(rows)).toEqual(['header', 'loading']);
    expect(rows[1]).toMatchObject({ size: 'large', label: 'foodSearch.searchingLocalAndAPI' });
  });

  it('says nothing matched once every source is done', () => {
    const { rows } = buildFoodSearchRows(
      input({ search: { results: { local: [], api: [], usda: [] }, filteredCount: 0 } })
    );
    expect(rows.at(-1)).toMatchObject({
      kind: 'message',
      text: 'foodSearch.noResultsFor',
      hint: 'foodSearch.trySomethingElse',
    });
  });

  it('gives every row a unique key, even when sources share an id', () => {
    const same = [{ id: 'x', name: 'x' }];
    const { rows } = buildFoodSearchRows(
      input({ search: { results: { local: same, api: same, usda: same }, filteredCount: 3 } })
    );
    const keys = rows.map((row) => row.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('filters meals on the meals tab instead of searching foods', () => {
    const meal = { meal: { id: 'm1' } };
    const { rows, endReached } = buildFoodSearchRows(
      input({
        activeFilter: 'meals',
        meals: { all: [meal], filtered: [meal], isLoading: false, paging: more },
      })
    );
    expect(kinds(rows)).toEqual(['header', 'meal']);
    // A search filters the loaded meals client-side; it does not page.
    expect(endReached).toBeNull();
  });
});

describe('buildFoodSearchRows: browsing without a query', () => {
  const browse = (overrides: Partial<FoodSearchRowsInput<Food, MealCard>>) =>
    buildFoodSearchRows(input({ searchQuery: '', ...overrides }));

  it('pages favorites on scroll', () => {
    const { rows, endReached } = browse({
      activeFilter: 'myFoods',
      favorites: { foods: foods('f', 10), isLoading: false, hasError: false, paging: more },
    });
    expect(endReached).toBe('favorites');
    expect(rows.some((row) => row.kind === 'showMore')).toBe(false);
  });

  it('pages saved meals on scroll', () => {
    const { endReached } = browse({
      activeFilter: 'meals',
      meals: { all: [{ meal: { id: 'm' } }], filtered: [], isLoading: false, paging: more },
    });
    expect(endReached).toBe('meals');
  });

  it('lists recent foods, the same-as-yesterday card and suggestions on All', () => {
    const { rows, endReached } = browse({
      recent: foods('r', 2),
      showYesterday: true,
      suggested: { title: 'Suggested', foods: foods('r', 1), isLoading: false },
    });
    expect(kinds(rows)).toEqual(['header', 'food', 'food', 'yesterday', 'header', 'food']);
    expect(rows[0]).toMatchObject({ action: 'viewAllRecent' });
    expect(endReached).toBeNull();
  });

  it('explains an empty favorites list or a failed load', () => {
    expect(browse({ activeFilter: 'myFoods' }).rows.at(-1)).toMatchObject({
      text: 'foodSearch.noFavoriteFoods',
    });
    expect(
      browse({
        activeFilter: 'myFoods',
        favorites: { foods: [], isLoading: false, hasError: true, paging: done },
      }).rows.at(-1)
    ).toMatchObject({ text: 'foodSearch.loadFavoritesError' });
  });
});
