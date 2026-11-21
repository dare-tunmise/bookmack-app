import { useFocusEffect } from 'expo-router';
import { Fragment, useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { api, type Schemas } from '@/api/client';
import {
  BILLING_AVAILABLE,
  buyPremium,
  openPlaySubscriptions,
  premiumOffer,
  settlePurchase,
  unfinishedPurchases,
  type PremiumOffer
} from '@/billing/play';
import { errorMessage, toApiError } from '@/api/errors';
import { Badge, PLAN_LABELS } from '@/components/badge';
import { Banner } from '@/components/banner';
import { Button } from '@/components/button';
import { Icon } from '@/components/icon';
import { Skeleton } from '@/components/skeleton';
import { FieldError } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { UsageMeter } from '@/components/usage-meter';
import { Colors, Fonts, MaxContentWidth, Radius } from '@/constants/theme';
import { formatDate } from '@/lib/loans';

type Entitlements = Schemas['Entitlements'];
type PlanInfo = Schemas['PlanInfo'];
type LimitKey = keyof Entitlements['limits'];
type FeatureKey = keyof Entitlements['features'];

const LIMITS: { key: LimitKey; usageLabel: string; compareLabel: string }[] = [
  { key: 'books', usageLabel: 'Books', compareLabel: 'Books' },
  { key: 'borrowers', usageLabel: 'Borrowers', compareLabel: 'Borrowers' },
  { key: 'loansPerMonth', usageLabel: 'Loans this month', compareLabel: 'Loans a month' },
  { key: 'coverScansPerMonth', usageLabel: 'Cover scans this month', compareLabel: 'Cover scans a month' },
  { key: 'recommendationsPerMonth', usageLabel: 'Recommendations this month', compareLabel: 'Recommendations a month' },
  { key: 'libraryQuestionsPerMonth', usageLabel: 'Questions this month', compareLabel: 'Questions a month' }
];

// `note` says where a feature actually works, for the ones that do not work here. Premium really
// does include both exports — the website has the buttons, behind the same server check — but the
// app has no export screen at all, so a tick with nothing after it promised a subscriber something
// they could not find. Delete the note when export lands in the app, not the row.
const FEATURES: { key: FeatureKey; label: string; note?: string }[] = [
  { key: 'batchAdd', label: 'Add many books at once' },
  { key: 'csvExport', label: 'Export to CSV', note: 'on bookmack.com' },
  { key: 'pdfExport', label: 'Export to PDF', note: 'on bookmack.com' },
  { key: 'automatedReminders', label: 'Automatic reminders' },
  { key: 'customRecommendationMessage', label: 'Personal recommendation messages' },
  { key: 'askLibrary', label: 'Ask your library a question' }
];

// The fallback prices. Play charges each country its own price for the same subscription, so when
// the store answers, its own `displayPrice` is shown instead of this — these are the US figures,
// and they are what a device with no store connection sees.
const PLAN_PRICES: Record<PlanInfo['plan'], string> = {
  free: 'Free forever',
  premium: '$24.99 a year'
};

// Monthly limits count from the 1st of the month, UTC (startOfMonthUtc in the backend).
const nextMonthlyReset = (now = new Date()) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

const formatLimit = (limit: number | null) => (limit === null ? 'Unlimited' : limit.toLocaleString());

const subscriptionStatus = (subscription: Entitlements['subscription']): { text: string; danger: boolean } | null => {
  if (!subscription) return null;
  const cycle = subscription.billingCycle ? ` · billed ${subscription.billingCycle}` : '';
  const end = subscription.accessEndsAt ?? subscription.currentPeriodEnd;

  switch (subscription.status) {
    case 'active':
      return {
        text: subscription.currentPeriodEnd ? `Renews ${formatDate(subscription.currentPeriodEnd)}${cycle}` : `Active${cycle}`,
        danger: false
      };
    case 'non_renewing':
    case 'canceled':
      return { text: end ? `Ends ${formatDate(end)}` : 'Cancelled', danger: false };
    case 'past_due':
      return { text: "Your last payment didn't go through. Your plan stays active for a few days.", danger: true };
    case 'expired':
      return { text: 'Expired', danger: true };
  }
};

type Loaded = { entitlements: Entitlements; plans: PlanInfo[] };

export default function PlanScreen() {
  const [data, setData] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [offer, setOffer] = useState<PremiumOffer | null>(null);
  const [buying, setBuying] = useState(false);
  const [buyError, setBuyError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [entitlementsResult, plansResult] = await Promise.all([api.GET('/me/entitlements'), api.GET('/plans')]);
      if (!entitlementsResult.data) throw toApiError(entitlementsResult.error);
      if (!plansResult.data) throw toApiError(plansResult.error);
      setData({ entitlements: entitlementsResult.data.data, plans: plansResult.data.data });
      setError(null);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setRefreshing(false);
    }
  }, []);

  // The server is the only thing that decides whether a purchase counts: it re-reads the token
  // from Google, records the subscription and acknowledges it. Only once it has said yes is the
  // transaction taken out of the store's queue.
  const register = useCallback(async (purchase: Awaited<ReturnType<typeof buyPremium>>) => {
    if (!purchase?.purchaseToken) return;
    const { error: failed } = await api.POST('/billing/play/purchase', {
      body: { purchaseToken: purchase.purchaseToken }
    });
    if (failed) throw toApiError(failed);
    await settlePurchase(purchase);
  }, []);

  // Usage changes as books, loans, and scans are added, so reload whenever the screen is opened.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  // Play's own price for this country, and anything the store is still holding.
  //
  // A purchase the server never heard about is the one failure that costs somebody money for
  // nothing — the app dying between Play taking the payment and the token being sent. Retrying it
  // here is quiet on purpose: there is nothing for the reader to do about it, and it is normally
  // a no-op. Store trouble never surfaces as a screen error either, because the plan screen has
  // to keep working for people who are not buying anything.
  useFocusEffect(
    useCallback(() => {
      if (!BILLING_AVAILABLE) return;
      let live = true;

      (async () => {
        try {
          const available = await premiumOffer();
          if (live) setOffer(available);
        } catch {
          // Leaves the fallback price showing.
        }

        try {
          const held = await unfinishedPurchases();
          if (!held.length) return;
          for (const purchase of held) await register(purchase);
          if (live) load();
        } catch {
          // Tried again next time this screen is opened.
        }
      })();

      return () => {
        live = false;
      };
    }, [load, register])
  );

  const upgrade = async () => {
    setBuyError(null);
    setBuying(true);
    try {
      const purchase = await buyPremium();
      // Null means they closed Play's sheet. Backing out of a payment is not a failure and gets
      // no message: the screen is simply as it was.
      if (purchase) {
        await register(purchase);
        await load();
      }
    } catch (err) {
      setBuyError(errorMessage(err));
    } finally {
      setBuying(false);
    }
  };

  if (!data) {
    return (
      <ThemedView style={[styles.flex, styles.loading]}>
        {error ? (
          <>
            <FieldError message={error} />
            <Button title="Try again" variant="secondary" onPress={load} />
          </>
        ) : (
          <>
            <Skeleton width="100%" height={96} radius={Radius.card} />
            <Skeleton width="100%" height={320} radius={Radius.card} />
          </>
        )}
      </ThemedView>
    );
  }

  const { entitlements, plans } = data;
  const status = subscriptionStatus(entitlements.subscription);

  return (
    <ThemedView style={styles.flex}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            colors={[Colors.brand]}
          />
        }>
        <View style={[styles.card, styles.current]}>
          <View style={styles.planIcon}>
            <Icon name="card" color={Colors.text} size={22} />
          </View>
          <View style={styles.flex}>
            <ThemedText type="small" themeColor="textSecondary">
              Your plan
            </ThemedText>
            <ThemedText type="h2">{PLAN_LABELS[entitlements.plan]}</ThemedText>
            {status ? (
              <ThemedText type="small" style={status.danger ? styles.danger : styles.secondary}>
                {status.text}
              </ThemedText>
            ) : null}
          </View>
        </View>

        <View style={styles.section}>
          <ThemedText accessibilityRole="header" style={styles.sectionTitle}>
            Usage
          </ThemedText>
          <View style={styles.card}>
            {LIMITS.map((limit, index) => (
              <Fragment key={limit.key}>
                {index > 0 ? <View style={styles.divider} /> : null}
                <UsageMeter
                  label={limit.usageLabel}
                  used={entitlements.usage[limit.key]}
                  limit={entitlements.limits[limit.key]}
                />
              </Fragment>
            ))}
          </View>
          <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
            {`Monthly counts reset on ${formatDate(nextMonthlyReset())}.`}
          </ThemedText>
        </View>

        <View style={styles.section}>
          <ThemedText accessibilityRole="header" style={styles.sectionTitle}>
            Compare plans
          </ThemedText>
          {plans.map((plan) => (
            <PlanCard
              key={plan.plan}
              plan={plan}
              current={plan.plan === entitlements.plan}
              price={plan.plan === 'premium' ? offer?.displayPrice : undefined}
            />
          ))}
          {entitlements.plan === 'free' ? (
            BILLING_AVAILABLE ? (
              <>
                {/* Play's price, not ours, whenever the store has answered: Google converts it
                    per country, so our own "$24.99" is right in exactly one market. */}
                <Button
                  title={offer ? `Upgrade to Premium — ${offer.displayPrice}` : 'Upgrade to Premium'}
                  onPress={upgrade}
                  loading={buying}
                />
                {buyError ? <FieldError message={buyError} /> : null}
                <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
                  Billed by Google Play, and cancelled there too.
                </ThemedText>
              </>
            ) : (
              <Banner tone="plan">Premium is bought in the BookMack Android app, through Google Play.</Banner>
            )
          ) : entitlements.subscription?.provider === 'google_play' ? (
            // Google requires a Play-billed subscription to be cancelled in the Play Store, and
            // the server refuses to do it (400 MANAGED_BY_GOOGLE_PLAY). So this is a door, not a
            // Cancel button that could only ever fail.
            <Button
              title="Manage in Play Store"
              variant="secondary"
              onPress={() => {
                void openPlaySubscriptions();
              }}
            />
          ) : null}
        </View>
      </ScrollView>
    </ThemedView>
  );
}

