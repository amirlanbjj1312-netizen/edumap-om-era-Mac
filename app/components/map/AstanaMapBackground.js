import React from 'react';
import Svg, {
  Defs,
  LinearGradient,
  Stop,
  Rect,
  Path,
  Circle,
  Text,
  G,
  Line,
} from 'react-native-svg';

const WIDTH = 1024;
const HEIGHT = 1024;

const MAIN_RIVER_PATH =
  'M160 260 C260 220, 360 200, 460 230 C520 250, 560 300, 620 340 C680 384, 740 400, 782 430 C836 468, 870 528, 828 576 C792 618, 704 632, 640 670 C568 712, 540 760, 476 798 C420 832, 338 862, 276 842 C188 812, 138 738, 152 660 C164 592, 212 546, 246 502 C288 450, 226 390, 184 336 C144 288, 118 296, 160 260 Z';

const CITY_CORE_PATH =
  'M420 450 C470 410, 560 402, 624 438 C702 484, 734 574, 694 646 C660 708, 578 740, 504 726 C430 710, 360 648, 378 562 C392 500, 370 490, 420 450 Z';

const LEFT_DISTRICT_PATH =
  'M260 640 C320 600, 380 584, 438 598 C506 614, 548 660, 566 710 C582 758, 566 818, 502 836 C434 856, 350 832, 294 792 C240 754, 204 692, 260 640 Z';

const RIGHT_DISTRICT_PATH =
  'M620 360 C684 340, 760 356, 808 402 C858 450, 876 526, 842 582 C812 630, 744 650, 688 636 C620 618, 578 562, 584 502 C588 450, 580 380, 620 360 Z';

const RING_ROAD_PATH =
  'M280 300 C440 200, 640 200, 780 320 C900 422, 908 612, 820 736 C722 874, 516 896, 372 822 C226 746, 176 552, 260 406 C270 386, 260 320, 280 300 Z';

const GRID_LINES = [
  { x1: 200, y1: 120, x2: 920, y2: 880 },
  { x1: 140, y1: 280, x2: 880, y2: 200 },
  { x1: 120, y1: 520, x2: 920, y2: 520 },
  { x1: 520, y1: 100, x2: 520, y2: 920 },
  { x1: 720, y1: 160, x2: 840, y2: 860 },
];

const LANDMARKS = [
  { cx: 520, cy: 520, label: 'Baiterek' },
  { cx: 448, cy: 620, label: 'Expo' },
  { cx: 612, cy: 460, label: 'Ak Orda' },
  { cx: 688, cy: 606, label: 'Left Bank' },
  { cx: 360, cy: 560, label: 'Old City' },
];

const LANDMARK_COLOR = '#2563EB';

const renderLandmark = (landmark, index) => (
  <G key={landmark.label}>
    <Circle
      cx={landmark.cx}
      cy={landmark.cy}
      r={18}
      fill={LANDMARK_COLOR}
      opacity="0.9"
    />
    <Circle cx={landmark.cx} cy={landmark.cy} r={10} fill="#FFFFFF" />
    <Circle cx={landmark.cx} cy={landmark.cy} r={4} fill={LANDMARK_COLOR} />
    <Text
      x={landmark.cx}
      y={landmark.cy + 32}
      fontSize="22"
      fontWeight="600"
      fill="#1E293B"
      opacity="0.8"
      textAnchor="middle"
    >
      {landmark.label}
    </Text>
  </G>
);

