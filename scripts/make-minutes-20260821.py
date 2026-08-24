# -*- coding: utf-8 -*-
"""
議事録の .docx を組み立てる。
textutil の HTML→docx は表を落としてしまい、確認事項が
1セル1行のバラバラな並びになってしまうため、Word の XML を直接書く。
"""
import zipfile, html, pathlib

GREEN="2C8547"; INK="2B2B2B"; MUTED="6E6A5F"; LINE="E4DDCB"
HEAD_BG="F2EFE7"; NOTE_BG="F2EFE7"; ASK_BG="E7F2E2"; ORANGE="C87C10"; RED="C0453F"

def esc(t): return html.escape(t, quote=False)

def runs(text, *, b=False, sz=21, color=INK):
    """太字は **…** で囲んで表す"""
    out=[]
    for i,part in enumerate(text.split("**")):
        if not part: continue
        bold = b or (i % 2 == 1)
        out.append(
            f'<w:r><w:rPr><w:rFonts w:ascii="Hiragino Sans" w:eastAsia="Hiragino Sans" w:hAnsi="Hiragino Sans"/>'
            f'{"<w:b/>" if bold else ""}<w:sz w:val="{sz}"/><w:color w:val="{color}"/></w:rPr>'
            f'<w:t xml:space="preserve">{esc(part)}</w:t></w:r>')
    return "".join(out)

def para(text="", *, sz=21, color=INK, b=False, before=0, after=120, ind=0, shade=None, bar=False, align=None):
    pr = f'<w:spacing w:before="{before}" w:after="{after}" w:line="300" w:lineRule="auto"/>'
    if ind: pr += f'<w:ind w:left="{ind}"/>'
    if shade: pr += f'<w:shd w:val="clear" w:fill="{shade}"/>'
    if bar: pr += f'<w:pBdr><w:left w:val="single" w:sz="18" w:space="6" w:color="2E9E5B"/></w:pBdr>'
    if align: pr += f'<w:jc w:val="{align}"/>'
    return f'<w:p><w:pPr>{pr}</w:pPr>{runs(text, b=b, sz=sz, color=color)}</w:p>'

def h1(t): return para(t, sz=36, b=True, after=60)
def h2(t): return para(t, sz=26, b=True, color=GREEN, before=320, after=80)
def h3(t): return para(t, sz=22, b=True, color=GREEN, before=200, after=60)
def bullet(t): return para("・"+t, ind=280, after=60)

def table(rows, widths):
    grid = "".join(f'<w:gridCol w:w="{w}"/>' for w in widths)
    body=""
    for ri,row in enumerate(rows):
        cells=""
        for ci,cell in enumerate(row):
            color = INK
            if ri>0 and ci==2:
                color = RED if cell in ("未確定","404のまま") else ORANGE
            shade = HEAD_BG if ri==0 else "FFFFFF"
            cells += (
                f'<w:tc><w:tcPr><w:tcW w:w="{widths[ci]}" w:type="dxa"/>'
                f'<w:shd w:val="clear" w:fill="{shade}"/>'
                f'<w:tcMar><w:top w:w="80" w:type="dxa"/><w:bottom w:w="80" w:type="dxa"/>'
                f'<w:left w:w="120" w:type="dxa"/><w:right w:w="120" w:type="dxa"/></w:tcMar></w:tcPr>'
                f'{para(cell, sz=19, b=(ri==0 or ci==2), color=color, after=0)}</w:tc>')
        body += f'<w:tr>{cells}</w:tr>'
    borders = "".join(
        f'<w:{s} w:val="single" w:sz="4" w:space="0" w:color="{LINE}"/>'
        for s in ("top","left","bottom","right","insideH","insideV"))
    return (f'<w:tbl><w:tblPr><w:tblW w:w="9600" w:type="dxa"/>'
            f'<w:tblBorders>{borders}</w:tblBorders></w:tblPr>'
            f'<w:tblGrid>{grid}</w:tblGrid>{body}</w:tbl>' + para("", after=160))

B=[]
B.append(para("進捗共有ミーティング", sz=18, b=True, color=GREEN, after=40))
B.append(h1("ぐんぐん 現状のご報告と、これからの進め方"))
B.append(para("2026年8月21日（金）", sz=19, color=MUTED, after=20))
B.append(para("出席：めたん様 ／ Souzoh（海野 翔平・菊池 星哉）", sz=19, color=MUTED, after=260))

