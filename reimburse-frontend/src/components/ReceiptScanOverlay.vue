<script setup>
import { computed } from "vue";
import { useI18n } from "@/composables/useI18n";

defineProps({
  active: {
    type: Boolean,
    default: false,
  },
});

const { t } = useI18n();

const stages = computed(() => [
  t("receiptScanStage1"),
  t("receiptScanStage2"),
  t("receiptScanStage3"),
]);
</script>

<template>
  <Transition name="scan-fade">
    <div
      v-if="active"
      class="receipt-scan"
      role="status"
      aria-live="polite"
      :aria-label="t('parsingReceipt')"
    >
      <div class="receipt-scan__panel">
        <div class="receipt-scan__frame" aria-hidden="true">
          <span class="receipt-scan__corner receipt-scan__corner--tl" />
          <span class="receipt-scan__corner receipt-scan__corner--tr" />
          <span class="receipt-scan__corner receipt-scan__corner--bl" />
          <span class="receipt-scan__corner receipt-scan__corner--br" />
          <div class="receipt-scan__grid" />
          <div class="receipt-scan__beam" />
          <div class="receipt-scan__pulse" />
        </div>

        <div class="receipt-scan__copy">
          <p class="receipt-scan__title">{{ t("parsingReceipt") }}</p>
          <ul class="receipt-scan__stages">
            <li
              v-for="(stage, i) in stages"
              :key="stage"
              class="receipt-scan__stage"
              :style="{ animationDelay: `${i * 0.35}s` }"
            >
              <span class="receipt-scan__dot" />
              {{ stage }}
            </li>
          </ul>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.scan-fade-enter-active,
.scan-fade-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}
.scan-fade-enter-from,
.scan-fade-leave-to {
  opacity: 0;
  transform: translateY(4px);
}

.receipt-scan {
  position: relative;
  overflow: hidden;
  border-radius: 0.75rem;
  border: 1px solid rgb(229 229 229);
  background: linear-gradient(
    165deg,
    rgb(250 250 250) 0%,
    rgb(245 245 245) 45%,
    rgb(250 250 250) 100%
  );
}

.receipt-scan__panel {
  display: grid;
  gap: 1rem;
  padding: 1rem;
}

@media (min-width: 640px) {
  .receipt-scan__panel {
    grid-template-columns: 7.5rem 1fr;
    align-items: center;
  }
}

.receipt-scan__frame {
  position: relative;
  aspect-ratio: 1;
  width: 100%;
  max-width: 7.5rem;
  margin-inline: auto;
  border-radius: 0.5rem;
  background: rgb(255 255 255);
  box-shadow: inset 0 0 0 1px rgb(0 0 0 / 0.06);
}

.receipt-scan__grid {
  position: absolute;
  inset: 0.7rem;
  border-radius: 0.25rem;
  background-image:
    linear-gradient(rgb(0 0 0 / 0.04) 1px, transparent 1px),
    linear-gradient(90deg, rgb(0 0 0 / 0.04) 1px, transparent 1px);
  background-size: 10px 10px;
  opacity: 0.9;
  animation: grid-drift 3.2s linear infinite;
}

.receipt-scan__beam {
  position: absolute;
  left: 0.7rem;
  right: 0.7rem;
  height: 2px;
  border-radius: 999px;
  background: linear-gradient(
    90deg,
    transparent,
    rgb(23 23 23 / 0.75),
    transparent
  );
  box-shadow: 0 0 12px rgb(23 23 23 / 0.25);
  animation: scan-beam 1.8s ease-in-out infinite;
}

.receipt-scan__pulse {
  position: absolute;
  inset: 28%;
  border-radius: 999px;
  border: 1px solid rgb(23 23 23 / 0.18);
  animation: pulse-ring 1.8s ease-out infinite;
}

.receipt-scan__corner {
  position: absolute;
  width: 0.7rem;
  height: 0.7rem;
  border-color: rgb(23 23 23);
  border-style: solid;
}
.receipt-scan__corner--tl {
  top: 0.45rem;
  left: 0.45rem;
  border-width: 1.5px 0 0 1.5px;
}
.receipt-scan__corner--tr {
  top: 0.45rem;
  right: 0.45rem;
  border-width: 1.5px 1.5px 0 0;
}
.receipt-scan__corner--bl {
  bottom: 0.45rem;
  left: 0.45rem;
  border-width: 0 0 1.5px 1.5px;
}
.receipt-scan__corner--br {
  bottom: 0.45rem;
  right: 0.45rem;
  border-width: 0 1.5px 1.5px 0;
}

.receipt-scan__copy {
  min-width: 0;
}

.receipt-scan__title {
  margin: 0;
  font-size: 0.875rem;
  font-weight: 500;
  letter-spacing: 0.01em;
  color: rgb(23 23 23);
}

.receipt-scan__stages {
  margin: 0.65rem 0 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 0.35rem;
}

.receipt-scan__stage {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.75rem;
  color: rgb(115 115 115);
  opacity: 0.35;
  animation: stage-glow 2.1s ease-in-out infinite;
}

.receipt-scan__dot {
  width: 0.35rem;
  height: 0.35rem;
  border-radius: 999px;
  background: rgb(23 23 23);
  opacity: 0.45;
  flex-shrink: 0;
}

@keyframes scan-beam {
  0% {
    top: 18%;
    opacity: 0;
  }
  10% {
    opacity: 1;
  }
  90% {
    opacity: 1;
  }
  100% {
    top: 78%;
    opacity: 0;
  }
}

@keyframes pulse-ring {
  0% {
    transform: scale(0.85);
    opacity: 0.55;
  }
  70% {
    transform: scale(1.35);
    opacity: 0;
  }
  100% {
    transform: scale(1.35);
    opacity: 0;
  }
}

@keyframes grid-drift {
  from {
    background-position: 0 0, 0 0;
  }
  to {
    background-position: 0 10px, 10px 0;
  }
}

@keyframes stage-glow {
  0%,
  100% {
    opacity: 0.35;
  }
  40% {
    opacity: 1;
    color: rgb(38 38 38);
  }
}

@media (prefers-reduced-motion: reduce) {
  .receipt-scan__beam,
  .receipt-scan__pulse,
  .receipt-scan__grid,
  .receipt-scan__stage {
    animation: none;
  }
  .receipt-scan__beam {
    top: 50%;
    opacity: 0.7;
  }
  .receipt-scan__stage {
    opacity: 0.8;
  }
}
</style>
