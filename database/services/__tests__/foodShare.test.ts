import { database } from '@/database/database-instance';
import { buildFoodShareEnvelope, buildFoodSharePayload } from '@/database/share/buildFoodShare';
import { createThumbnail } from '@/utils/file';
import {
  OPTICAL_EXPORT_VERSION_SHARE,
  OPTICAL_PAYLOAD_KIND_SHARE,
} from '@/utils/optical/container';
import { parseShareEnvelope } from '@/utils/share/shareEnvelope';

jest.mock('@/database/database-instance', () => ({ database: { get: jest.fn() } }));

jest.mock('@/utils/file', () => ({
  createThumbnail: jest.fn(async () => ({
    base64: 'AQIDBA==',
    height: 300,
    uri: 'file:///thumb.jpg',
    width: 400,
  })),
}));

const mockDatabase = database as jest.Mocked<typeof database>;

function portion(id: string, name: string, overrides: Record<string, unknown> = {}) {
  const columns = {
    deleted_at: null,
    gram_weight: 30,
    id,
    name,
    owner_id: null,
    owner_type: null,
    scope: 'global',
    source: 'basic',
    ...overrides,
  };
  return {
    _raw: columns,
    deletedAt: undefined,
    gramWeight: columns.gram_weight ?? undefined,
    id,
    name,
    ownerId: columns.owner_id ?? undefined,
    ownerType: columns.owner_type ?? undefined,
  };
}

function link(id: string, linked: ReturnType<typeof portion>, isDefault: boolean) {
  return {
    _raw: {
      food_id: 'food-1',
      food_portion_id: linked.id,
      id,
      is_default: isDefault,
    },
    deletedAt: undefined,
    foodPortion: linked,
    id,
    isDefault,
  };
}

function fixture(overrides: { imageUrl?: string; links?: ReturnType<typeof link>[] } = {}) {
  const scoop = portion('portion-scoop', 'Scoop');
  const links = overrides.links ?? [link('link-scoop', scoop, true)];
  const food = {
    _raw: {
      _status: 'synced',
      brand: 'Brand',
      calories: 380,
      carbs: 6,
      description: '',
      fat: 7,
      fiber: 0,
      id: 'food-1',
      image_url: overrides.imageUrl,
      is_favorite: true,
      name: 'Whey',
      nutrition_basis: 'per_100g',
      protein: 76,
    },
    brand: 'Brand',
    calories: 380,
    carbs: 6,
    deletedAt: undefined,
    description: '',
    fat: 7,
    fiber: 0,
    foodPortions: { fetch: jest.fn().mockResolvedValue(links) },
    id: 'food-1',
    imageUrl: overrides.imageUrl,
    name: 'Whey',
    protein: 76,
    resolvedNutritionBasis: 'per_100g' as const,
  };
  mockDatabase.get.mockReturnValue({ find: jest.fn().mockResolvedValue(food) } as any);
  return { food, scoop };
}

