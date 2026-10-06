import { useEffect, useState } from "react";

/* ---------- timeline helpers ---------- */
const DURATION = 10; // seconds, loops like the source clip
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, k) => a + (b - a) * k;
const ease = (k) => {
  k = clamp(k);
  return k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
};

const GROUND = 372; // monkey origin y when sitting on the platform

/* Where is the monkey at time t, and is it gripping the cable? */
function pose(t) {
  let x = 180,
    y = GROUND,
    rot = 0,
    hold = 0;

  if (t < 2) {
    // sits and breathes
    y = GROUND + Math.sin(t * 3) * 0.8;
  } else if (t < 2.8) {
    // grabs the cable and pulls himself up
    const k = ease((t - 2) / 0.8);
    y = GROUND - k * 70;
    hold = k;
  } else if (t < 4.6) {
    // swings on the taut cable
    const s = t - 2.8;
    hold = 1;
    y = GROUND - 70 + Math.sin(s * 4) * 6;
    x = 180 + Math.sin(s * 3.5) * 14;
  } else if (t < 6.8) {
    // spins toward the server and lets go
    const k = ease((t - 4.6) / 2.2);
    rot = k * 1080;
    x = lerp(180, 255, k);
    y = lerp(GROUND - 70, GROUND - 8, k);
    hold = 1 - ease((t - 5.8) / 1.0);
  } else if (t < 7.4) {
    x = 255;
    y = GROUND - 8;
  } else if (t < 8.6) {
    // wanders back to the middle
    const k = ease((t - 7.4) / 1.2);
    x = lerp(255, 180, k);
    y = lerp(GROUND - 8, GROUND, k) - Math.abs(Math.sin(k * Math.PI * 3)) * 4;
  }
  return { x, y, rot, hold };
}

/* ---------- WIRE (rewritten to match the video) ----------
   Video behaviour:
   1. Black wire lies slack on the platform, plugged into the monitor + server.
   2. When the monkey grabs it, the wire pulls taut and blue energy pulses
      race in from BOTH plugs toward the monkey.
   3. Pulses merge into a solid glowing blue wire (thin white-blue core)
      while the monkey swings.
   4. After he lets go the blue drains out and the wire falls back, black
      and slack, onto the platform.
*/
const WIRE_DARK = "#1b1f2a";
const WIRE_BLUE = "#1e88ff";
const WIRE_CORE = "#d6ecff";

// 0..1 progress of a pulse that loops every `period` seconds
const pulseAt = (t, period) => (t % period) / period;

function wireState(t, x, y, hold) {
  // plugs: monitor right side, server left side
  const L = { x: 102, y: 360 };
  const R = { x: 262, y: 360 };

  // slack rest point sits low on the platform, behind the monkey
  const rest = { x: 180, y: 391 };
  const hand = { x, y: y - 16 };
  const J = { x: lerp(rest.x, hand.x, hold), y: lerp(rest.y, hand.y, hold) };

  // slack droops; taut wire gets a tiny upward bow like the clip
  const sag = lerp(16, -3, hold);
  const cL = { x: (L.x + J.x) / 2, y: (L.y + J.y) / 2 + sag };
  const cR = { x: (R.x + J.x) / 2, y: (R.y + J.y) / 2 + sag };

  // two halves so energy can flow from each plug inward
  const left = `M${L.x} ${L.y} Q${cL.x} ${cL.y} ${J.x} ${J.y}`;
  const right = `M${R.x} ${R.y} Q${cR.x} ${cR.y} ${J.x} ${J.y}`;

  // energy phases (only while hold is on)
  const taut = hold > 0.02;
  const fill = taut ? ease((t - 3.0) / 0.7) * ease(hold * 1.4) : 0; // solid blue
  const pulsing = taut && fill < 0.98; // travelling pulses
  const pulseLen = 22; // percent of wire length
  const p = pulseAt(t, 0.55);
  const pulseOffset = pulseLen - p * (100 + pulseLen);
  const pulseOpacity = pulsing ? ease(hold * 1.5) * (1 - fill) : 0;

  return { L, R, left, right, fill, pulseLen, pulseOffset, pulseOpacity };
}

