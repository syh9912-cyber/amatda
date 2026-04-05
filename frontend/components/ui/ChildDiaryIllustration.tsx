import React from 'react';
import Svg, {
  Circle,
  Ellipse,
  Rect,
  Path,
  G,
  Line,
} from 'react-native-svg';

interface ChildDiaryIllustrationProps {
  width?: number;
  height?: number;
}

export function ChildDiaryIllustration({
  width = 200,
  height = 200,
}: ChildDiaryIllustrationProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 200 200">
      {/* Sparkle stars */}
      <G>
        <Sparkle cx={30} cy={30} size={6} />
        <Sparkle cx={170} cy={25} size={5} />
        <Sparkle cx={20} cy={100} size={4} />
        <Sparkle cx={180} cy={80} size={5} />
        <Sparkle cx={160} cy={150} size={4} />
        <Sparkle cx={40} cy={155} size={3} />
      </G>

      {/* Open diary / book */}
      <Rect
        x={55}
        y={130}
        width={90}
        height={60}
        rx={4}
        fill="#B8D4E3"
      />
      <Rect
        x={60}
        y={135}
        width={80}
        height={50}
        rx={3}
        fill="#FFFFFF"
      />
      <Line
        x1={100}
        y1={135}
        x2={100}
        y2={185}
        stroke="#B8D4E3"
        strokeWidth={1.5}
      />
      {/* Book lines left page */}
      <Line x1={67} y1={146} x2={93} y2={146} stroke="#D1E5F0" strokeWidth={1} />
      <Line x1={67} y1={153} x2={90} y2={153} stroke="#D1E5F0" strokeWidth={1} />
      <Line x1={67} y1={160} x2={92} y2={160} stroke="#D1E5F0" strokeWidth={1} />
      <Line x1={67} y1={167} x2={88} y2={167} stroke="#D1E5F0" strokeWidth={1} />
      {/* Book lines right page */}
      <Line x1={107} y1={146} x2={133} y2={146} stroke="#D1E5F0" strokeWidth={1} />
      <Line x1={107} y1={153} x2={130} y2={153} stroke="#D1E5F0" strokeWidth={1} />
      <Line x1={107} y1={160} x2={132} y2={160} stroke="#D1E5F0" strokeWidth={1} />

      {/* Body (simple rounded shape) */}
      <Ellipse cx={100} cy={135} rx={30} ry={22} fill="#E8D5F5" />

      {/* Head */}
      <Circle cx={100} cy={85} r={30} fill="#FFE0BD" />

      {/* Hair */}
      <Path
        d="M70 80 Q70 50 100 48 Q130 50 130 80"
        fill="#8B6F47"
      />
      <Path
        d="M68 82 Q65 65 78 55"
        fill="#8B6F47"
        stroke="none"
      />
      <Path
        d="M132 82 Q135 65 122 55"
        fill="#8B6F47"
        stroke="none"
      />
      {/* Hair tuft on top */}
      <Path
        d="M95 50 Q98 38 105 50"
        fill="#8B6F47"
      />

      {/* Eyes */}
      <Circle cx={90} cy={87} r={3} fill="#3D3D3D" />
      <Circle cx={110} cy={87} r={3} fill="#3D3D3D" />
      {/* Eye highlights */}
      <Circle cx={91} cy={86} r={1} fill="#FFFFFF" />
      <Circle cx={111} cy={86} r={1} fill="#FFFFFF" />

      {/* Rosy cheeks */}
      <Ellipse cx={82} cy={95} rx={6} ry={4} fill="#FFB4B4" opacity={0.6} />
      <Ellipse cx={118} cy={95} rx={6} ry={4} fill="#FFB4B4" opacity={0.6} />

      {/* Smile */}
      <Path
        d="M94 97 Q100 103 106 97"
        fill="none"
        stroke="#D4845A"
        strokeWidth={1.5}
        strokeLinecap="round"
      />

      {/* Left arm reaching to book */}
      <Path
        d="M75 125 Q65 140 70 150"
        fill="none"
        stroke="#FFE0BD"
        strokeWidth={8}
        strokeLinecap="round"
      />

      {/* Right arm holding pencil */}
      <Path
        d="M125 125 Q135 138 130 148"
        fill="none"
        stroke="#FFE0BD"
        strokeWidth={8}
        strokeLinecap="round"
      />

      {/* Pencil */}
      <G transform="translate(128, 140) rotate(30)">
        <Rect x={0} y={0} width={5} height={22} rx={1} fill="#FFD93D" />
        <Rect x={0} y={0} width={5} height={4} rx={1} fill="#F0C420" />
        <Path d="M0 22 L2.5 28 L5 22" fill="#FFB4B4" />
      </G>
    </Svg>
  );
}

function Sparkle({
  cx,
  cy,
  size,
}: {
  cx: number;
  cy: number;
  size: number;
}) {
  const h = size;
  const d = `
    M${cx} ${cy - h}
    L${cx + h * 0.3} ${cy}
    L${cx} ${cy + h}
    L${cx - h * 0.3} ${cy}
    Z
    M${cx - h} ${cy}
    L${cx} ${cy - h * 0.3}
    L${cx + h} ${cy}
    L${cx} ${cy + h * 0.3}
    Z
  `;
  return <Path d={d} fill="#FFD700" opacity={0.7} />;
}
