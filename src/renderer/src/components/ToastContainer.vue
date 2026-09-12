<script setup lang="ts">
import { useUiStore } from '../stores/ui'

const uiStore = useUiStore()

function handleAction(id: string, onAction?: () => void): void {
  onAction?.()
  uiStore.dismissToast(id)
}
</script>

<template>
  <div class="pointer-events-none fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 flex-col gap-2">
    <TransitionGroup name="tt-toast">
      <div
        v-for="toast in uiStore.toasts"
        :key="toast.id"
        class="pointer-events-auto flex items-center gap-3 rounded-lg border border-base-300 bg-base-100 px-4 py-2.5 text-sm shadow-lg"
      >
        <span>{{ toast.message }}</span>
        <button
          v-if="toast.actionLabel"
          class="font-semibold text-primary hover:underline"
          @click="handleAction(toast.id, toast.onAction)"
        >
          {{ toast.actionLabel }}
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.tt-toast-enter-active,
.tt-toast-leave-active {
  transition: all 0.2s ease;
}
.tt-toast-enter-from,
.tt-toast-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
</style>
