<template>
  <div v-if="open" class="ui-modal">
    <div class="backdrop" @click="$emit('close')"></div>
    <div class="panel">
      <header class="head">
        <slot name="title"><strong>Modal</strong></slot>
        <button class="ui-btn" @click="$emit('close')">닫기</button>
      </header>
      <div class="body"><slot /></div>
      <footer class="foot"><slot name="footer" /></footer>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{ open: boolean }>();
defineEmits<{ close: [] }>();
</script>

<style scoped>
.ui-modal { position: relative; z-index: 1; background: var(--card-bg); border: 1px solid var(--card-border); border-radius: 12px; min-width: 500px; }
.ui-modal-header { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; border-bottom: 1px solid var(--card-border); }
.ui-modal-title { font-size: 16px; font-weight: bold; }
.ui-modal-close-btn { cursor: pointer; background: transparent; border: 0; color: var(--text); font-size: 20px; }
.backdrop { position: absolute; inset: 0; background: rgba(0,0,0,.6); }
.panel { position: relative; width: min(680px, 92vw); background: rgba(15,23,42,.98); border: 1px solid rgba(148,163,184,.15); border-radius: 12px; padding: 12px; }
.head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.body { padding: 8px 0; }
.foot { margin-top: 8px; text-align: right; }
</style>

