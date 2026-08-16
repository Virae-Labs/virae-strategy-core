import type { MuskTweetSnapshot } from './types';

export function selectMuskEvaluationSnapshots(snapshots: readonly MuskTweetSnapshot[]): {
  currentSnapshot: MuskTweetSnapshot | null;
  nextSnapshot: MuskTweetSnapshot | null;
} {
  const currentSnapshot = snapshots.find((snapshot) => snapshot.market.status === 'active')
    ?? snapshots[0]
    ?? null;
  if (!currentSnapshot) return { currentSnapshot: null, nextSnapshot: null };

  const nextSnapshot = snapshots
    .filter((snapshot) => snapshot.market.status === 'upcoming')
    .sort((left, right) => Date.parse(left.market.startAt) - Date.parse(right.market.startAt))[0]
    ?? null;
  return { currentSnapshot, nextSnapshot };
}