B.append(h2("1. 本日お話ししたいこと"))
for t in ["**アプリの現在地の共有** — どこまで出来ていて、何が残っているか",
          "**ご相談：マイページの置き場所** — 画面下のメニュー構成について、ご意見をいただきたいです",
          "**ドメインまわりの段取り** — 菊池と進めさせてください"]:
    B.append(bullet(t))

B.append(h2("2. アプリの現在地"))
B.append(para("交換の一連の流れは、すべて動く状態になっています。"))
B.append(table([
    ["項目","状況","内容"],
    ["交換フローの検証","22 / 22 通過","出品→水やり→収穫→発送→受取→評価"],
    ["決済まわりの検証","14 / 14 通過","肥料チャージ・プレミアム"],
    ["App Store","提出済み","1.0.1（ビルド15）を8月21日に提出しました"],
    ["管理画面","稼働中","運営に必要な操作はひと通り"],
], [2400, 1800, 5400]))

B.append(h3("できあがっている機能"))
for t in ["タネを植える（出品）・写真の切り抜き","水やり（1つの木につき1人1回）","収穫と、玉突きの輪の成立",
          "取引詳細（今どの段階か・次に何をするか）","発送前チェックリスト・お届け先の表示",
          "配送業者と追跡番号、追跡サイトへの遷移","受け取り・評価（1取引1人1回）",
          "輪が完成したときのお祝い画面","掲示板・コメント・いいね","通報とブロック、運営側の対応画面",
          "プッシュ通知（数秒で届きます）","肥料チャージ・プレミアム（Apple Pay 対応）"]:
    B.append(bullet(t))

B.append(h3("直近で手を入れたところ"))
for t in ["ホームに並び替えを追加（おすすめ／新着順／水やりが多い順／人気順）",
          "ログインボーナスを日曜始まりにし、連続ログイン日数を表示",
          "肥料の購入前に、内容の確認と同意を挟むように",
          "通知の削除・保存（しおり）","読みづらかった文章・改行の調整",
          "管理画面の作り直し（一覧にメール・出品数・取引数を表示、状態の色分け、メール検索）",
          "PCから確認できるWeb版の不具合を修正（アイコンが表示されない問題）"]:
    B.append(bullet(t))

B.append(h3("ご報告：データベースの作り直しについて"))
B.append(para("8月21日、本番用に用意していたデータベースが失われる事象がありました。設計・機能はすべて手元に残っていたため、**同日中に作り直して復旧済み**です。交換フロー22件・決済14件の検証も、作り直した後にすべて通しています。"))
B.append(para("まだ一般公開前で、入っていたのは弊社のテストデータのみです。利用者のデータや事業上の影響はありません。再発防止として、**日次でバックアップを取る仕組み**のご用意を提案させてください（現時点では未着手です）。", sz=19, color=MUTED, shade=NOTE_BG))

B.append(h2("3. ご相談：マイページの置き場所"))
B.append(h3("いまの状態"))
B.append(para("画面下のメニュー：**ホーム ／ 掲示板 ／ 収穫 ／ プレミアム ／ 取引**"))
B.append(para("マイページは、画面右上のアイコンに移しています。", sz=19, color=MUTED))
B.append(para("「取引」は使う頻度が高いので画面下に置きたい、というご要望を反映しました。ただし下のメニューは5つが上限のため、押し出される形で**マイページを右上へ動かしています**。"))
B.append(h3("ご提案"))
B.append(para("画面下のメニュー：**ホーム ／ 掲示板 ／ 収穫 ／ 取引 ／ マイページ**"))
B.append(para("プレミアムを下のメニューから外し、マイページを戻す案です。", sz=19, color=MUTED))
B.append(para("そう考える理由", b=True, after=60))
for t in ["月額プランを常設タブに置いているアプリはあまり見かけません。常に売り込まれている印象になりやすいためです",
          "マイページは住所・出品履歴・設定など、**用事があって開く画面**です。探して見つからないと困ります",
          "プレミアムは「もっと使いたい」と思った瞬間に出す方が効きます。**その仕掛けはすでに実装済み**です"]:
    B.append(bullet(t))
B.append(para("プレミアムの見せ方（外した場合）", b=True, before=120, after=60))
for t in ["タネを植えるとき・水やりするときに案内を表示（実装済み。「今日はもう表示しない」も選べます）",
          "マイページから「プランを管理・解約する」でいつでも到達（実装済み）",
          "肥料が足りないときの導線に追加（ご希望があれば）"]:
    B.append(bullet(t))
