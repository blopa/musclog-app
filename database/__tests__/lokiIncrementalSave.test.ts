/**
 * Guards the `patches/lokijs+1.5.12-wmelon6.patch` fix for the web (LokiJS) adapter.
 *
 * Loki hands collections loaded from IndexedDB a one-shot `getData` chunk loader behind a
 * lazy `data` getter. Unpatched, that getter memoized `data` as a read-only property, so the
 * incremental IndexedDB adapter threw `"data" is read-only` when it blanked `collection.data`
 * to serialize collection metadata — every autosave then failed and retried until the tab ran
 * out of memory. It also passed the loader on to the copy each save takes, which consumed the
 * chunks the live collection still needed.
 */
const Loki = require('lokijs/src/lokijs.wmelon.js');
const IncrementalIDBAdapter = require('lokijs/src/incremental-indexeddb-adapter.js');

type Doc = { $loki: number; id: string };

/** The shape the adapter builds after reading a collection's chunks out of IndexedDB. */
function rawCollection(name: string, docs: Doc[]) {
  const dataChunks: (Doc[] | null)[] = [docs];
  return {
    name,
    data: [],
    dirty: false,
    dirtyIds: [],
    disableChangesApi: true,
    disableFreeze: true,
    maxId: docs.length,
    getData() {
      const out: Doc[] = [];
      dataChunks.forEach((chunk, i) => {
        // Throws if a second reader gets here — the chunks are consumed on first read.
        chunk!.forEach((doc) => out.push(doc));
        dataChunks[i] = null;
      });
      return out;
    },
  };
}

describe('loki incremental IndexedDB saves', () => {
  it('saves repeatedly without losing the lazily loaded rows', () => {
    const docs: Doc[] = [1, 2, 3].map((i) => ({ $loki: i, id: `r${i}` }));
    const db = new Loki('test.db', { env: 'NA' });
    db.loadJSONObject({ name: 'test.db', collections: [rawCollection('workouts', docs)] });

    const savedKeys: string[] = [];
    const idbStore = {
      delete: () => {},
      put: (record: { key: string }) => savedKeys.push(record.key),
    };
    const adapter = new IncrementalIDBAdapter();

    // Two saves: the first is the one that used to throw, the second is the one that used to
    // find its chunks already consumed.
    for (let pass = 0; pass < 2; pass += 1) {
      savedKeys.length = 0;
      const lokiCopy = db.copy({ removeNonSerializable: true });
      adapter._putInChunks(idbStore, lokiCopy, false, {});
      expect(savedKeys).toEqual(['workouts.chunk.0', 'workouts.metadata', 'loki']);
    }

    const collection = db.getCollection('workouts');
    expect(collection.data.map((doc: Doc) => doc.id)).toEqual(['r1', 'r2', 'r3']);
    expect(collection.find({ id: 'r2' })).toHaveLength(1);
  });
});