describe('buildFoodShareEnvelope', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('carries the food, its portions and their links', async () => {
    fixture();

    const envelope = await buildFoodShareEnvelope('food-1', { includeImage: false });

    expect(envelope.rootTable).toBe('foods');
    expect(envelope.rootId).toBe('food-1');
    expect(envelope.records.foods).toHaveLength(1);
    expect(envelope.records.foods[0]).not.toHaveProperty('_status');
    expect(envelope.records.food_portions.map((row) => row.id)).toEqual(['portion-scoop']);
    expect(envelope.records.food_food_portions.map((row) => row.id)).toEqual(['link-scoop']);
    expect(envelope.summary).toMatchObject({
      brand: 'Brand',
      hasImage: false,
      name: 'Whey',
      nutritionBasis: 'per_100g',
      portions: [{ gramWeight: 30, isDefault: true, name: 'Scoop' }],
    });
    expect(envelope.summary.nutrients).toEqual({
      calories: 380,
      carbs: 6,
      fat: 7,
      fiber: 0,
      protein: 76,
    });
  });

  // A portion belonging to some other record has no owner in this envelope to point at, and the
  // spec discriminates `owner_id` to `foods` alone — carrying one would fail the receiver's import
  // on a foreign key it cannot resolve.
  it('leaves out a portion owned by something other than this food', async () => {
    const foreign = portion('portion-bowl', 'Bowl', { owner_id: 'meal-9', owner_type: 'meal' });
    const own = portion('portion-scoop', 'Scoop');
    fixture({ links: [link('link-bowl', foreign, false), link('link-scoop', own, true)] });

    const envelope = await buildFoodShareEnvelope('food-1', { includeImage: false });

    expect(envelope.records.food_portions.map((row) => row.id)).toEqual(['portion-scoop']);
    expect(envelope.records.food_food_portions.map((row) => row.id)).toEqual(['link-scoop']);
    expect(envelope.summary.portions.map((entry) => entry.name)).toEqual(['Scoop']);
  });

  it('drops the photo entirely when the sender opts out', async () => {
    fixture({ imageUrl: 'file:///food.jpg' });

    const envelope = await buildFoodShareEnvelope('food-1', { includeImage: false });

    expect(envelope.records.foods[0]).not.toHaveProperty('image_url');
    expect(envelope.assets).toBeUndefined();
    expect(createThumbnail).not.toHaveBeenCalled();
  });

  it('embeds a local photo as a thumbnail asset', async () => {
    fixture({ imageUrl: 'file:///food.jpg' });

    const payload = await buildFoodSharePayload('food-1', { includeImage: true });
    const envelope = JSON.parse(payload.json);

    expect(payload.payloadKind).toBe(OPTICAL_PAYLOAD_KIND_SHARE);
    expect(payload.exportVersion).toBe(OPTICAL_EXPORT_VERSION_SHARE);
    expect(envelope.records.foods[0].image_url).toBe('share-asset:foodImage');
    expect(envelope.assets.foodImage).toMatchObject({
      base64: 'AQIDBA==',
      height: 300,
      width: 400,
    });
    expect(envelope.summary.hasImage).toBe(true);
    expect(createThumbnail).toHaveBeenCalledWith('file:///food.jpg', 400);
  });

  // A product photo hosted by the food database is a URL both phones can fetch. Embedding it would
  // spend seconds of transfer on bytes the receiver can get for free.
  it('sends a remote photo as its URL, with no asset', async () => {
    fixture({ imageUrl: 'https://images.example.org/whey.jpg' });

    const envelope = await buildFoodShareEnvelope('food-1', { includeImage: true });

    expect(envelope.records.foods[0].image_url).toBe('https://images.example.org/whey.jpg');
    expect(envelope.assets).toBeUndefined();
    expect(envelope.summary.hasImage).toBe(true);
    expect(createThumbnail).not.toHaveBeenCalled();
  });

  // A photo file that has gone missing is not a reason to refuse to send the food.
  it('sends without the photo when the thumbnail cannot be made', async () => {
    fixture({ imageUrl: 'file:///gone.jpg' });
    (createThumbnail as jest.Mock).mockRejectedValueOnce(new Error('no such file'));

    const envelope = await buildFoodShareEnvelope('food-1', { includeImage: true });

    expect(envelope.records.foods[0]).not.toHaveProperty('image_url');
    expect(envelope.summary.hasImage).toBe(false);
  });

  // The contract that matters: a receiver has to be able to parse what this writes, through JSON,
  // where an explicit `null` from an unset optional column survives and an `undefined` does not.
  it('builds a payload the receiver can parse', async () => {
    fixture({ imageUrl: 'file:///food.jpg' });

    const payload = await buildFoodSharePayload('food-1', { includeImage: true });

    expect(payload.json).not.toContain('null');
    const parsed = parseShareEnvelope(payload.json);
    expect(parsed.kind).toBe('food');
    expect(parsed.summary.name).toBe('Whey');
    expect(parsed.rootId).toBe('food-1');
  });

  it('refuses a deleted food', async () => {
    const { food } = fixture();
    mockDatabase.get.mockReturnValue({
      find: jest.fn().mockResolvedValue({ ...food, deletedAt: 123 }),
    } as any);

    await expect(buildFoodShareEnvelope('food-1', { includeImage: false })).rejects.toThrow(
      'Food not found'
    );
  });
});
