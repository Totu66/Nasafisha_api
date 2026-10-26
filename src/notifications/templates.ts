export type SmsKind = 'submitted' | 'in_progress' | 'resolved';
export type Lang = 'en' | 'sw';

export const SMS_KINDS: SmsKind[] = ['submitted', 'in_progress', 'resolved'];

interface Vars {
  reference: string;
  link: string;
}

const TEMPLATES: Record<SmsKind, Record<Lang, (v: Vars) => string>> = {
  submitted: {
    en: (v) =>
      `NASAFISHA: We got your report ${v.reference}. We will SMS you each time it changes. Track it: ${v.link}`,
    sw: (v) =>
      `NASAFISHA: Tumepokea ripoti yako ${v.reference}. Tutakutumia SMS kila hali inapobadilika. Fuatilia: ${v.link}`,
  },
  in_progress: {
    en: (v) =>
      `NASAFISHA: Your report ${v.reference} is now in progress. A crew is on the way. Track it: ${v.link}`,
    sw: (v) =>
      `NASAFISHA: Ripoti yako ${v.reference} sasa inashughulikiwa. Timu iko njiani. Fuatilia: ${v.link}`,
  },
  resolved: {
    en: (v) =>
      `NASAFISHA: Report ${v.reference} is resolved. See the before and after photos: ${v.link}`,
    sw: (v) =>
      `NASAFISHA: Ripoti ${v.reference} imekamilika. Tazama picha za kabla na baada: ${v.link}`,
  },
};

export function renderSms(kind: SmsKind, lang: Lang, vars: Vars): string {
  return TEMPLATES[kind][lang](vars);
}