B.append(para("ご判断いただきたいこと：プレミアムを下のメニューから外し、マイページを戻してよろしいでしょうか。「露出が減るのは避けたい」というご意向であれば、現状のままでも問題ありません。",
              b=True, color=GREEN, shade=ASK_BG, bar=True, before=160))

B.append(h2("4. ドメインまわり"))
for t in ["**メール送信用の独自ドメイン設定** — 通知メールが迷惑メールに入りにくくなります。Wix側のDNS設定が必要です",
          "**公式サイトと利用規約ページ** — 現在、規約ページが表示できない状態です（アプリ内には掲載済み）",
          "**管理画面のURL** — 独自ドメインを割り当てるかどうか"]:
    B.append(bullet(t))
B.append(para("Wixの管理画面にアクセスできる方と、直接やり取りさせていただけると早く進みます。", sz=19, color=MUTED, shade=NOTE_BG))

B.append(h2("5. めたん様にご確認・ご準備いただきたいこと"))
B.append(table([
    ["項目","内容","状況"],
    ["特定商取引法に基づく表記","事業者名・所在地・電話番号。有料機能があるため法令上必要です","未確定"],
    ["既存160名の名簿","メールアドレスと表示名。取り込みの仕組みは用意済みです","お待ちしています"],
    ["公式サイトの利用規約ページ","本文はこちらで用意済み。掲載をお願いします","404のまま"],
    ["Wix の DNS 情報","メール送信の独自ドメイン設定に使います","お待ちしています"],
    ["Stripe の本番切り替え","現在テストモードです。切り替える時期をご相談させてください","ご判断"],
    ["管理画面のパスワード","簡易なものを設定しています。運用開始前の変更を推奨します","ご判断"],
    ["年齢制限に関する追加回答","Appleからの新しい質問です（期限：9月7日）","対応可能"],
], [2600, 5100, 1900]))

B.append(h2("6. これからの進め方"))
for t in ["**App Store の審査** — 8月21日にビルド15を提出しました。結果は通常1〜3日で分かります",
          "**審査対応** — 指摘があれば都度修正して再提出します",
          "**提出後に直した分の反映** — 実機で見つかった不具合の修正は、審査に出したビルドより後のものです。"
          "審査が通ったあと、アプリの更新として配信します（ストアの再審査は不要です）",
          "**本日ご判断いただく点の反映** — メニュー構成が決まり次第、すぐ反映します",
          "**既存160名へのご案内** — 名簿をいただき次第、取り込みと案内メールの準備をします",
          "**バックアップの仕組み** — ご了承いただければ用意します"]:
    B.append(bullet(t))

B.append(h2("7. PCからお試しいただけます"))
B.append(para("実機がなくても、パソコンのブラウザから同じ画面をひと通り触っていただけます。"))
B.append(para("https://gungun-web.pages.dev", b=True, color=GREEN))
B.append(para("お試し用アカウント：metan@example.com ／ パスワード：password", sz=19, color=MUTED))
B.append(para("動作確認用のため、中身はテストデータです。管理画面のURLとパスワードは、別途安全な方法でお渡しします。", sz=19, color=MUTED, shade=NOTE_BG))

B.append(para("ぐんぐん 進捗共有ミーティング議事録 ／ 2026年8月21日 ／ Souzoh",
              sz=17, color=MUTED, align="center", before=400))

doc = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
 '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
 f'<w:body>{"".join(B)}'
 '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/>'
 '<w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134"/></w:sectPr>'
 '</w:body></w:document>')

ct = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
 '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
 '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
 '<Default Extension="xml" ContentType="application/xml"/>'
 '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
 '</Types>')
rels = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
 '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
 '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>'
 '</Relationships>')

for out in (
    pathlib.Path("/Users/seiyakikuchi/gungun/docs/meetings/2026-08-21_ぐんぐん進捗共有_議事録.docx"),
    pathlib.Path("/Users/seiyakikuchi/Library/Mobile Documents/com~apple~CloudDocs/"
                 "ダウンロード・スクショ/2026-08-21_ぐんぐん進捗共有_議事録.docx"),
):
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("[Content_Types].xml", ct)
        z.writestr("_rels/.rels", rels)
        z.writestr("word/document.xml", doc)
    print("作成:", out, out.stat().st_size, "bytes")
