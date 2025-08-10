<template>
  <button class="ui-btn" :class="variant"><slot /></button>
</template>

<script setup lang="ts">
defineProps<{ variant?: 'primary'|'danger' }>();
</script>

