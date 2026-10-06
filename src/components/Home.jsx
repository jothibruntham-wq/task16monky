import { useEffect, useState } from "react";

/* ---------- timeline helpers ---------- */
const DURATION = 12; // seconds, loops
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, k) => a + (b - a) * k;
const ease = (k) => {
  k = clamp(k);
  return k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
};
const rnd = (n) => {
  const s = Math.sin(n * 127.1) * 43758.5453;
  return s - Math.floor(s);
};

const GROUND = 372;
const HAND_UP = 70;

/* Timeline
   0.0-2.0  "CHECKING THE NETWORK..." monkey sits, two wire ends lie apart
   2.0-3.0  monkey grabs BOTH loose ends and lifts them into his hands
   3.0      ends touch -> connection made -> SHOCK (blue bolts, shaking)
   3.6      "404 ERROR" fades in
   6.0-7.2  monkey lets go, wires fall apart again
   10.2+    error fades, loop restarts */
function pose(t) {
  let x = 180, y = GROUND, rot = 0, hold = 0;

  if (t < 2) {
    y = GROUND + Math.sin(t * 3) * 0.8;
  } else if (t < 3) {
    const k = ease(t - 2);
    y = GROUND - k * HAND_UP;
    hold = k;
  } else if (t < 6) {
    hold = 1;
    y = GROUND - HAND_UP;
    const s = 1 - ease((t - 5.4) / 0.6); // shaking calms before release
    x = 180 + Math.sin(t * 70) * 2.6 * s;
    y += Math.sin(t * 55) * 1.5 * s;
    rot = Math.sin(t * 48) * 5 * s;
  } else if (t < 7.2) {
    const k = ease((t - 6) / 1.2);
    y = lerp(GROUND - HAND_UP, GROUND, k);
    hold = 1 - ease((t - 6) / 0.5);
  }
  return { x, y, rot, hold };
}

/* ---------- wires ---------- */
const WIRE_DARK = "#1b1f2a";
const WIRE_BLUE = "#1e88ff";
const WIRE_CORE = "#d6ecff";
const PLUG_L = { x: 102, y: 360 };
const PLUG_R = { x: 262, y: 360 };
const REST_L = { x: 140, y: 391 };
const REST_R = { x: 220, y: 391 };

function boltPoints(P0, P1, P2, seed, amp, n = 16) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const bx = (1 - u) * (1 - u) * P0.x + 2 * (1 - u) * u * P1.x + u * u * P2.x;
    const by = (1 - u) * (1 - u) * P0.y + 2 * (1 - u) * u * P1.y + u * u * P2.y;
    const edge = i === 0 || i === n ? 0 : 1;
    const off = (rnd(seed + i * 3.1) - 0.5) * amp * edge;
    pts.push(`${(bx + off * 0.35).toFixed(1)},${(by + off).toFixed(1)}`);
  }
  return pts.join(" ");
}

