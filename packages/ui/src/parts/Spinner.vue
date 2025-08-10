<template>
  <div class="spin" :style="{width: size+'px', height: size+'px'}"></div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ size?: number }>(), { size: 20 });
</script>

<style scoped>
.ui-spinner {
  border: 4px solid var(--secondary-accent);
  border-left-color: var(--primary-accent);
  border-radius: 50%;
  width: 40px;
  height: 40px;
  animation: spin 1s linear infinite;
}
@keyframes s { from { transform: rotate(0) } to { transform: rotate(360deg) } }
</style>

