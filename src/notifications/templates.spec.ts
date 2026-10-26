import { renderSms, SMS_KINDS } from './templates';

describe('SMS templates', () => {
  const vars = {
    reference: 'NSF-260915-0042',
    link: 'https://nasafisha.go.ke/r/ab3k9xz',
  };

  for (const kind of SMS_KINDS) {
    for (const lang of ['en', 'sw'] as const) {
      it(`${kind} in ${lang}: has the reference and link, and fits one SMS`, () => {
        const text = renderSms(kind, lang, vars);

        expect(text).toContain(vars.reference);
        expect(text).toContain(vars.link);
        expect(text.length).toBeLessThanOrEqual(160);
        expect(text).toMatch(/^[\x20-\x7E]+$/);
      });
    }
  }
});