function Wire({ t, x, y, hold }) {
  const J = { x, y: y - 16 }; // the monkey's hands
  const endL = { x: lerp(REST_L.x, J.x, hold), y: lerp(REST_L.y, J.y, hold) };
  const endR = { x: lerp(REST_R.x, J.x, hold), y: lerp(REST_R.y, J.y, hold) };

  const sag = lerp(18, -3, hold);
  const cL = { x: (PLUG_L.x + endL.x) / 2, y: (PLUG_L.y + endL.y) / 2 + sag };
  const cR = { x: (PLUG_R.x + endR.x) / 2, y: (PLUG_R.y + endR.y) / 2 + sag };

  const halves = [
    { key: "l", P0: PLUG_L, P1: cL, P2: endL, d: `M${PLUG_L.x} ${PLUG_L.y} Q${cL.x} ${cL.y} ${endL.x} ${endL.y}` },
    { key: "r", P0: PLUG_R, P1: cR, P2: endR, d: `M${PLUG_R.x} ${PLUG_R.y} Q${cR.x} ${cR.y} ${endR.x} ${endR.y}` },
  ];

  // connected only when both ends meet in the monkey's hand
  const e = ease((hold - 0.92) / 0.08);
  const fill = ease((t - 3.3) / 0.5) * e;
  const glow = fill * 0.6;
  const pulseLen = 22;
  const p = (t % 0.3) / 0.3;
  const pulseOffset = pulseLen - p * (100 + pulseLen);
  const pulseOpacity = e * (1 - fill);

  // electric shock
  const seed = Math.floor(t * 25) * 7.3;
  const shock = e;
  const sparks = Array.from({ length: 7 }, (_, k) => {
    const a = rnd(seed + k * 5.7) * Math.PI * 2;
    const len = 14 + rnd(seed + k * 2.3) * 20;
    let px = J.x, py = J.y;
    const pts = [`${px.toFixed(1)},${py.toFixed(1)}`];
    for (let s = 1; s <= 3; s++) {
      const aa = a + (rnd(seed + k * 9 + s) - 0.5) * 1.3;
      px += Math.cos(aa) * (len / 3);
      py += Math.sin(aa) * (len / 3);
      pts.push(`${px.toFixed(1)},${py.toFixed(1)}`);
    }
    return pts.join(" ");
  });

  return (
    <g>
      {halves.map(({ d, key }) => (
        <path key={"g" + key} d={d} fill="none" stroke={WIRE_BLUE} strokeWidth="9"
              opacity={glow} filter="url(#mk-blur)" strokeLinecap="round" />
      ))}
      {halves.map(({ d, key }) => (
        <path key={"o" + key} d={d} fill="none" stroke={WIRE_DARK} strokeWidth="4.2" strokeLinecap="round" />
      ))}
      {halves.map(({ d, key }) => (
        <path key={"b" + key} d={d} fill="none" stroke={WIRE_BLUE} strokeWidth="3" strokeLinecap="round" opacity={fill} />
      ))}
      {halves.map(({ d, key }) => (
        <path key={"p" + key} d={d} fill="none" stroke={WIRE_BLUE} strokeWidth="3.4" strokeLinecap="round"
              pathLength="100" strokeDasharray={`${pulseLen} 200`} strokeDashoffset={pulseOffset}
              opacity={pulseOpacity} />
      ))}
      {halves.map(({ d, key }) => (
        <path key={"c" + key} d={d} fill="none" stroke={WIRE_CORE} strokeWidth="1.1" strokeLinecap="round"
              pathLength="100" strokeDasharray="6 10" strokeDashoffset={-t * 7} opacity={fill * 0.9} />
      ))}

      {/* jagged lightning running along both wires */}
      {shock > 0.02 && halves.map(({ key, P0, P1, P2 }) => (
        <g key={"z" + key} opacity={shock}>
          <polyline points={boltPoints(P0, P1, P2, seed + (key === "l" ? 1 : 50), 9)}
                    fill="none" stroke={WIRE_BLUE} strokeWidth="3" strokeLinejoin="round" filter="url(#mk-blur)" />
          <polyline points={boltPoints(P0, P1, P2, seed + (key === "l" ? 1 : 50), 9)}
                    fill="none" stroke="#fff" strokeWidth="1.2" strokeLinejoin="round" />
        </g>
      ))}

      {/* sparks bursting from the joined ends */}
      {shock > 0.02 && (
        <g opacity={shock}>
          <circle cx={J.x} cy={J.y} r={9 + rnd(seed) * 5} fill={WIRE_BLUE} opacity="0.45" filter="url(#mk-blur)" />
          {sparks.map((pts, i) => (
            <g key={i}>
              <polyline points={pts} fill="none" stroke={WIRE_BLUE} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" opacity="0.6" />
              <polyline points={pts} fill="none" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            </g>
          ))}
        </g>
      )}

      {/* plugs on the monitor / server */}
      {[PLUG_L, PLUG_R].map((c, i) => (
        <g key={i}>
          <circle cx={c.x} cy={c.y} r="4.2" fill={WIRE_DARK} />
          <circle cx={c.x} cy={c.y} r="1.9" fill={WIRE_BLUE} opacity={0.25 + fill * 0.75} />
        </g>
      ))}
      {/* loose connector tips (visible while the ends are apart) */}
      {[endL, endR].map((c, i) => (
        <g key={"t" + i} opacity={1 - e}>
          <rect x={c.x - 3} y={c.y - 3} width="6" height="6" rx="1.5" fill={WIRE_DARK} />
          <circle cx={c.x} cy={c.y} r="1.2" fill="#9aa4b8" />
        </g>
      ))}
    </g>
  );
}

