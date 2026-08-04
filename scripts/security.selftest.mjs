/**
 * Selftest модулей безопасности: node scripts/security.selftest.mjs
 *
 * Полноценного тест-раннера в проекте пока нет, а анти-байпас сканер — код, который
 * ломается молча и дорого: пропущенный номер карты означает сделку мимо escrow.
 * Поэтому проверка живёт отдельным скриптом и запускается в CI.
 *
 * Скрипт сам компилирует TS во временную папку (без раннеров и бандлеров) и
 * дописывает расширения в относительных импортах, как требует Node ESM.
 */

import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const outDir = mkdtempSync(join(tmpdir(), 'tenge-sec-'));

try {
  execFileSync(
    'npx',
    [
      'tsc',
      'src/lib/security/contact-leak.ts',
      'src/lib/security/text.ts',
      '--outDir', outDir,
      '--target', 'es2022',
      '--module', 'es2022',
      '--moduleResolution', 'bundler',
      '--skipLibCheck',
    ],
    { stdio: 'inherit' },
  );

  const compiled = join(outDir, 'contact-leak.js');
  writeFileSync(compiled, readFileSync(compiled, 'utf8').replaceAll("'./text'", "'./text.js'"));

  const { scanForContactLeaks, isLuhnValid } = await import(pathToFileURL(compiled).href);

  /** [текст, ожидаем блокировку, ожидаемые виды находок] */
  const cases = [
    ['Привет, лот ещё в наличии?', false, []],
    ['4242 4242 4242 4242 переведи сюда', true, ['card']],
    ['4242424242424243 сюда', false, []],
    ['мой счет KZ86 125K ZT50 0410 0100', true, ['iban']],
    ['звони +7 701 234 56 78', false, ['phone']],
    ['пиши @seller_kz быстрее', false, ['telegram']],
    ['t.me/seller_kz', false, ['telegram']],
    ['напиши в т.е.л.е.г.р.а.м', false, ['bypass_intent']],
    ['mail: seller@gmail.com', false, ['email']],
    ['смотри https://funpay.com/lots/1', false, ['external_link']],
    ['открой https://tenge.gg/lot/42', false, []],
    ['давай мимо сайта, дешевле', false, ['bypass_intent']],
    ['оплата через Kaspi QR на сайте', false, []],
    ['ID аккаунта 123456789012345678', false, []],
  ];

  let failed = 0;

  for (const [text, expectBlocked, expectKinds] of cases) {
    const res = scanForContactLeaks(text);
    const kinds = [...new Set(res.findings.map((f) => f.kind))].sort();
    const want = [...expectKinds].sort();
    const ok = res.blocked === expectBlocked && JSON.stringify(kinds) === JSON.stringify(want);

    if (ok) {
      console.log(`ok   ${JSON.stringify(text)} -> ${JSON.stringify(res.text)}`);
    } else {
      failed += 1;
      console.error(`FAIL ${JSON.stringify(text)}`);
      console.error(`     blocked=${res.blocked} (ждём ${expectBlocked}), kinds=${kinds} (ждём ${want})`);
    }
  }

  if (!isLuhnValid('4242424242424242') || isLuhnValid('4242424242424243')) {
    failed += 1;
    console.error('FAIL Luhn: контрольная сумма считается неверно');
  }

  if (failed > 0) {
    console.error(`\n${failed} проверок не прошло`);
    process.exit(1);
  }

  console.log(`\nВсе ${cases.length} проверок пройдены`);
} finally {
  rmSync(outDir, { recursive: true, force: true });
}
