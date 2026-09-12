<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { useSettingsStore } from './stores/settings'
import { useTimerStore } from './stores/timer'
import AppLayout from './layouts/AppLayout.vue'

const route = useRoute()
const settingsStore = useSettingsStore()
const timerStore = useTimerStore()

const isBare = computed(() => route.name === 'mini-timer')

onMounted(async () => {
  await settingsStore.load()
  await timerStore.init()
})

onUnmounted(() => {
  timerStore.dispose()
})
</script>

<template>
  <RouterView v-if="isBare" />
  <AppLayout v-else />
</template>
