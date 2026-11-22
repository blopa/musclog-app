// In-memory RevenueCatClient for tests. Small API:
//   const rc = fakeRevenueCat();
//   rc.addSubscription('cust_1', { id: 'sub_1' }, [rc.tx({ id: 'tx_1' })]);  // qualifying defaults
//   rc.moveSubscription('sub_1', 'cust_2');   // ownership transfer
//   rc.unavailable = true;                     // every call throws RevenueCatUnavailableError
//   rc.calls.getSubscription                   // per-method call counters
import { NOW } from './ctx';
import type { RcSubscription, RcTransaction, RevenueCatClient } from '../../src/upstream/types';
import { RevenueCatUnavailableError } from '../../src/upstream/types';

const DAY = 86_400_000;

export interface FakeRevenueCat extends RevenueCatClient {
  unavailable: boolean;
  calls: { listCustomerSubscriptions: number; getSubscription: number; listTransactions: number };
  /** Builds a transaction covering NOW (purchased 1 day ago, expires in 29 days). */
  tx(over?: Partial<RcTransaction>): RcTransaction;
  /** Builds a qualifying subscription (does not register it). */
  sub(customerId: string, over?: Partial<RcSubscription>): RcSubscription;
  addSubscription(
    customerId: string,
    over?: Partial<RcSubscription>,
    txs?: RcTransaction[]
  ): RcSubscription;
  setTransactions(subscriptionId: string, txs: RcTransaction[]): void;
  addTransaction(subscriptionId: string, tx: RcTransaction): void;
  /** Moves a subscription to another customer id (RevenueCat ownership transfer). */
  moveSubscription(subscriptionId: string, toCustomerId: string): void;
  update(subscriptionId: string, over: Partial<RcSubscription>): void;
  remove(subscriptionId: string): void;
}

export function fakeRevenueCat(): FakeRevenueCat {
  const subs = new Map<string, RcSubscription>();
  const txs = new Map<string, RcTransaction[]>();
  let seq = 0;

  const guard = () => {
    if (fake.unavailable) throw new RevenueCatUnavailableError(503);
  };

  const fake: FakeRevenueCat = {
    unavailable: false,
    calls: { listCustomerSubscriptions: 0, getSubscription: 0, listTransactions: 0 },
    tx(over = {}) {
      seq++;
      return {
        id: `tx_${seq}`,
        purchased_at: NOW - DAY,
        expiration_date: NOW + 29 * DAY,
        revenue_in_usd: { gross: 4.79, commission: 0.72, tax: 0, proceeds: 4.07 },
        ...over,
      };
    },
    sub(customerId, over = {}) {
      seq++;
      return {
        id: `sub_${seq}`,
        customer_id: customerId,
        original_customer_id: customerId,
        product_id: 'prod_monthly',
        gives_access: true,
        status: 'active',
        store: 'play_store',
        environment: 'production',
        ownership: 'purchased',
        starts_at: NOW - DAY,
        current_period_starts_at: NOW - DAY,
        current_period_ends_at: NOW + 29 * DAY,
        ...over,
      };
    },
    addSubscription(customerId, over = {}, list) {
      const s = fake.sub(customerId, over);
      subs.set(s.id, s);
      txs.set(s.id, list ?? [fake.tx()]);
      return s;
    },
    setTransactions: (id, list) => void txs.set(id, list),
    addTransaction(id, tx) {
      txs.set(id, [...(txs.get(id) ?? []), tx]);
    },
    moveSubscription(id, to) {
      const s = subs.get(id);
      if (s) subs.set(id, { ...s, customer_id: to });
    },
    update(id, over) {
      const s = subs.get(id);
      if (s) subs.set(id, { ...s, ...over });
    },
    remove: (id) => void subs.delete(id),
    async listCustomerSubscriptions(customerId) {
      fake.calls.listCustomerSubscriptions++;
      guard();
      return [...subs.values()].filter((s) => s.customer_id === customerId);
    },
    async getSubscription(id) {
      fake.calls.getSubscription++;
      guard();
      return subs.get(id) ?? null;
    },
    async listTransactions(id) {
      fake.calls.listTransactions++;
      guard();
      return txs.get(id) ?? [];
    },
  };
  return fake;
}
