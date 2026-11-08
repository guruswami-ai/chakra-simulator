
import React, { useEffect, useRef } from 'react';

const VERTEX_SHADER = `
  attribute vec2 position;
  void main() {
    gl_Position = vec4(position, 0.0, 1.0);
  }
`;

// ═══════════════════════════════════════════════════════════════════════════
// MANDALA FRAGMENT SHADER
// ═══════════════════════════════════════════════════════════════════════════
// This shader creates the sacred geometry mandala pattern with dynamic colors
// that respond to both TPS (intensity) and perplexity (color shift).
//
// COLOR SYSTEM:
// - Low perplexity (genius): Vibrant purple/magenta → healthy, enlightened
// - High perplexity (confused): Sickly green/yellow → degraded, "going bad"
//
// SPEED SYSTEM:
// - Party mode (high intensity): Faster rotation, more saturation
// - Sluggish mode (low intensity): Slower, muted colors
//
// MODEL LOADED STATE:
// - When a model is loaded (standby), the mandala "powers up" with increased
//   brightness and gentle rotation, signaling readiness for inference
// ═══════════════════════════════════════════════════════════════════════════

const FRAGMENT_SHADER = `
  precision highp float;
  uniform float u_time;
  uniform vec2 u_resolution;
  uniform float u_intensity;    // TPS-based: 0 = sluggish, 1 = party/ludicrous
  uniform float u_perplexity;   // 0 = genius (vibrant), 1 = confused (sickly)
  uniform float u_modelLoaded;  // 0 = idle, 1 = model loaded (standby/active)
  uniform float u_oom;          // 0 = normal, 1 = OOM/BSOD blue
  uniform vec2 u_center;

  #define PI 3.1415926535897932384626433832795

  void main() {
    vec2 fragCoord = gl_FragCoord.xy;

    // ═══════════════════════════════════════════════════════════════════════
    // HEALTHY COLORS (low perplexity / genius mode)
    // Vibrant purple, magenta, and cyan - enlightened chakra energy
    // ═══════════════════════════════════════════════════════════════════════
    vec3 healthyColor1 = vec3(0.9, 0.0, 1.0);   // Purple/Magenta
    vec3 healthyColor2 = vec3(0.0, 0.7, 1.0);   // Cyan/Blue
    vec3 healthyAtmosphere = vec3(0.02, 0.0, 0.05); // Deep purple background

    // ═══════════════════════════════════════════════════════════════════════
    // SICKLY COLORS (high perplexity / confused mode)
    // Toxic green, bile yellow, putrid - "the brain is going bad"
    // ═══════════════════════════════════════════════════════════════════════
    vec3 sicklyColor1 = vec3(0.5, 0.8, 0.1);    // Toxic green
    vec3 sicklyColor2 = vec3(0.9, 0.7, 0.0);    // Bile yellow
    vec3 sicklyAtmosphere = vec3(0.03, 0.04, 0.0); // Sickly green-brown background

    // Interpolate between healthy and sickly based on perplexity
    float sickness = clamp(u_perplexity, 0.0, 1.0);
    vec3 color1 = mix(healthyColor1, sicklyColor1, sickness);
    vec3 color2 = mix(healthyColor2, sicklyColor2, sickness);
    vec3 atmosphere = mix(healthyAtmosphere, sicklyAtmosphere, sickness);

    // Desaturate slightly when sickly (dull, lifeless)
    float desaturation = sickness * 0.3;
    color1 = mix(color1, vec3(dot(color1, vec3(0.299, 0.587, 0.114))), desaturation);
    color2 = mix(color2, vec3(dot(color2, vec3(0.299, 0.587, 0.114))), desaturation);

    // Party mode boost: increase saturation when healthy and fast
    float partyBoost = u_intensity * (1.0 - sickness) * 0.3;
    color1 = color1 * (1.0 + partyBoost);
    color2 = color2 * (1.0 + partyBoost);

    // ═══════════════════════════════════════════════════════════════════════
    // BSOD BLUE (OOM state) — override all colors with deep blue
    // ═══════════════════════════════════════════════════════════════════════
    float oom = clamp(u_oom, 0.0, 1.0);
    vec3 bsodColor1 = vec3(0.0, 0.0, 0.8);       // Deep blue
    vec3 bsodColor2 = vec3(0.0, 0.1, 0.5);       // Dark navy
    vec3 bsodAtmosphere = vec3(0.0, 0.0, 0.03);  // Near-black blue
    color1 = mix(color1, bsodColor1, oom);
    color2 = mix(color2, bsodColor2, oom);
    atmosphere = mix(atmosphere, bsodAtmosphere, oom);

    vec3 activeColor1 = mix(color1, vec3(1.0, 0.1, 0.8) * (1.0 - sickness * 0.5), u_intensity * 0.5);

    // Use the dynamic center passed from the React component
    vec2 center = vec2(u_resolution.x * u_center.x, u_resolution.y * (1.0 - u_center.y));
    vec2 c = (fragCoord - center) / min(u_resolution.x, u_resolution.y);

    float angle = atan(c.y, c.x);
    float dist = length(c);
    angle /= (2. * PI);

    float mask = 1.;
    float distRound = (1. - ceil(dist * 6. * .5 + .25) * .1);

    // ═══════════════════════════════════════════════════════════════════════
    // SPEED: Faster in party mode, slower when sickly
    // Model loaded adds gentle rotation even at 0 TPS (standby state)
    // ═══════════════════════════════════════════════════════════════════════
    float idleSpeed = 0.01;                              // Very slow when no model
    float standbySpeed = 0.04;                           // Gentle spin when model loaded
    float baseSpeed = mix(idleSpeed, standbySpeed, u_modelLoaded);
    float partySpeedBoost = u_intensity * 0.35;          // Party mode = faster (increased)
    float sicknessSlowdown = sickness * 0.02;            // Sickly = sluggish, decaying
    float dynamicSpeed = baseSpeed + partySpeedBoost - sicknessSlowdown;
    dynamicSpeed = mix(dynamicSpeed, 0.005, oom);  // OOM: nearly frozen

    float time2 = (fract(dist * 6. * .5 + .25) > 0.5 ? -u_time * dynamicSpeed : u_time * dynamicSpeed) * distRound;

    float roundVal = floor(12. / (distRound * distRound) + 0.5);
    float ngfract = fract(angle * roundVal + time2 * .6);

    ngfract = abs(ngfract * 2. - 1.);
    ngfract *= (fract(dist * 6.) > .5 ? -1. : 1.);
    mask -= ceil(dist * 6. + .5 + ngfract * .5) * .1;

    vec3 baseAtmosphere = atmosphere * 0.8;
    vec3 baseColor = mix(baseAtmosphere, mix(color2, activeColor1, mask), distRound);

    // ═══════════════════════════════════════════════════════════════════════
    // PULSING: More energetic in party mode, slower/erratic when sickly
    // Model loaded state adds base brightness boost
    // ═══════════════════════════════════════════════════════════════════════

    // Idle = dim (0.3), Standby = medium (0.6), Active = bright (0.6-1.2)
    float idlePulse = 0.3;
    float standbyPulse = 0.65;
    float basePulse = mix(idlePulse, standbyPulse, u_modelLoaded);
    basePulse += u_intensity * 0.6;  // TPS boost on top

    // Sickly mode: add irregular flickering (unstable brain)
    float sicknessFlicker = sickness * sin(u_time * 3.7) * 0.1;
    basePulse = basePulse - (sickness * 0.2) + sicknessFlicker;

    // OOM: dim pulse, faint eerie throb
    basePulse = mix(basePulse, 0.4 + sin(u_time * 0.8) * 0.05, oom);

    // Idle = very dim (0.25), Standby = visible (0.55), Active = bright (0.55-1.0)
    float idleOpacity = 0.25;
    float standbyOpacity = 0.55;
    float finalOpacityScale = mix(idleOpacity, standbyOpacity, u_modelLoaded);
    finalOpacityScale += u_intensity * 0.45;  // TPS brightness boost

    // Dim slightly when very sickly
    finalOpacityScale *= (1.0 - sickness * 0.3);

    // OOM: dim but visible
    finalOpacityScale = mix(finalOpacityScale, 0.35, oom);

    // Add gentle pulsing glow when model is loaded (breathing effect)
    float loadedGlow = u_modelLoaded * (1.0 - u_intensity * 0.5) * sin(u_time * 0.5) * 0.08;
    finalOpacityScale += loadedGlow;

    gl_FragColor = vec4(baseColor * basePulse * finalOpacityScale, 1.0);
  }
`;

