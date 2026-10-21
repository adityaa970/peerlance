import type { SupabaseClient } from '@supabase/supabase-js';

export type BalanceField = 'walletBalance' | 'earnedBalance' | 'promoBalance';
export type BalanceDelta = Partial<Record<BalanceField, number>>;

const FIELDS: BalanceField[] = ['walletBalance', 'earnedBalance', 'promoBalance'];
const MAX_ATTEMPTS = 5;

export class InsufficientBalanceError extends Error {
  constructor(message = 'Insufficient balance') {
    super(message);
    this.name = 'InsufficientBalanceError';
  }
}

/**
 * Atomically add (or subtract) amounts from a user's balances.
 *
 * Supabase has no atomic increment without a SQL function, so this does a
 * compare-and-swap: the update only applies if the balances are still what we
 * read, and retries otherwise. This stops two concurrent requests from both
 * spending the same money or overwriting each other's credits.
 *
 * Throws InsufficientBalanceError if `requireNonNegative` is set and any
 * changed balance would drop below zero.
 */
export async function adjustBalances(
  supabase: SupabaseClient,
  userId: string,
  delta: BalanceDelta,
  options: { requireNonNegative?: boolean } = {}
): Promise<Record<BalanceField, number>> {
  const changed = FIELDS.filter((f) => delta[f] !== undefined && delta[f] !== 0);
  for (const f of changed) {
    if (!Number.isFinite(delta[f])) throw new Error(`Invalid ${f} change`);
  }

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const { data: current, error: readError } = await supabase
      .from('User')
      .select('walletBalance, earnedBalance, promoBalance')
      .eq('id', userId)
      .single();

    if (readError || !current) throw readError || new Error('User not found');
    if (changed.length === 0) return current as Record<BalanceField, number>;

    const next: Partial<Record<BalanceField, number>> = {};
    for (const f of changed) {
      const value = roundMoney(Number(current[f] || 0) + Number(delta[f]));
      if (options.requireNonNegative && value < 0) throw new InsufficientBalanceError();
      next[f] = value;
    }

    let query = supabase.from('User').update(next).eq('id', userId);
    for (const f of changed) {
      query = current[f] === null ? query.is(f, null) : query.eq(f, current[f]);
    }

    const { data: updated, error: updateError } = await query
      .select('walletBalance, earnedBalance, promoBalance')
      .maybeSingle();

    if (updateError) throw updateError;
    if (updated) return updated as Record<BalanceField, number>;
    // Someone else changed the balance between our read and write; try again.
  }

  throw new Error('Balance is being updated by another request. Please try again.');
}

/** Round to paise so float maths never leaves 0.30000000000000004 in the DB. */
export function roundMoney(n: number) {
  return Math.round(n * 100) / 100;
}

/** Parse a user-supplied money amount. Returns null unless it's a positive, finite number. */
export function parseAmount(value: unknown): number | null {
  const n = typeof value === 'string' ? Number(value.trim()) : value;
  if (typeof n !== 'number' || !Number.isFinite(n) || n <= 0) return null;
  return roundMoney(n);
}
