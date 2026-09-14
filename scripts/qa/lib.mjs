/**
 * 実機テストの自動化（共通部品）
 *
 * Web 版は実機と同じコードなので、画面操作で確かめる項目はここで回せる。
 * 実機でしか分からないもの（プッシュ通知・カメラ・文字サイズの自動縮小・決済）は
 * 対象外。README を参照。
 *
 * 1操作ごとに「スクリーンショット・画面の文字・コンソールのエラー」を残す。
 * 合否だけでなく、後から人が見て「ここは戸惑う」を拾えるようにするため。
 */
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

/** iPhone 13 相当。実機に近い幅で撮る */
export const VIEWPORT = { width: 390, height: 844 };

export function outDir(name) {
  const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
  const dir = path.join(process.env.QA_OUT || '/tmp/gungun-qa', `${stamp}-${name}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

export async function launch() {
  const executablePath = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  return chromium.launch({ executablePath, args: ['--disable-blink-features=AutomationControlled'] });
}

/**
 * 1ユーザーぶんの操作記録。
 * ログイン済みのページと、手順を残すための step() を返す。
 */
export async function session(browser, { base, email, password, label, dir }) {
  const ctx = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: 'ja-JP',
    timezoneId: 'Asia/Tokyo',
  });
  const page = await ctx.newPage();

  const errors = [];
  page.on('pageerror', (e) => errors.push({ kind: 'pageerror', text: String(e).slice(0, 400) }));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push({ kind: 'console', text: m.text().slice(0, 400) });
  });
  page.on('requestfailed', (r) => {
    const u = r.url();
    if (u.startsWith('data:') || u.includes('fonts.g')) return;
    errors.push({ kind: 'network', text: `${r.failure()?.errorText} ${u.slice(0, 160)}` });
  });

  const steps = [];
  let n = 0;

  /** いま画面に出ている文字。画像を開かずに中身を確かめるため */
  const visibleText = () =>
    page.evaluate(() => {
      const out = [];
      const walk = (el) => {
        const st = getComputedStyle(el);
        if (st.display === 'none' || st.visibility === 'hidden' || st.opacity === '0') return;
        for (const node of el.childNodes) {
          if (node.nodeType === 3) {
            const t = node.textContent.trim();
            if (t) out.push(t);
          } else if (node.nodeType === 1) walk(node);
        }
      };
      walk(document.body);
      return out;
    });

  /** 1手順ぶんを記録する */
  async function step(name, note = '') {
    n += 1;
    const id = String(n).padStart(2, '0');
    const file = path.join(dir, `${label}-${id}-${name.replace(/[^\w가-힣ぁ-んァ-ヶ一-龠ー]/g, '_')}.png`);
    await page.waitForTimeout(450);
    await page.screenshot({ path: file });
    const took = errors.splice(0, errors.length);
    const text = await visibleText();
    steps.push({ n, name, note, url: page.url(), shot: path.basename(file), errors: took, text });
    const bad = took.length ? `  ⚠ ${took.length}件のエラー` : '';
    console.log(`  [${label}] ${id} ${name}${bad}`);
    return { errors: took, text };
  }

  /**
   * 文字で押す。RN Web は div なので、押せる祖先まで登る。
   *
   * 素直な click が通らない場面がいくつもある（下部の固定ボタンに隠れている、
   * アニメーション中で stable にならない、など）。座標打ち → DOM の click と
   * 順に落として、押せるところまで粘る。
   */
  async function tap(label_, { nth = 0, last = false, timeout = 8000 } = {}) {
    // 同じ文字が見出しとボタンの両方にあることが多い（例：「タネを植える」）。
    // 押したいのはたいてい後ろの方なので last で選べるようにする。
    //
    // ★ visible=true は必須。RN Web は同じ文字を非表示の要素にも持っていることがあり
    //   （ピッカーの選択肢が典型）、付けないと見えていない方を掴んで永久に待つ。
    const all = page.locator(`text="${label_}" >> visible=true`);
    const target = last ? all.last() : all.nth(nth);
    await target.waitFor({ state: 'visible', timeout });
    await target.scrollIntoViewIfNeeded({ timeout }).catch(() => {});

    // 文字そのものを押す。押せる祖先まで登ると、行より大きな親の中心を
    // 押してしまって外れる（水やり画面の選択行で実際に起きた）。
    // クリックは親の Pressable まで伝わるので、これで届く。
    try {
      await target.click({ timeout: 3000 });
    } catch {
      const box = await target.boundingBox();
      if (box) {
        await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      } else {
        await target.evaluate((el) => el.click());
      }
    }
    await page.waitForTimeout(400);
  }

  /** 文言が確定していないボタンを、正規表現で押す */
  async function tapRe(re, { last = false, timeout = 8000 } = {}) {
    const all = page.locator(`text=${re} >> visible=true`);
    const target = last ? all.last() : all.first();
    await target.waitFor({ state: 'visible', timeout });
    await target.scrollIntoViewIfNeeded({ timeout }).catch(() => {});
    await target.click({ timeout: 3000 }).catch(async () => {
      const box = await target.boundingBox();
      if (box) await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    });
    await page.waitForTimeout(400);
  }

  async function login() {
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);
    const emailBox = page.getByPlaceholder('メールアドレス');
    await emailBox.waitFor({ state: 'visible', timeout: 20000 });
    await emailBox.fill(email);
    await page.getByPlaceholder('パスワード').fill(password);
    await tap('ログイン');
    await page.waitForTimeout(3000);
  }

  const finish = async () => {
    writeFileSync(path.join(dir, `${label}.json`), JSON.stringify({ label, email, steps }, null, 2));
    await ctx.close();
    return steps;
  };

  return { page, step, tap, tapRe, login, finish, steps, visibleText };
}
