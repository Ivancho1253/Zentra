import { expect, it } from 'vitest';
import { relevantAssets } from './newsRelevance';
it('matches entities from actual followed assets without substring ticker collisions', () => {
  const assets = [{ symbol: 'META', name: 'Meta Platforms, Inc.', type: 'stock' as const }];
  expect(
    relevantAssets({ title: 'Meta Platforms announces results', description: '' }, assets),
  ).toHaveLength(1);
  expect(relevantAssets({ title: 'Metaverse research', description: '' }, assets)).toHaveLength(0);
});
