import { expect, it } from 'vitest';
import { hasUngroundedNumbers } from './intelligenceService';
it('rejects invented quantitative facts in an AI response', () => {
  expect(hasUngroundedNumbers('Price is 999.99 USD', '{"price":"110.50"}')).toBe(true);
  expect(hasUngroundedNumbers('Price is 110.50 USD', '{"price":"110.50"}')).toBe(false);
});