/* ---------- the SVG scene ---------- */
function Scene({ t }) {
  const { x, y, rot, hold } = pose(t);
  const e = ease((hold - 0.92) / 0.08);
  const shock = e;

  // header: CHECKING... first, then 404 ERROR
  const errOp = ease((t - 3.6) / 0.5) * (1 - ease((t - 10.2) / 0.5));
  const checkOp = 1 - errOp;
  const dots = ".".repeat(1 + (Math.floor(t * 2.5) % 3));

  const amp = 2 + e * 11;
  const wave = Array.from({ length: 21 }, (_, i) => {
    const px = 6 + i * 1.8;
    const py = 15 + Math.sin(i * 0.9 + t * 9) * amp * (i % 3 === 0 ? 1 : 0.55);
    return `${px.toFixed(1)},${py.toFixed(1)}`;
  }).join(" ");

  const blink = t % 3.2 > 3.08 && shock < 0.5;
  const glow = (0.4 + e * 0.6 + Math.sin(t * 6) * 0.05 * e) * errOp;

  return (
    <svg viewBox="0 0 360 640" width="100%" height="100%" role="img"
         aria-label="Animated 404 error scene: a monkey connects a loose network wire between a monitor and a server and gets shocked"
         style={{ display: "block", overflow: "visible" }}>
      <defs>
        <filter id="mk-blur" x="-20%" y="-50%" width="140%" height="200%">
          <feGaussianBlur stdDeviation="4" />
        </filter>
        <filter id="mk-glow404" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="5" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* header: checking text */}
      <text x="180" y="212" textAnchor="middle" fontSize="15" fontWeight="800" letterSpacing="2"
            fontFamily="'Trebuchet MS', 'Segoe UI', sans-serif" fill="#1b1f2a" opacity={checkOp}>
        CHECKING THE NETWORK{dots}
      </text>

      {/* header: 404 ERROR box */}
      <g opacity={errOp}>
        <g opacity={glow / Math.max(errOp, 0.001)}>
          <text x="180" y="206" textAnchor="middle" fontSize="70" fontWeight="900"
                fontFamily="'Trebuchet MS', 'Segoe UI', sans-serif" fill="#1e88ff" filter="url(#mk-glow404)">
            404
          </text>
        </g>
        <text x="180" y="232" textAnchor="middle" fontSize="15" fontWeight="700" letterSpacing="5"
              fontFamily="Georgia, 'Times New Roman', serif" fill="#1b1f2a">
          ERROR
        </text>
      </g>

      {/* platform */}
      <rect x="40" y="398" width="280" height="14" rx="2" fill="#2f7d3a" stroke="#1b1f2a" strokeWidth="2.5" />
      <rect x="40" y="398" width="280" height="4" fill="#3f9a4b" />

      {/* monitor */}
      <g transform="translate(50 336)">
        <rect x="0" y="0" width="52" height="38" rx="3" fill="#fff" stroke="#1b1f2a" strokeWidth="2.5" />
        <rect x="4" y="4" width="44" height="30" rx="1.5" fill="#e6f3ff" stroke="#1e88ff" strokeWidth="1.5" />
        <polyline points={wave} fill="none" stroke="#1e88ff" strokeWidth="1.6" strokeLinejoin="round" />
        <rect x="23" y="38" width="6" height="14" fill="#1b1f2a" />
        <rect x="14" y="50" width="24" height="4" rx="1.5" fill="#1b1f2a" />
      </g>

      {/* server tower */}
      <g transform="translate(262 306)">
        <rect x="0" y="0" width="38" height="94" rx="4" fill="#3b3f6b" stroke="#1b1f2a" strokeWidth="2.5" />
        {[0, 1, 2].map((i) => (
          <g key={i} transform={`translate(5 ${8 + i * 22})`}>
            <rect width="28" height="16" rx="2" fill="#262a4d" stroke="#1b1f2a" strokeWidth="1.2" />
            <circle cx="6" cy="8" r="2" fill={Math.sin(t * 5 + i * 2) > 0 || e > 0.5 ? "#37d67a" : "#2a6b46"} />
            <rect x="12" y="6" width="12" height="4" rx="1" fill="#5a5f93" />
          </g>
        ))}
        <rect x="8" y="78" width="22" height="6" rx="2" fill="#262a4d" />
      </g>

      {/* wires */}
      <Wire t={t} x={x} y={y} hold={hold} />

      {/* monkey */}
      <g transform={`translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(${rot.toFixed(1)})`}>
        <path d={`M-12 8 C-34 ${10 + Math.sin(t * 3) * 3} -36 -22 -22 -24`} fill="none" stroke="#1b1f2a" strokeWidth="5" strokeLinecap="round" />
        <path d={`M-12 8 C-34 ${10 + Math.sin(t * 3) * 3} -36 -22 -22 -24`} fill="none" stroke="#f4efe6" strokeWidth="2" strokeLinecap="round" />
        <path d={`M-11 -6 L${lerp(-17, -9, hold)} ${lerp(6, -16, hold)}`} stroke="#1b1f2a" strokeWidth="6" strokeLinecap="round" />
        <path d={`M-11 -6 L${lerp(-17, -9, hold)} ${lerp(6, -16, hold)}`} stroke="#f4efe6" strokeWidth="3" strokeLinecap="round" />
        <path d={`M11 -6 L${lerp(17, 9, hold)} ${lerp(6, -16, hold)}`} stroke="#1b1f2a" strokeWidth="6" strokeLinecap="round" />
        <path d={`M11 -6 L${lerp(17, 9, hold)} ${lerp(6, -16, hold)}`} stroke="#f4efe6" strokeWidth="3" strokeLinecap="round" />
        <ellipse cx="0" cy="2" rx="14" ry="16" fill="#f4efe6" stroke="#1b1f2a" strokeWidth="2.5" />
        <path d="M-12 -4 Q0 8 12 -4 L14 6 Q0 20 -14 6 Z" fill="#1b1f2a" opacity="0.9" />
        <ellipse cx="-8" cy={lerp(18, 14, hold)} rx="6" ry="3.5" fill="#f5c9a0" stroke="#1b1f2a" strokeWidth="2" />
        <ellipse cx="8" cy={lerp(18, 14, hold)} rx="6" ry="3.5" fill="#f5c9a0" stroke="#1b1f2a" strokeWidth="2" />
        <circle cx="-15" cy="-26" r="5.5" fill="#f5c9a0" stroke="#1b1f2a" strokeWidth="2" />
        <circle cx="15" cy="-26" r="5.5" fill="#f5c9a0" stroke="#1b1f2a" strokeWidth="2" />
        <circle cx="0" cy="-27" r="15" fill="#f4efe6" stroke="#1b1f2a" strokeWidth="2.5" />
        <path d="M-6 -41 Q0 -48 6 -41" fill="none" stroke="#1b1f2a" strokeWidth="2.5" strokeLinecap="round" />
        <ellipse cx="0" cy="-24" rx="10" ry="9" fill="#f5c9a0" />
        {shock > 0.5 ? (
          <>
            {/* shocked: wide eyes + open mouth */}
            <circle cx="-4" cy="-27" r="3.2" fill="#fff" stroke="#1b1f2a" strokeWidth="1.2" />
            <circle cx="4" cy="-27" r="3.2" fill="#fff" stroke="#1b1f2a" strokeWidth="1.2" />
            <circle cx={-4 + Math.sin(t * 40) * 0.8} cy="-27" r="1" fill="#1b1f2a" />
            <circle cx={4 + Math.sin(t * 40) * 0.8} cy="-27" r="1" fill="#1b1f2a" />
            <ellipse cx="0" cy="-18.5" rx="3" ry="3.4" fill="#1b1f2a" />
          </>
        ) : blink ? (
          <path d="M-6 -27 h4 M2 -27 h4" stroke="#1b1f2a" strokeWidth="1.8" strokeLinecap="round" />
        ) : (
          <>
            <circle cx="-4" cy="-27" r="1.8" fill="#1b1f2a" />
            <circle cx="4" cy="-27" r="1.8" fill="#1b1f2a" />
            <path d={hold > 0.5 ? "M-3 -19 Q0 -16 3 -19" : "M-3 -20 Q0 -18 3 -20"} fill="none" stroke="#1b1f2a" strokeWidth="1.6" strokeLinecap="round" />
          </>
        )}
        {/* electric glow on the monkey while shocked */}
        <ellipse cx="0" cy="-8" rx="26" ry="34" fill={WIRE_BLUE}
                 opacity={shock * (0.18 + 0.12 * Math.sin(t * 80))} filter="url(#mk-blur)" />
      </g>

      {/* copy */}
      <text x="180" y="470" textAnchor="middle" fontSize="17" fontWeight="800"
            fontFamily="Georgia, 'Times New Roman', serif" fill="#1b1f2a">
        You lost your network connection
      </text>
      <text x="180" y="488" textAnchor="middle" fontSize="9.5"
            fontFamily="'Trebuchet MS', 'Segoe UI', sans-serif" fill="#4b5263">
        The page you are looking for is not available
      </text>
    </svg>
  );
}