function Wire({ t, x, y, hold }) {
  const w = wireState(t, x, y, hold);
  const glow = w.fill * 0.55;
  const flow = -t * 70;

  const halves = [
    { d: w.left, key: "l" },
    { d: w.right, key: "r" },
  ];

  return (
    <g>
      {/* soft glow once energised */}
      {halves.map(({ d, key }) => (
        <path key={"g" + key} d={d} fill="none" stroke={WIRE_BLUE} strokeWidth="9"
              opacity={glow} filter="url(#mk-blur)" strokeLinecap="round" />
      ))}

      {/* black wire body (outline + core) */}
      {halves.map(({ d, key }) => (
        <path key={"o" + key} d={d} fill="none" stroke={WIRE_DARK} strokeWidth="4.2"
              strokeLinecap="round" />
      ))}

      {/* solid blue fill fading in over the black */}
      {halves.map(({ d, key }) => (
        <path key={"b" + key} d={d} fill="none" stroke={WIRE_BLUE} strokeWidth="3"
              strokeLinecap="round" opacity={w.fill} />
      ))}

      {/* travelling pulses racing in from each plug toward the monkey */}
      {halves.map(({ d, key }) => (
        <path key={"p" + key} d={d} fill="none" stroke={WIRE_BLUE} strokeWidth="3.4"
              strokeLinecap="round" pathLength="100"
              strokeDasharray={`${w.pulseLen} 200`} strokeDashoffset={w.pulseOffset}
              opacity={w.pulseOpacity} />
      ))}

      {/* thin bright core + flowing sparkle on the energised wire */}
      {halves.map(({ d, key }) => (
        <path key={"c" + key} d={d} fill="none" stroke={WIRE_CORE} strokeWidth="1.1"
              strokeLinecap="round" pathLength="100" strokeDasharray="6 10"
              strokeDashoffset={flow / 10} opacity={w.fill * 0.9} />
      ))}

      {/* plugs at the monitor and server */}
      {[w.L, w.R].map((c, i) => (
        <g key={i}>
          <circle cx={c.x} cy={c.y} r="4.2" fill={WIRE_DARK} />
          <circle cx={c.x} cy={c.y} r="1.9" fill={WIRE_BLUE} opacity={0.25 + w.fill * 0.75} />
        </g>
      ))}
    </g>
  );
}

