// Scanner shader adapted from React Bits (David Haz). See THIRD-PARTY-NOTICES.md.
(() => {
const VERTEX = `#version 300 es
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

const FRAGMENT = `#version 300 es
precision highp float;

uniform vec2 uResolution;
uniform float uWave;
uniform float uSweep;
uniform float uSweepWidth;
uniform float uTrail;
uniform float uScale;
uniform float uFrequency;
uniform float uRipple;
uniform float uDensity;
uniform float uLineWidth;
uniform float uGlow;
uniform float uDirection;
uniform float uSpread;
uniform float uBrightness;
uniform float uVignette;
uniform float uOpacity;
uniform float uScanline;
uniform float uRatio;
uniform float uGrain;
uniform float uTime;
uniform vec2 uMouse;
uniform float uPresence;
uniform float uMouseRadius;
uniform float uMouseStrength;
uniform float uAttract;
uniform vec3 uPings[6];
uniform float uIntro;
uniform float uLightMode;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;

out vec4 fragColor;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float signal(vec2 p, float t) {
  float w = sin(p.x * 1.3 + t * 0.7);
  w += sin(p.y * 1.7 - t * 0.52) * 0.8;
  w += sin((p.x + p.y) * 0.9 + t * 0.91) * 0.6;
  w += sin((p.x - p.y) * 1.53 - t * 0.63) * 0.42;
  return w * 0.35;
}

float smoother(float x) {
  x = clamp(x, 0.0, 1.0);
  return x * x * x * (x * (x * 6.0 - 15.0) + 10.0);
}

vec2 axes(vec2 p) {
  if (uDirection < 0.5) return vec2(p.y, p.x);
  if (uDirection < 1.5) return vec2(p.x, -p.y);
  return vec2((p.x + p.y) * 0.70710678, (p.x - p.y) * 0.70710678);
}

float coverage(float lc, float width) {
  float fw = max(fwidth(lc), 1e-5);
  float dist = abs(fract(lc + 0.5) - 0.5) / fw;
  float crowd = smoothstep(0.2, 0.55, fw);
  float cover = clamp(width * 0.5 + 0.5 - dist, 0.0, 1.0) * min(width, 1.0);
  return mix(cover, min(width * fw, 1.0), crowd);
}

void main() {
  vec2 uv = (gl_FragCoord.xy * 2.0 - uResolution) / uResolution.y;
  vec2 p = uv / max(uScale, 0.001);
  vec2 ax = axes(p);

  float sig = signal(p * uFrequency, uWave);
  float coord = ax.x + sig * uRipple;

  vec2 mp = uMouse / max(uScale, 0.001);
  vec2 md = p - mp;
  float radius = max(uMouseRadius / max(uScale, 0.001), 0.01);
  float lens = exp(-dot(md, md) / (radius * radius)) * uPresence;
  float mouseAxis = axes(mp).x + signal(mp * uFrequency, uWave) * uRipple;
  coord -= (coord - mouseAxis) * lens * uMouseStrength * mix(0.55, -0.9, uAttract);

  float pingLight = 0.0;
  for (int i = 0; i < 6; i++) {
    vec3 ping = uPings[i];
    if (ping.z < 0.0) continue;
    float d = length(uv - ping.xy);
    float age = ping.z;
    float r = age * 1.1;
    float w = 0.12 + age * 0.1;
    float band = exp(-((d - r) * (d - r)) / (w * w));
    float fade = exp(-age * 0.9) * smoothstep(0.0, 0.12, age);
    coord += band * fade * 0.018 / max(uScale, 0.001);
    pingLight += band * fade;
  }

  float u = fract(uSweep - coord / max(uSweepWidth, 0.05));
  float tail = mix(11.0, 1.8, clamp(uTrail, 0.0, 1.0));
  float lead = smoothstep(0.84, 1.0, u);
  lead *= lead;
  float sweep = max(exp(-u * tail), lead);
  float head = max(exp(-u * 26.0), lead * lead * lead);

  float introFront = mix(-1.6, 1.6, smoother(uIntro)) / max(uScale, 0.001);
  float reveal = 1.0 - smoothstep(introFront - 0.05, introFront + 0.3, coord);
  float introHead = exp(-abs(coord - introFront) * 14.0) * (1.0 - uIntro) * step(0.0001, 1.0 - uIntro);
  reveal = mix(reveal, 1.0, step(0.9999, uIntro));

  float lit = clamp(sweep * 0.86 + lens * uMouseStrength * 0.7 + pingLight * 0.9 + introHead, 0.0, 1.6);
  float hot = clamp(head + introHead + pingLight * 0.35, 0.0, 1.0);

  float lc = coord * uDensity;
  float width = uLineWidth * (1.0 + lit * 1.4 + hot * 0.9);
  float thread = 0.62 + 0.38 * hash(vec2(floor(lc + 0.5), 3.7));
  float split = uSpread * (0.5 + lit * 1.3) * max(fwidth(lc), 1e-5);
  float cg = coverage(lc, width);
  float cr = coverage(lc + split, width);
  float cb = coverage(lc - split, width);

  float fw = max(fwidth(lc), 1e-5);
  float dist = abs(fract(lc + 0.5) - 0.5) / fw;
  float crowd = smoothstep(0.2, 0.55, fw);
  float halo = exp(-dist / (3.0 + uGlow * 9.0)) * (1.0 - crowd) * uGlow * lit * 1.15;

  float base = 0.11 * reveal;
  float level = (base + lit * (1.0 - base)) * thread * uBrightness;

  vec3 tone = mix(uColor1, uColor2, smoothstep(0.05, 0.75, lit));
  tone = mix(tone, uColor3, hot);
  vec3 haloTone = mix(uColor1, uColor2, 0.65);

  float vx = smoother((1.0 - abs(uv.x / (uResolution.x / uResolution.y))) / 0.6);
  float vy = smoother((1.0 - abs(uv.y)) / 0.6);
  float vignette = mix(1.0, vx * vy, uVignette);

  vec3 cover3 = vec3(cr, cg, cb);
  float alphaLine = max(max(cr, cg), cb) * level;
  vec3 colLine = tone * cover3 * level;

  float grain = (hash(gl_FragCoord.xy + fract(uTime) * 91.7) - 0.5) * uGrain;
  float scan = 1.0 - uScanline * 0.55 * (0.5 + 0.5 * cos(gl_FragCoord.y * 6.2831853 / (3.0 * uRatio)));

  if (uLightMode > 0.5) {
    float ink = clamp(alphaLine * vignette * scan, 0.0, 1.0);
    float wash = clamp(halo * 0.28 * vignette, 0.0, 1.0);
    float alpha = clamp(ink + wash * (1.0 - ink) + grain * 0.5 * ink, 0.0, 1.0) * uOpacity;
    vec3 col = (tone * ink + haloTone * wash * (1.0 - ink)) / max(ink + wash * (1.0 - ink), 1e-4);
    fragColor = vec4(col * alpha, alpha);
    return;
  }

  vec3 col = (colLine + haloTone * halo) * vignette * scan;
  float alpha = clamp(max(alphaLine, halo) * vignette * scan + grain * max(alphaLine, 0.04), 0.0, 1.0);
  col = clamp(col + grain * 0.6 * alpha, 0.0, 1.0);
  col = min(col, vec3(alpha));
  fragColor = vec4(col * uOpacity, alpha * uOpacity);
}`;

const canvas = document.querySelector('#scanner');
const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false });
if (!gl) return; // The CSS ambient gradient remains as a fallback.
function compile(type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source); gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) { gl.deleteShader(shader); return null; }
  return shader;
}
const vertex = compile(gl.VERTEX_SHADER, VERTEX), fragment = compile(gl.FRAGMENT_SHADER, FRAGMENT);
if (!vertex || !fragment) return;
const program = gl.createProgram(); gl.attachShader(program, vertex); gl.attachShader(program, fragment); gl.linkProgram(program);
gl.deleteShader(vertex); gl.deleteShader(fragment);
if (!gl.getProgramParameter(program, gl.LINK_STATUS)) { gl.deleteProgram(program); return; }
const vao = gl.createVertexArray(), u = {};
for (let i = 0; i < gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS); i++) {
  const info = gl.getActiveUniform(program, i); u[info.name.replace(/\[0\]$/, '')] = gl.getUniformLocation(program, info.name);
}
const reduce = matchMedia('(prefers-reduced-motion: reduce)');
const pointer = { x: 0, y: 0, inside: false }, mouse = { x: 0, y: 0 };
const pings = new Float32Array(18); for (let i = 0; i < 6; i++) pings[i * 3 + 2] = -1;
let ratio = 1, frame = 0, last = 0, clock = 0, presence = 0, lost = false;
function draw() {
  gl.viewport(0, 0, canvas.width, canvas.height); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); gl.useProgram(program);
  gl.uniform2f(u.uResolution, canvas.width, canvas.height);
  const settings = { uWave: clock * .28, uSweep: -.39 + clock * .09, uSweepWidth: 1.6, uTrail: .55,
    uScale: 1.5, uFrequency: 2, uRipple: .22, uDensity: 11, uLineWidth: 1.1 * ratio,
    uGlow: .45, uDirection: 0, uSpread: .45, uBrightness: .55, uVignette: .45,
    uOpacity: .55, uScanline: .2, uRatio: ratio, uGrain: .015, uTime: clock,
    uPresence: reduce.matches ? 0 : presence, uMouseRadius: .5, uMouseStrength: .35,
    uAttract: 0, uIntro: 1, uLightMode: 0 };
  for (const [key, value] of Object.entries(settings)) gl.uniform1f(u[key], value);
  gl.uniform2f(u.uMouse, mouse.x, mouse.y); gl.uniform3fv(u.uPings, pings);
  gl.uniform3f(u.uColor1, .545, .361, .965); // #8b5cf6
  gl.uniform3f(u.uColor2, 1, .420, .169); // #ff6b2b
  gl.uniform3f(u.uColor3, .75, .42, .58); // Muted highlight, never white.
  gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); gl.bindVertexArray(vao); gl.drawArrays(gl.TRIANGLES, 0, 3);
}
function render(now) {
  frame = 0;
  if (lost || document.hidden) return;
  const dt = last ? Math.min((now - last) / 1000, .05) : 1 / 30;
  if (!reduce.matches && last && now - last < 32) { frame = requestAnimationFrame(render); return; }
  last = now;
  if (!reduce.matches) clock += dt;
  const follow = 1 - Math.exp(-dt / .12);
  mouse.x += (pointer.x - mouse.x) * follow; mouse.y += (pointer.y - mouse.y) * follow;
  presence += ((pointer.inside ? 1 : 0) - presence) * follow;
  draw();
  if (!reduce.matches) frame = requestAnimationFrame(render);
}
function wake() { if (!frame && !lost && !document.hidden) { last = 0; frame = requestAnimationFrame(render); } }
function resize() {
  ratio = Math.min(devicePixelRatio || 1, 1.5);
  canvas.width = Math.max(1, Math.round(innerWidth * ratio)); canvas.height = Math.max(1, Math.round(innerHeight * ratio)); wake();
}
window.addEventListener('resize', resize, { passive: true });
window.addEventListener('pointermove', event => {
  if (reduce.matches) return;
  pointer.x = (event.clientX * 2 - innerWidth) / innerHeight; pointer.y = (innerHeight - event.clientY * 2) / innerHeight; pointer.inside = true;
}, { passive: true });
document.documentElement.addEventListener('pointerleave', () => pointer.inside = false);
document.addEventListener('visibilitychange', () => { if (document.hidden) { cancelAnimationFrame(frame); frame = 0; } else wake(); });
reduce.addEventListener('change', () => { cancelAnimationFrame(frame); frame = 0; wake(); });
canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); lost = true; cancelAnimationFrame(frame); frame = 0; });
// On context loss the static ambient gradient keeps the interface readable.
window.addEventListener('pagehide', () => cancelAnimationFrame(frame));
window.addEventListener('pageshow', wake);
resize();
})();

