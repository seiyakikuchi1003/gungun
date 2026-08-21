import React from 'react';
import Svg, { Path, Circle, Ellipse, Defs, RadialGradient, Stop } from 'react-native-svg';

type Props = {
  size?: number;
  /** 木にぶら下がっている商品の数。葉の茂り具合だけが変わる（大小のラベルは付けない） */
  count?: number;
};

/**
 * 一覧に置く小さな木のアイコン。
 *
 * 2026-07-28 MTG（めたん様）：「大きな木」「MAX」という大小の表現は使わない。
 * ここでも文言は一切出さず、葉が少し茂るだけの見た目の変化に留める。
 * 収穫タブのタネ一覧などで、その行が「木」であることを示すために使う。
 */
export function MiniTree({ size = 22, count = 0 }: Props) {
  // Web では SVG の id が DOM 全体で共有されるため、一覧に複数並んでも衝突しないようにする
  const gid = `mt-leaf-${React.useId().replace(/:/g, '')}`;
  const s = size;
  const cx = s / 2;
  // 数が増えると葉がわずかに広がる（0.30 → 0.40 で頭打ち）
  const r = s * Math.min(0.3 + count * 0.012, 0.4);
  const cy = s * 0.38;
  const groundY = s * 0.9;

  return (
    <Svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}>
      <Defs>
        <RadialGradient id={gid} cx="0.4" cy="0.3" r="0.85">
          <Stop offset="0" stopColor="#A7E07E" />
          <Stop offset="1" stopColor="#78C24F" />
        </RadialGradient>
      </Defs>
      {/* 地面 */}
      <Ellipse cx={cx} cy={groundY} rx={s * 0.3} ry={s * 0.06} fill="#CBE9A6" />
      {/* 幹 */}
      <Path
        d={`M${cx - s * 0.055},${groundY} L${cx - s * 0.04},${cy + r * 0.5} L${cx + s * 0.04},${cy + r * 0.5} L${cx + s * 0.055},${groundY} Z`}
        fill="#A9743F"
      />
      {/* 葉（3つの円を重ねてこんもりさせる） */}
      <Circle cx={cx} cy={cy} r={r} fill={`url(#${gid})`} />
      <Circle cx={cx - r * 0.62} cy={cy + r * 0.22} r={r * 0.6} fill={`url(#${gid})`} />
      <Circle cx={cx + r * 0.62} cy={cy + r * 0.18} r={r * 0.62} fill={`url(#${gid})`} />
      {/* ハイライト */}
      <Circle cx={cx - r * 0.25} cy={cy - r * 0.4} r={r * 0.3} fill="#B9E88F" opacity={0.6} />
      {/* 商品が付いていればみかんを1つだけ添える */}
      {count > 0 && <Circle cx={cx + r * 0.5} cy={cy + r * 0.35} r={s * 0.075} fill="#F2963A" />}
    </Svg>
  );
}
