export interface PaginationParams {
  page: number;
  limit: number;
  skip: number;
  take: number;
}

export interface PaginatedResult<T> {
  items: T[];
  pagination: {
    totalCount: number;
    totalPages: number;
    currentPage: number;
    pageSize: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

const ALLOWED_LIMITS = [5, 10, 20, 50];

export function parsePaginationParams(query: Record<string, unknown>): PaginationParams {
  const rawPage = parseInt(String(query.page ?? '1'), 10);
  const rawLimit = parseInt(String(query.limit ?? '10'), 10);

  const page = Math.max(1, Number.isNaN(rawPage) ? 1 : rawPage);
  let limit = Number.isNaN(rawLimit) ? 10 : rawLimit;

  if (!ALLOWED_LIMITS.includes(limit)) {
    limit = 10;
  }

  return {
    page,
    limit,
    skip: (page - 1) * limit,
    take: limit,
  };
}

export function buildPaginatedResponse<T>(
  items: T[],
  totalCount: number,
  { page, limit }: PaginationParams
): PaginatedResult<T> {
  const totalPages = Math.max(1, Math.ceil(totalCount / limit));

  return {
    items,
    pagination: {
      totalCount,
      totalPages,
      currentPage: page,
      pageSize: limit,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
  };
}
