import Constants from 'expo-constants';
import { Platform } from 'react-native';

import type { Purchase } from 'expo-iap';

// Buying Premium through Google Play.
//
// The server end has been live since September: POST /api/v1/billing/play/purchase takes the
// purchase token and nothing else, reads the product, the state and the expiry back from Google,
// and acknowledges the purchase itself. So this file's whole job is to get a token and hand it
// over. It must never acknowledge a purchase of its own — that is the server's, and doing it here
// as well would be claiming the money is settled before anything has verified it.
//
// What it must do is finish the transaction *after* the server has recorded it. Google auto-
// refunds a purchase that is never acknowledged, so a token that is bought and then dropped takes
// the money back off the customer a few days later, silently.

// `expo-iap` is a native module and is loaded inside each function rather than at the top of the
// file, the same way the poster loads view-shot and media-library. A module-scope import would
// crash this screen on a build that predates the module, and there is no native module at all on
// web, where the dashboard is driven during development. `import type` above is erased at compile
// time and costs nothing.
const iap = () => import('expo-iap');

// Mirrors PLAY_PREMIUM in config/plans.mjs in the bookmack-api repo. Nothing serves these over
// the API — not /plans, not /billing — so the two copies have to be changed together, the same
// way the price is. The server rejects a token for any other product with UNKNOWN_PRODUCT, so a
// drift here fails loudly at purchase rather than quietly selling the wrong thing.
export const PREMIUM_PRODUCT_ID = 'bookmack_premium';
export const PREMIUM_BASE_PLAN_ID = 'premium-yearly';

// Play Billing is Android-only, and iOS is undecided. The screen asks before offering to buy.
export const BILLING_AVAILABLE = Platform.OS === 'android';

export const BILLING_UNAVAILABLE = 'Premium can only be bought in the Android app.';

let connected = false;

// Idempotent on purpose: the screen calls it on focus and again before a purchase, and the store
// connection outlives both.
const connect = async () => {
  const store = await iap();
  if (!connected) {
    await store.initConnection();
    connected = true;
  }
  return store;
};

export type PremiumOffer = {
  // Play's own localised price for this country — never our own copy of it. Google converts the
  // price per market, so a hardcoded "$24.99" is wrong everywhere but the US.
  displayPrice: string;
  offerToken: string;
};

/**
 * The yearly base plan, as Play describes it to this device. Null when the product or the base
 * plan is missing, which means the Play Console entry does not match PREMIUM_BASE_PLAN_ID — or
 * that this build is not from a track Play recognises, where the store returns nothing at all.
 */
export const premiumOffer = async (): Promise<PremiumOffer | null> => {
  if (!BILLING_AVAILABLE) return null;
  const store = await connect();

  const products = await store.fetchProducts({ skus: [PREMIUM_PRODUCT_ID], type: 'subs' });
  // Unknown SKUs are omitted rather than thrown, so an empty result is the normal shape of
  // "that product does not exist here".
  const product = (products ?? []).find((candidate) => candidate.id === PREMIUM_PRODUCT_ID);
  if (!product || !('subscriptionOffers' in product)) return null;

  const offer = (product.subscriptionOffers ?? []).find(
    (candidate) => candidate.basePlanIdAndroid === PREMIUM_BASE_PLAN_ID
  );
  if (!offer?.offerTokenAndroid) return null;

  return { displayPrice: offer.displayPrice, offerToken: offer.offerTokenAndroid };
};

/**
 * Opens Play's purchase sheet and resolves with the purchase, or **null if the person backed
 * out**. Backing out of a payment sheet is not an error and must not be reported as one.
 *
 * The outcome arrives through listeners rather than the call's return value, which is why this
 * wraps them in a promise: every path has to remove both listeners, or a second attempt resolves
 * the first attempt's promise as well.
 */
export const buyPremium = async (): Promise<Purchase | null> => {
  if (!BILLING_AVAILABLE) throw new Error(BILLING_UNAVAILABLE);
  const store = await connect();

  const offer = await premiumOffer();
  if (!offer) throw new Error('Premium is not available from the store right now.');

  return new Promise<Purchase | null>((resolve, reject) => {
    let done = false;
    let updated: { remove: () => void } | null = null;
    let failed: { remove: () => void } | null = null;

    const settle = (finish: () => void) => {
      if (done) return;
      done = true;
      updated?.remove();
      failed?.remove();
      finish();
    };

    updated = store.purchaseUpdatedListener((purchase) => settle(() => resolve(purchase)));
    failed = store.purchaseErrorListener((error) =>
      settle(() =>
        store.isUserCancelledError(error)
          ? resolve(null)
          : reject(new Error(error.message || 'That purchase could not be completed.'))
      )
    );

    store
      .requestPurchase({
        type: 'subs',
        request: {
          google: {
            skus: [PREMIUM_PRODUCT_ID],
            // Android will not start a subscription purchase without the offer token: it is what
            // names the base plan being bought, not just the product.
            subscriptionOffers: [{ sku: PREMIUM_PRODUCT_ID, offerToken: offer.offerToken }]
          }
        }
      })
      .catch((err: unknown) => settle(() => reject(err instanceof Error ? err : new Error(String(err)))));
  });
};

/**
 * Purchases the store is still holding — bought, but never finished. Normally empty; it has
 * something in it when a purchase succeeded and the app died before the server heard about it,
 * which is the case that otherwise leaves somebody paying for a plan they do not have.
 */
export const unfinishedPurchases = async (): Promise<Purchase[]> => {
  if (!BILLING_AVAILABLE) return [];
  const store = await connect();
  const purchases = await store.getAvailablePurchases();
  return (purchases ?? []).filter((purchase) => Boolean(purchase.purchaseToken));
};

/**
 * Takes the purchase out of the store's queue. Call only once the server has recorded it.
 *
 * Failures are swallowed deliberately. The server acknowledges the purchase with Google, so by
 * the time this runs the money is settled and the subscription is real; a failure here means the
 * token is offered again on the next launch, which `unfinishedPurchases` handles. Turning that
 * into an error on screen would tell someone their successful purchase had failed.
 */
export const settlePurchase = async (purchase: Purchase) => {
  try {
    const store = await iap();
    await store.finishTransaction({ purchase, isConsumable: false });
  } catch {
    // Left for the next launch to retry.
  }
};

/**
 * Opens Play's own subscription settings for this app.
 *
 * Google requires a Play-billed subscription to be cancelled in the Play Store, and the server
 * agrees: /billing/cancel answers 400 MANAGED_BY_GOOGLE_PLAY for one. So the honest thing to show
 * a subscriber is the door to the right place, not a Cancel button that cannot work.
 */
export const openPlaySubscriptions = async () => {
  const store = await iap();
  const packageName = Constants.expoConfig?.android?.package ?? 'com.bookmack.app';
  await store.deepLinkToSubscriptions({ skuAndroid: PREMIUM_PRODUCT_ID, packageNameAndroid: packageName });
};
