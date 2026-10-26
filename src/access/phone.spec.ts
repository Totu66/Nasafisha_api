import { normalizeKenyanPhone } from './phone';

describe('normalizeKenyanPhone', () => {
  it.each([
    ['0712 345 678', '+254712345678'],
    ['712345678', '+254712345678'],
    ['254712345678', '+254712345678'],
    ['+254 712-345-678', '+254712345678'],
  ])('normalizes %s', (input, expected) => {
    expect(normalizeKenyanPhone(input)).toBe(expected);
  });

  it.each(['071234567', '0612345678', '+1 202 555 0100'])(
    'rejects invalid Kenyan number %s',
    (input) => {
      expect(normalizeKenyanPhone(input)).toBeNull();
    },
  );
});