/* ---------- the SVG scene ---------- */
function Scene({ t }) {
  const { x, y, rot, hold } = pose(t);

  // monitor waveform reacts to the connection
  const amp = 2 + hold * 9;
  const wave = Array.from({ length: 21 }, (_, i) => {
    const px = 6 + i * 1.8;
    const py = 15 + Math.sin(i * 0.9 + t * 9) * amp * (i % 3 === 0 ? 1 : 0.55);
    return `${px.toFixed(1)},${py.toFixed(1)}`;
  }).join(" ");

  const blink = t % 3.2 > 3.08;
  const glow = 0.35 + hold * 0.65 + Math.sin(t * 6) * 0.05 * hold;

  return (
    <svg viewBox="0 0 360 640" width="100%" height="100%" role="img"
         aria-label="Animated 404 error scene: a monkey swinging between a monitor and a server" style={{ display: "block", overflow: "visible" }}>
      <defs>
        <linearGradient id="mk-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#eef3fb" />
          <stop offset="1" stopColor="#dbe5f4" />
        </linearGradient>
        <linearGradient id="mk-top" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#ffe9a6" />
          <stop offset="1" stopColor="#fff0bf" />
        </linearGradient>
        <linearGradient id="mk-bot" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#ffd9cc" />
          <stop offset="1" stopColor="#ffcdbb" />
        </linearGradient>
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

      {/* 404 */}
      <g opacity={glow} style={{ transition: "none" }}>
        <text x="180" y={206 - hold * 4} textAnchor="middle" fontSize="70" fontWeight="900"
              fontFamily="'Trebuchet MS', 'Segoe UI', sans-serif" fill="#1e88ff" filter="url(#mk-glow404)">
          404
        </text>
      </g>
      <text x="180" y={232 - hold * 4} textAnchor="middle" fontSize="15" fontWeight="700" letterSpacing="5"
            fontFamily="Georgia, 'Times New Roman', serif" fill="#1b1f2a">
        ERROR
      </text>

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
            <circle cx="6" cy="8" r="2" fill={Math.sin(t * 5 + i * 2) > 0 || hold > 0.5 ? "#37d67a" : "#2a6b46"} />
            <rect x="12" y="6" width="12" height="4" rx="1" fill="#5a5f93" />
          </g>
        ))}
        <rect x="8" y="78" width="22" height="6" rx="2" fill="#262a4d" />
      </g>

      {/* wire */}
      <Wire t={t} x={x} y={y} hold={hold} />

      {/* monkey */}
      <g transform={`translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(${rot.toFixed(1)})`}>
        {/* tail */}
        <path d={`M-12 8 C-34 ${10 + Math.sin(t * 3) * 3} -36 -22 -22 -24`} fill="none"
              stroke="#1b1f2a" strokeWidth="5" strokeLinecap="round" />
        <path d={`M-12 8 C-34 ${10 + Math.sin(t * 3) * 3} -36 -22 -22 -24`} fill="none"
              stroke="#f4efe6" strokeWidth="2" strokeLinecap="round" />
        {/* arms: raise to cable when holding */}
        <path d={`M-11 -6 L${lerp(-17, -9, hold)} ${lerp(6, -16, hold)}`} stroke="#1b1f2a" strokeWidth="6" strokeLinecap="round" />
        <path d={`M-11 -6 L${lerp(-17, -9, hold)} ${lerp(6, -16, hold)}`} stroke="#f4efe6" strokeWidth="3" strokeLinecap="round" />
        <path d={`M11 -6 L${lerp(17, 9, hold)} ${lerp(6, -16, hold)}`} stroke="#1b1f2a" strokeWidth="6" strokeLinecap="round" />
        <path d={`M11 -6 L${lerp(17, 9, hold)} ${lerp(6, -16, hold)}`} stroke="#f4efe6" strokeWidth="3" strokeLinecap="round" />
        {/* body */}
        <ellipse cx="0" cy="2" rx="14" ry="16" fill="#f4efe6" stroke="#1b1f2a" strokeWidth="2.5" />
        <path d="M-12 -4 Q0 8 12 -4 L14 6 Q0 20 -14 6 Z" fill="#1b1f2a" opacity="0.9" />
        {/* feet */}
        <ellipse cx="-8" cy={lerp(18, 14, hold)} rx="6" ry="3.5" fill="#f5c9a0" stroke="#1b1f2a" strokeWidth="2" />
        <ellipse cx="8" cy={lerp(18, 14, hold)} rx="6" ry="3.5" fill="#f5c9a0" stroke="#1b1f2a" strokeWidth="2" />
        {/* head */}
        <circle cx="-15" cy="-26" r="5.5" fill="#f5c9a0" stroke="#1b1f2a" strokeWidth="2" />
        <circle cx="15" cy="-26" r="5.5" fill="#f5c9a0" stroke="#1b1f2a" strokeWidth="2" />
        <circle cx="0" cy="-27" r="15" fill="#f4efe6" stroke="#1b1f2a" strokeWidth="2.5" />
        <path d="M-6 -41 Q0 -48 6 -41" fill="none" stroke="#1b1f2a" strokeWidth="2.5" strokeLinecap="round" />
        <ellipse cx="0" cy="-24" rx="10" ry="9" fill="#f5c9a0" />
        {blink ? (
          <>
            <path d="M-6 -27 h4 M2 -27 h4" stroke="#1b1f2a" strokeWidth="1.8" strokeLinecap="round" />
          </>
        ) : (
          <>
            <circle cx="-4" cy="-27" r="1.8" fill="#1b1f2a" />
            <circle cx="4" cy="-27" r="1.8" fill="#1b1f2a" />
          </>
        )}
        <path d={hold > 0.5 ? "M-3 -19 Q0 -16 3 -19" : "M-3 -20 Q0 -18 3 -20"} fill="none"
              stroke="#1b1f2a" strokeWidth="1.6" strokeLinecap="round" />
      </g>

      {/* copy */}
      <text x="180" y="470" textAnchor="middle" fontSize="17" fontWeight="800"
            fontFamily="Georgia, 'Times New Roman', serif" fill="#1b1f2a">
        Your lost you'r network connection
      </text>
      <text x="180" y="488" textAnchor="middle" fontSize="9.5"
            fontFamily="'Trebuchet MS', 'Segoe UI', sans-serif" fill="#4b5263">
        The page you are looking for is not available
      </text>
    </svg>
  );
}

/* ---------- full-screen page: background colour covers the whole desktop ---------- */
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

  // same end-of-loop fade as the scene, but over the whole screen
  const dark = clamp((t - 9.2) / 0.8) * 0.6;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "grid",
        placeItems: "center",
        // top band + bottom band + panel colour, stretched edge to edge
        background: [
          "linear-gradient(#ffe9a6, #fff0bf) top / 100% 10.94vh no-repeat",
          "linear-gradient(#ffd9cc, #ffcdbb) bottom / 100% 10.16vh no-repeat",
          "linear-gradient(135deg, #eef3fb, #dbe5f4)",
        ].join(", "),
      }}
    >
      {/* scene box: no black background, no clipping, no rounded frame */}
      <div style={{ height: "100vh", width: "100%", maxWidth: "56.25vh" }}>
        <Scene t={t} />
      </div>

      {/* end-of-loop fade over the full screen */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "#0b0d14",
          opacity: dark,
          pointerEvents: "none",
        }}
      />
    </div>
  );
}