export default function AstanaMapBackground() {
  return (
    <Svg width="100%" height="100%" viewBox={`0 0 ${WIDTH} ${HEIGHT}`}>
      <Defs>
        <LinearGradient id="bgGradient" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor="#ECFEFF" />
          <Stop offset="100%" stopColor="#E0F2FE" />
        </LinearGradient>
        <LinearGradient id="riverGradient" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0%" stopColor="#38BDF8" stopOpacity="0.95" />
          <Stop offset="100%" stopColor="#2563EB" stopOpacity="0.75" />
        </LinearGradient>
        <LinearGradient id="coreGradient" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0%" stopColor="#F8FAFC" stopOpacity="0.95" />
          <Stop offset="100%" stopColor="#E2E8F0" stopOpacity="0.85" />
        </LinearGradient>
        <LinearGradient id="districtGradient" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0%" stopColor="#DBEAFE" stopOpacity="0.85" />
          <Stop offset="100%" stopColor="#BFDBFE" stopOpacity="0.65" />
        </LinearGradient>
      </Defs>

      <Rect width={WIDTH} height={HEIGHT} fill="url(#bgGradient)" />

      <G opacity="0.28">
        {GRID_LINES.map((line, index) => (
          <Line
            key={`grid-${index}`}
            {...line}
            stroke="#94A3B8"
            strokeWidth={8}
            strokeLinecap="round"
          />
        ))}
      </G>

      <Path
        d={RING_ROAD_PATH}
        fill="none"
        stroke="#CBD5F5"
        strokeWidth={28}
        strokeDasharray="12 24"
        opacity="0.4"
      />

      <Path
        d={MAIN_RIVER_PATH}
        fill="url(#riverGradient)"
        stroke="#1D4ED8"
        strokeWidth={8}
        strokeLinecap="round"
        opacity="0.85"
      />

      <Path
        d={CITY_CORE_PATH}
        fill="url(#coreGradient)"
        stroke="#CBD5F5"
        strokeWidth={10}
        opacity="0.9"
      />

      <Path
        d={LEFT_DISTRICT_PATH}
        fill="url(#districtGradient)"
        stroke="#A5B4FC"
        strokeWidth={8}
        opacity="0.85"
      />

      <Path
        d={RIGHT_DISTRICT_PATH}
        fill="url(#districtGradient)"
        stroke="#93C5FD"
        strokeWidth={8}
        opacity="0.8"
      />

      <G opacity="0.7">
        <Path
          d="M220 380 L360 460 L280 540 L180 500 Z"
          fill="#F1F5F9"
          stroke="#CBD5F5"
          strokeWidth={6}
        />
        <Path
          d="M640 720 L760 660 L840 720 L780 800 Z"
          fill="#EFF6FF"
          stroke="#BFDBFE"
          strokeWidth={6}
        />
        <Path
          d="M360 280 L460 320 L420 380 L320 360 Z"
          fill="#F1F5F9"
          stroke="#CBD5F5"
          strokeWidth={6}
        />
      </G>

      <G opacity="0.75">
        <Path
          d="M520 520 L620 600"
          stroke="#2563EB"
          strokeWidth={10}
          strokeLinecap="round"
        />
        <Path
          d="M520 520 L450 620"
          stroke="#2563EB"
          strokeWidth={10}
          strokeLinecap="round"
        />
        <Path
          d="M520 520 L612 460"
          stroke="#2563EB"
          strokeWidth={10}
          strokeLinecap="round"
        />
      </G>

      <G>{LANDMARKS.map(renderLandmark)}</G>

      <Text
        x={WIDTH / 2}
        y={180}
        fontSize="48"
        fontWeight="700"
        fill="#1E3A8A"
        textAnchor="middle"
        opacity="0.45"
        letterSpacing="8"
      >
        ASTANA
      </Text>

      <Text
        x={WIDTH / 2}
        y={HEIGHT - 140}
        fontSize="28"
        fontWeight="600"
        fill="#3B82F6"
        opacity="0.25"
        textAnchor="middle"
        letterSpacing="6"
      >
        CAPITAL REGION
      </Text>

      <Rect
        x={52}
        y={52}
        width={WIDTH - 104}
        height={HEIGHT - 104}
        stroke="#BFDBFE"
        strokeWidth={8}
        rx={60}
        ry={60}
        opacity="0.3"
      />
    </Svg>
  );
}
