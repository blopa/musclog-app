import { getBlogPaginationItems } from '../blogPagination';

describe('getBlogPaginationItems', () => {
  it('shows every page when the list is short', () => {
    expect(getBlogPaginationItems(2, 3)).toEqual([1, 2, 3]);
    expect(getBlogPaginationItems(4, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('keeps large page lists compact around the beginning, middle, and end', () => {
    expect(getBlogPaginationItems(2, 50)).toEqual([1, 2, 3, 4, 5, 'end-ellipsis', 50]);
    expect(getBlogPaginationItems(25, 50)).toEqual([
      1,
      'start-ellipsis',
      24,
      25,
      26,
      'end-ellipsis',
      50,
    ]);
    expect(getBlogPaginationItems(49, 50)).toEqual([1, 'start-ellipsis', 46, 47, 48, 49, 50]);
  });

  it('rejects impossible pagination state', () => {
    expect(() => getBlogPaginationItems(0, 3)).toThrow('Invalid blog pagination state');
    expect(() => getBlogPaginationItems(4, 3)).toThrow('Invalid blog pagination state');
  });
});
