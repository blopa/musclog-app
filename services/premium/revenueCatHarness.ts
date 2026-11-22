// Harness-only RevenueCat reads (the Premium identity harness screen). Not used by the feature.
import { purchasesSdk, requireConfigured } from '@/services/premium/revenueCat';
import { summarizeCustomerInfo, toJsonSafe } from '@/utils/premium/harnessResult';

export async function fetchOfferings(): Promise<unknown> {
  requireConfigured();

  const offerings = await purchasesSdk().getOfferings();

  return toJsonSafe({
    currentOfferingId: offerings.current?.identifier ?? null,
    offerings: Object.values(offerings.all ?? {}).map((o) => ({
      identifier: o.identifier,
      packages: o.availablePackages.map((p) => ({
        identifier: p.identifier,
        packageType: p.packageType,
        productIdentifier: p.product.identifier,
        priceString: p.product.priceString,
        currency: p.product.currencyCode,
        price: p.product.price,
      })),
    })),
  });
}

export async function syncPurchases(): Promise<{ ok: true }> {
  requireConfigured();

  await purchasesSdk().syncPurchases();

  return { ok: true };
}

export async function getCustomerInfoDump(): Promise<{
  summary: ReturnType<typeof summarizeCustomerInfo>;
  raw: unknown;
}> {
  requireConfigured();

  const info = await purchasesSdk().getCustomerInfo();

  return { summary: summarizeCustomerInfo(info), raw: toJsonSafe(info) };
}