function PlanCard({ plan, current, price }: { plan: PlanInfo; current: boolean; price?: string }) {
  return (
    <View style={[styles.card, current && styles.cardCurrent]}>
      <View style={styles.planHeader}>
        <View>
          <ThemedText type="h3">{PLAN_LABELS[plan.plan]}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {price ?? PLAN_PRICES[plan.plan]}
          </ThemedText>
        </View>
        {current ? <Badge label="Current plan" tone="brand" style={styles.badge} /> : null}
      </View>

      {LIMITS.map((limit) => (
        <View key={limit.key} style={styles.row}>
          <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
            {limit.compareLabel}
          </ThemedText>
          <ThemedText type="smallBold">{formatLimit(plan.limits[limit.key])}</ThemedText>
        </View>
      ))}

      <View style={styles.divider} />

      {FEATURES.map((feature) => {
        const included = plan.features[feature.key];
        return (
          <View
            key={feature.key}
            accessible
            accessibilityLabel={[
              `${feature.label}: ${included ? 'included' : 'not included'}`,
              // Read out too, not just drawn: the note is the part that stops the tick being a
              // promise the app cannot keep.
              included && feature.note ? feature.note : null
            ]
              .filter(Boolean)
              .join(', ')}
            style={styles.featureRow}>
            <Icon
              name={included ? 'check' : 'close'}
              color={included ? Colors.brand : Colors.disabledText}
              size={16}
              strokeWidth={included ? 3 : 2}
            />
            <ThemedText type="small" themeColor={included ? 'text' : 'textSecondary'} style={styles.flex}>
              {feature.label}
              {/* Only where it is included: on the Free column the tick is already a cross, and
                  "on bookmack.com" beside it would read as an offer rather than a limitation. */}
              {included && feature.note ? (
                <ThemedText type="small" themeColor="textSecondary">{` · ${feature.note}`}</ThemedText>
              ) : null}
            </ThemedText>
          </View>
        );
      })}
    </View>
  );
}

const ICON_SIZE = 48;

const styles = StyleSheet.create({
  flex: {
    flex: 1
  },
  loading: {
    gap: 16,
    padding: 20
  },
  content: {
    gap: 24,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 40,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center'
  },
  card: {
    gap: 12,
    padding: 16,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface
  },
  cardCurrent: {
    borderWidth: 2,
    borderColor: Colors.brand
  },
  current: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14
  },
  planIcon: {
    width: ICON_SIZE,
    height: ICON_SIZE,
    borderRadius: ICON_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.brandTint
  },
  secondary: {
    color: Colors.textSecondary
  },
  danger: {
    color: Colors.danger
  },
  section: {
    gap: 8
  },
  sectionTitle: {
    paddingHorizontal: 4,
    fontFamily: Fonts.bodyBold,
    fontSize: 14,
    lineHeight: 20,
    color: Colors.textSecondary
  },
  note: {
    paddingHorizontal: 4
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border
  },
  planHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12
  },
  badge: {
    alignSelf: 'center'
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  }
});
