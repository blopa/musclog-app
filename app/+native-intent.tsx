export function redirect({ path, query }: { path: string; query: Record<string, string | string[]> }) {
  if (query.action === 'open-camera') {
    return '/nutrition/ai-camera';
  }

  if (query.action === 'open-nutrition') {
    return '/nutrition/food';
  }

  if (query.action === 'open-nutrition-checkin') {
    if (query.id) {
        return {
            pathname: '/nutrition/checkin-review',
            params: { id: query.id }
        };
    }
    return '/nutrition/checkin';
  }

  return path;
}
