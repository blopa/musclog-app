export type BlogPaginationItem = number | 'start-ellipsis' | 'end-ellipsis';

const MAX_VISIBLE_PAGE_ITEMS = 7;

function pageRange(start: number, end: number): number[] {
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

export function getBlogPaginationItems(
  currentPage: number,
  totalPages: number
): BlogPaginationItem[] {
  if (
    !Number.isInteger(currentPage) ||
    !Number.isInteger(totalPages) ||
    currentPage < 1 ||
    totalPages < 1 ||
    currentPage > totalPages
  ) {
    throw new Error('Invalid blog pagination state');
  }

  if (totalPages <= MAX_VISIBLE_PAGE_ITEMS) {
    return pageRange(1, totalPages);
  }

  if (currentPage <= 4) {
    return [1, 2, 3, 4, 5, 'end-ellipsis', totalPages];
  }

  if (currentPage >= totalPages - 3) {
    return [1, 'start-ellipsis', ...pageRange(totalPages - 4, totalPages)];
  }

  return [
    1,
    'start-ellipsis',
    currentPage - 1,
    currentPage,
    currentPage + 1,
    'end-ellipsis',
    totalPages,
  ];
}
