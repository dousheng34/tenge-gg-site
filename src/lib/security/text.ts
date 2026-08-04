/**
 * Нормализация пользовательского текста.
 *
 * XSS здесь не лечится и не должен: весь пользовательский текст рендерится React как
 * текстовый узел, `dangerouslySetInnerHTML` в проекте не используется, а CSP в
 * next.config.ts запрещает внешние скрипты. DOMPurify нужен только там, где мы
 * сознательно рендерим HTML, — такого места нет.
 *
 * Реальная задача этого модуля — убрать невидимые и служебные символы, которыми
 * обходят фильтр контактов: zero-width, RTL-override, управляющие символы,
 * «растянутые» пробелами реквизиты.
 */

const ZERO_WIDTH = /[\u00ad\u034f\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/g;
// Управляющие символы, кроме \n и \t.
const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g;

export interface NormalizeOptions {
  /** Жёсткая отсечка длины после нормализации. */
  maxLength: number;
  /** Разрешить переводы строк (для описаний и споров). */
  allowNewlines?: boolean;
}

export function normalizeUserText(input: string, { maxLength, allowNewlines = false }: NormalizeOptions): string {
  let text = input.normalize('NFKC').replace(ZERO_WIDTH, '').replace(CONTROL, '');

  text = allowNewlines
    ? text.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n')
    : text.replace(/\s+/g, ' ');

  return text.trim().slice(0, maxLength);
}

/**
 * Схлопывает разделители внутри последовательностей цифр и букв: «7 7 0 1» -> «7701»,
 * «t . me» -> «t.me». Используется только для детекта, в БД пишется исходный текст.
 */
export function collapseSeparators(input: string): string {
  return input.replace(/(?<=[\p{L}\p{N}])[\s._\-()|/\\]{1,3}(?=[\p{L}\p{N}])/gu, '');
}

/** Кириллические гомоглифы -> латиница, чтобы «тг» и «t.me» не прятались за раскладкой. */
const HOMOGLYPHS: Readonly<Record<string, string>> = {
  а: 'a', в: 'b', е: 'e', ё: 'e', к: 'k', м: 'm', н: 'h', о: 'o',
  р: 'p', с: 'c', т: 't', у: 'y', х: 'x', і: 'i', ѕ: 's', ԁ: 'd',
};

const LEET: Readonly<Record<string, string>> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', $: 's' };

/** Нормализация для поиска ключевых слов: регистр, гомоглифы, leet, разделители. */
export function foldForKeywords(input: string): string {
  const lower = input.toLowerCase();
  let out = '';
  for (const char of lower) {
    out += HOMOGLYPHS[char] ?? LEET[char] ?? char;
  }
  return collapseSeparators(out);
}

/**
 * Нормализация БЕЗ транслитерации: регистр + схлопывание разделителей.
 *
 * Нужна отдельно, потому что гомоглиф-фолд подменяет `р` на `p` (визуальное сходство),
 * и кириллическое «телеграм» превращается в «telegpam» — фразы на русском по такому
 * фолду не находятся. Поэтому русские фразы ищем по plain-фолду, латиницу — по гомоглифному.
 */
export function foldPlain(input: string): string {
  return collapseSeparators(input.toLowerCase().normalize('NFKC').replace(ZERO_WIDTH, ''));
}
