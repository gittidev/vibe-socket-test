<template>
  <div class="ui-tabs">
    <div class="tab-head">
      <button v-for="(t,i) in tabs" :key="i" class="tab"
              :class="{ active: i===modelValue }" @click="$emit('update:modelValue', i)">{{ t }}</button>
    </div>
    <div class="tab-body"><slot /></div>
  </div>
</template>

<script setup lang="ts">
defineProps<{ tabs: string[]; modelValue: number }>();
defineEmits<{ 'update:modelValue': [number] }>();
</script>

<style scoped>
.ui-tabs { display: flex; align-items: center; gap: 16px; border-bottom: 1px solid var(--card-border); }
.ui-tab-item { padding: 8px 12px; cursor: pointer; color: var(--text); }
.ui-tab-item.active { color: var(--primary-accent); border-bottom: 2px solid var(--primary-accent); }
</style>