/* ---------- full-screen page ---------- */
export default function MonkeyVideo() {
  const [t, setT] = useState(0);

  useEffect(() => {
    let raf;
    let last = null;
    const tick = (now) => {
      if (last == null) last = now;
      const dt = (now - last) / 1000;
      last = now;
      setT((prev) => (prev + dt) % DURATION);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const dark = clamp((t - 11.2) / 0.8) * 0.6;
  const shockNow = t >= 3 && t < 6 ? 1 : 0;
  const flash = shockNow && rnd(Math.floor(t * 20)) > 0.72 ? 0.28 : 0;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "grid",
        placeItems: "center",
        background: [
          "linear-gradient(#ffe9a6, #fff0bf) top / 100% 10.94vh no-repeat",
          "linear-gradient(#ffd9cc, #ffcdbb) bottom / 100% 10.16vh no-repeat",
          "linear-gradient(135deg, #eef3fb, #dbe5f4)",
        ].join(", "),
      }}
    >
      <div style={{ height: "100vh", width: "100%", maxWidth: "56.25vh" }}>
        <Scene t={t} />
      </div>

      {/* white-blue flash when the shock hits */}
      <div style={{ position: "absolute", inset: 0, background: "#bfe0ff", opacity: flash, pointerEvents: "none" }} />

      {/* end-of-loop fade */}
      <div style={{ position: "absolute", inset: 0, background: "#0b0d14", opacity: dark, pointerEvents: "none" }} />
    </div>
  );
}