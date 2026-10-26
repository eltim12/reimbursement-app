import { onMounted, onUnmounted, ref } from "vue";

/** Matches the Tailwind `md` breakpoint (48rem). */
export function useMinMd() {
  const matches = ref(
    typeof window !== "undefined" &&
      window.matchMedia("(min-width: 48rem)").matches,
  );
  let media;

  const sync = () => {
    matches.value = media.matches;
  };

  onMounted(() => {
    media = window.matchMedia("(min-width: 48rem)");
    matches.value = media.matches;
    media.addEventListener("change", sync);
  });

  onUnmounted(() => {
    media?.removeEventListener("change", sync);
  });

  return matches;
}
