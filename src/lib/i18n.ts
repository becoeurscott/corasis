/**
 * Minimal i18n layer. The interface ships in English; `fr` keys are a
 * starting point so the app is structured for French localization.
 * Usage: const t = useT(); t('home.sendMoment')
 */
import { getLocales } from 'expo-localization';

import { usePrefs, type Language, type LanguagePref } from '@/store/prefs';

const en = {
  'tabs.home': 'Home',
  'tabs.map': 'Map',
  'tabs.together': 'Together',
  'tabs.memories': 'Memories',
  'tabs.profile': 'Profile',
  'home.sendMoment': 'Send my moment',
  'home.questionOfDay': 'Question of the day',
  'home.nextMeeting': 'Next meeting',
  'flame.title': 'Daily flame',
  'common.continue': 'Continue',
  'common.skip': 'Skip',
  'common.back': 'Back',
  'common.save': 'Save',
  'common.cancel': 'Cancel',
  'common.delete': 'Delete',
  'onboarding.theme.title': 'Choose your theme',
  'onboarding.theme.subtitle': 'Make this little space feel like you.',
} as const;

const fr: Record<keyof typeof en, string> = {
  'tabs.home': 'Accueil',
  'tabs.map': 'Carte',
  'tabs.together': 'Ensemble',
  'tabs.memories': 'Souvenirs',
  'tabs.profile': 'Profil',
  'home.sendMoment': 'Envoyer mon moment',
  'home.questionOfDay': 'Question du jour',
  'home.nextMeeting': 'Prochaine rencontre',
  'flame.title': 'Flamme quotidienne',
  'common.continue': 'Continuer',
  'common.skip': 'Passer',
  'common.back': 'Retour',
  'common.save': 'Enregistrer',
  'common.cancel': 'Annuler',
  'common.delete': 'Supprimer',
  'onboarding.theme.title': 'Choisis ton thème',
  'onboarding.theme.subtitle': 'Fais de ce petit espace le tien.',
};

export type TKey = keyof typeof en;
const dictionaries = { en, fr };

/** The phone's language if we support it, otherwise English. */
export function deviceLanguage(): Language {
  try {
    const code = getLocales()[0]?.languageCode?.toLowerCase();
    return code === 'fr' ? 'fr' : 'en';
  } catch {
    return 'en';
  }
}

export function resolveLanguage(pref: LanguagePref): Language {
  return pref === 'auto' ? deviceLanguage() : pref;
}

export function useLanguage(): Language {
  return resolveLanguage(usePrefs((s) => s.language));
}

export function useT() {
  const lang = useLanguage();
  return (key: TKey) => dictionaries[lang][key] ?? en[key];
}
