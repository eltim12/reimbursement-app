<script setup>
defineProps({
  class: {
    type: [String, Object, Array],
    default: "",
  },
});
</script>

<template>
  <div role="group" :class="$props.class">
    <slot />
  </div>
</template>
