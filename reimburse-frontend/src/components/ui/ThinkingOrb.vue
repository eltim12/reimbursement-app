<script setup>
/**
 * Vue port of Libraries.dev ThinkingOrb using the framework-free engine.
 * @see https://libraries.dev/orbs.html
 */
import { onMounted, onUnmounted, ref, watch } from "vue";
import {
  MODE_FRAMES,
  paintFrame,
  resolvePreset,
} from "thinking-orbs/engine";
import { cn } from "@/lib/utils";

const props = defineProps({
  /** @type {import('vue').PropType<'working'|'searching'|'solving'|'listening'|'connecting'|'weaving'|'composing'|'breathing'|'shaping'>} */
  state: { type: String, default: "working" },
  /** Tuned sizes only: 20 (inline) | 32 | 64 (page) */
  size: { type: Number, default: 64 },
  /** light = dark ink on light UI (our default chrome) */
  theme: { type: String, default: "light" },
  speed: { type: Number, default: 1 },
  paused: { type: Boolean, default: false },
  class: { type: [String, Object, Array], default: "" },
  ariaLabel: { type: String, default: "Loading" },
});

const canvasRef = ref(null);
let stopLoop = null;

function isDarkTheme() {
  if (props.theme === "dark") return true;
  if (props.theme === "light") return false;
  if (typeof document === "undefined") return false;
  const root = document.documentElement;
  if (root.classList.contains("dark") || root.dataset.theme === "dark") {
    return true;
  }
  if (root.classList.contains("light") || root.dataset.theme === "light") {
    return false;
  }
  return window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ?? false;
}

function orbSize() {
  const s = Number(props.size) || 64;
  if (s <= 20) return 20;
  if (s <= 32) return 32;
  return 64;
}

function start() {
  stopLoop?.();
  stopLoop = null;
  const canvas = canvasRef.value;
  if (!canvas) return;

  const size = orbSize();
  const dpr = Math.min(
    2,
    typeof devicePixelRatio !== "undefined" ? devicePixelRatio || 1 : 1,
  );
  canvas.width = Math.round(size * dpr);
  canvas.height = Math.round(size * dpr);
  canvas.style.width = `${size}px`;
  canvas.style.height = `${size}px`;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const { mode, speed: baseSpeed, opts } = resolvePreset(props.state, size);
  const frameFn = MODE_FRAMES[mode];
  if (!frameFn) return;
  const effSpeed = baseSpeed * (Number(props.speed) || 1);
  const dark = isDarkTheme();

  const draw = (tSec) => {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);
    paintFrame(ctx, frameFn(size, tSec, opts), dark);
  };

  const reduced =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

  if (reduced) {
    draw(0.6);
    return;
  }

  let raf = 0;
  let running = false;

  const loop = () => {
    draw((performance.now() / 1000) * effSpeed);
    if (running) raf = requestAnimationFrame(loop);
  };

  const startLoop = () => {
    if (running || props.paused) return;
    running = true;
    raf = requestAnimationFrame(loop);
  };

  const stop = () => {
    running = false;
    cancelAnimationFrame(raf);
  };

  draw((performance.now() / 1000) * effSpeed);

  let visible = true;
  const io =
    typeof IntersectionObserver !== "undefined"
      ? new IntersectionObserver(([entry]) => {
          visible = entry.isIntersecting;
          if (visible && document.visibilityState !== "hidden") startLoop();
          else stop();
        })
      : null;
  io?.observe(canvas);

  const onVis = () => {
    if (document.visibilityState === "hidden") stop();
    else if (visible && !props.paused) startLoop();
  };
  document.addEventListener("visibilitychange", onVis);

  if (!props.paused) startLoop();

  stopLoop = () => {
    stop();
    io?.disconnect();
    document.removeEventListener("visibilitychange", onVis);
  };
}

onMounted(start);
onUnmounted(() => {
  stopLoop?.();
  stopLoop = null;
});

watch(
  () => [props.state, props.size, props.theme, props.speed, props.paused],
  () => start(),
);
</script>

<template>
  <canvas
    ref="canvasRef"
    data-slot="thinking-orb"
    role="img"
    :aria-label="ariaLabel"
    :class="cn('inline-block shrink-0 align-middle', $props.class)"
  />
</template>
