<template>
  <label class="label w-fit cursor-pointer gap-3">
    <input
      type="checkbox"
      class="toggle toggle-sm"
      v-bind="$attrs"
    />
    <span class="label-text text-sm">{{ label }}</span>
  </label>
</template>

<script setup lang="ts">
defineOptions({
  inheritAttrs: false
})
defineProps<{
  label: string
}>()
</script>