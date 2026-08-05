import { existsSync } from 'node:fs';

/**
 * このマシンで使える Chromium 系ブラウザの実行ファイルを返す。
 *
 * 以前はクラウド作業環境の固定パス（/opt/pw-browsers/...）を直接書いていたため、
 * Mac では動かなかった。環境変数 → よくある場所、の順に探す。
 */
export function browserPath() {
  const candidates = [
    process.env.CHROME_PATH,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    '/usr/bin/chromium',
    '/usr/bin/google-chrome',
  ].filter(Boolean);
  const found = candidates.find((p) => existsSync(p));
  if (!found) {
    console.error('Chrome が見つかりません。CHROME_PATH に実行ファイルのパスを指定してください。');
    process.exit(1);
  }
  return found;
}