// ═══════════════════════════════════════════════════════════════════════════
// MANDALA SHADER COMPONENT
// ═══════════════════════════════════════════════════════════════════════════
// Props:
// - tps: Tokens per second (affects speed and saturation)
// - perplexity: Model perplexity score (affects color - high = sickly green/yellow)
// - centerX/Y: Dynamic center point for the mandala pattern
// - modelLoaded: Whether at least one model is loaded (triggers standby glow)

interface MandalaShaderProps {
  width: number;
  height: number;
  tps: number;
  centerX: number;
  centerY: number;
  perplexity?: number;   // Optional: 0-50+ scale, higher = more confused/sickly
  modelLoaded?: boolean; // Optional: true when a model is loaded (standby/active)
  oomState?: boolean;    // Optional: true = BSOD blue override (OOM error)
}

const MandalaShader: React.FC<MandalaShaderProps> = ({
  width,
  height,
  tps,
  centerX,
  centerY,
  perplexity = 0,      // Default to 0 (genius/healthy mode)
  modelLoaded = false, // Default to no model loaded
  oomState = false,    // Default to no OOM
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const intensityRef = useRef(0);
  const perplexityRef = useRef(0);
  const modelLoadedRef = useRef(0);
  const oomRef = useRef(0);
  const tpsRef = useRef(tps);
  const centerRef = useRef({ x: centerX, y: centerY });

  useEffect(() => {
    tpsRef.current = tps;
    centerRef.current = { x: centerX, y: centerY };
    // Normalize perplexity to 0-1 range (perplexity of 50+ = fully sickly)
    perplexityRef.current = Math.min(perplexity / 50, 1.0);
    // Boolean to 0/1 for shader
    modelLoadedRef.current = modelLoaded ? 1.0 : 0.0;
    oomRef.current = oomState ? 1.0 : 0.0;
  }, [tps, centerX, centerY, perplexity, modelLoaded, oomState]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext('webgl');
    if (!gl) return;

    const createShader = (gl: WebGLRenderingContext, type: number, source: string) => {
      const shader = gl.createShader(type);
      if (!shader) return null;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      return shader;
    };

    const program = gl.createProgram();
    const vs = createShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
    const fs = createShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    if (!program || !vs || !fs) return;

    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    gl.useProgram(program);

    const vertices = new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    const positionLoc = gl.getAttribLocation(program, 'position');
    gl.enableVertexAttribArray(positionLoc);
    gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);

    const timeLoc = gl.getUniformLocation(program, 'u_time');
    const resLoc = gl.getUniformLocation(program, 'u_resolution');
    const intensityLoc = gl.getUniformLocation(program, 'u_intensity');
    const perplexityLoc = gl.getUniformLocation(program, 'u_perplexity');
    const modelLoadedLoc = gl.getUniformLocation(program, 'u_modelLoaded');
    const oomLoc = gl.getUniformLocation(program, 'u_oom');
    const centerLoc = gl.getUniformLocation(program, 'u_center');

    // Refs for smooth transitions
    let smoothIntensity = 0;
    let smoothPerplexity = 0;
    let smoothModelLoaded = 0;
    let smoothOom = 0;

    let frameId: number;
    const render = (time: number) => {
      if (canvas.width !== window.innerWidth || canvas.height !== window.innerHeight) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        gl.viewport(0, 0, canvas.width, canvas.height);
      }

      // Smooth transition for intensity (TPS-based, log scale)
      // log scale so 1 TPS ≈ 0.0, 10 TPS ≈ 0.33, 100 TPS ≈ 0.67, 1000 TPS ≈ 1.0
      const targetIntensity = tpsRef.current > 0
        ? Math.min(Math.log10(tpsRef.current) / 3, 1.0)
        : 0;
      smoothIntensity += (targetIntensity - smoothIntensity) * 0.02;

      // Smooth transition for perplexity (color shift)
      smoothPerplexity += (perplexityRef.current - smoothPerplexity) * 0.03;

      // Smooth transition for model loaded (power-up effect)
      // Faster transition when powering up, slower when powering down
      const loadedTransitionSpeed = modelLoadedRef.current > smoothModelLoaded ? 0.04 : 0.02;
      smoothModelLoaded += (modelLoadedRef.current - smoothModelLoaded) * loadedTransitionSpeed;

      // Smooth OOM transition (~1s ease in/out)
      smoothOom += (oomRef.current - smoothOom) * 0.03;

      gl.useProgram(program);
      gl.uniform1f(timeLoc, time * 0.001);
      gl.uniform2f(resLoc, canvas.width, canvas.height);
      gl.uniform1f(intensityLoc, smoothIntensity);
      gl.uniform1f(perplexityLoc, smoothPerplexity);
      gl.uniform1f(modelLoadedLoc, smoothModelLoaded);
      gl.uniform1f(oomLoc, smoothOom);
      gl.uniform2f(centerLoc, centerRef.current.x, centerRef.current.y);

      gl.drawArrays(gl.TRIANGLES, 0, 6);
      frameId = requestAnimationFrame(render);
    };

    frameId = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(frameId);
      gl.deleteProgram(program);
      gl.deleteBuffer(buffer);
    };
  }, []);

  return (
    <canvas ref={canvasRef} className="fixed inset-0 w-full h-full pointer-events-none" style={{ opacity: 0.8, mixBlendMode: 'screen' }} />
  );
};

export default MandalaShader;
