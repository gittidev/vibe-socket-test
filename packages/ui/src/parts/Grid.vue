<template>
  <div class="ui-grid" :class="`cols-${cols}`"><slot /></div>
  </template>

<script setup lang="ts">
defineProps<{ cols?: 1|2|3 }>();
</script>

