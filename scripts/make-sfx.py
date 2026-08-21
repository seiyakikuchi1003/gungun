#!/usr/bin/env python3
"""効果音（pop / chime / stamp）を生成して public/sounds に書き出す。

以前は Cloudflare Pages 上のファイルだけが実体で、リポジトリには何も無かった。
デプロイし直すと音が消えるため、生成器ごとバージョン管理する。

    python3 scripts/make-sfx.py
"""
import math
import os
import struct
import wave

RATE = 44100
OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'sounds')


def envelope(i: int, n: int, attack: float = 0.01, release: float = 0.6) -> float:
    """クリックノイズが出ないよう、頭とお尻を滑らかに絞る"""
    t = i / n
    a = min(1.0, t / attack) if attack > 0 else 1.0
    r = min(1.0, (1.0 - t) / release) if release > 0 else 1.0
    return a * r


def write(name: str, samples: list[float]) -> None:
    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, f'{name}.wav')
    peak = max(1e-9, max(abs(s) for s in samples))
    with wave.open(path, 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(RATE)
        # ピークを -3dB 程度に揃えて、音量差が出ないようにする
        gain = 0.7 / peak
        w.writeframes(b''.join(
            struct.pack('<h', int(max(-1.0, min(1.0, s * gain)) * 32767)) for s in samples
        ))
    print(f'{path}  {os.path.getsize(path) / 1024:.1f} KB')


def pop() -> list[float]:
    """「ぽん」：水やり・タップ。低めから高めへ一瞬で駆け上がる"""
    n = int(RATE * 0.12)
    out = []
    for i in range(n):
        t = i / RATE
        f = 420 + 680 * (i / n) ** 0.5      # 420Hz → 1100Hz
        s = math.sin(2 * math.pi * f * t)
        s += 0.25 * math.sin(4 * math.pi * f * t)   # 倍音で少し丸く
        out.append(s * envelope(i, n, 0.02, 0.75))
    return out


def chime() -> list[float]:
    """「ちりん」：収穫・成功。三度＋五度の和音をきらっと鳴らす"""
    n = int(RATE * 0.75)
    partials = [(880, 1.0), (1108.7, 0.6), (1318.5, 0.45), (1760, 0.22)]
    out = []
    for i in range(n):
        t = i / RATE
        s = sum(a * math.sin(2 * math.pi * f * t) * math.exp(-3.2 * t * (f / 880))
                for f, a in partials)
        out.append(s * envelope(i, n, 0.004, 0.55))
    return out


def stamp() -> list[float]:
    """「とん」：確定・スタンプ。短いノイズ＋低音のアタック"""
    n = int(RATE * 0.18)
    seed = 12345
    out = []
    for i in range(n):
        t = i / RATE
        # 乱数は使わず線形合同法で固定（実行ごとに同じ音になるように）
        seed = (1103515245 * seed + 12345) % (1 << 31)
        noise = (seed / (1 << 30)) - 1.0
        body = math.sin(2 * math.pi * 150 * t) * math.exp(-22 * t)
        out.append((body + 0.35 * noise * math.exp(-60 * t)) * envelope(i, n, 0.001, 0.5))
    return out


if __name__ == '__main__':
    write('pop', pop())
    write('chime', chime())
    write('stamp', stamp())
