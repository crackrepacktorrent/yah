export const languages = {
	en: 'English',
	es: 'Español'
} as const;

export type Language = keyof typeof languages;

export const defaultLanguage: Language = 'en';

export function getLanguage(lang?: string): Language {
	if (lang === 'en' || lang === 'es') {
		return lang;
	}
	return defaultLanguage;
}
