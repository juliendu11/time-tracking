<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { computed } from 'vue'
import type { DailyBucket } from '@shared/types/domain'
import { formatDurationCompact } from '@shared/utils/duration'

const props = defineProps<{ buckets: DailyBucket[] }>()
const emit = defineEmits<{ selectDay: [date: string] }>()
const { t, locale } = useI18n()

const maxSeconds = computed(() => Math.max(1, ...props.buckets.map((b) => b.durationSeconds)))

function weekdayLabel(dateKey: string): string {
  return new Date(`${dateKey}T00:00:00`).toLocaleDateString(locale.value, { weekday: 'short' })
}
</script>

<template>
  <div class="rounded-xl border border-base-300 bg-base-200/40 p-4">
    <h2 class="mb-4 text-sm font-semibold">{{ t('dashboard.lastSevenDays') }}</h2>
    <div class="flex items-end gap-3">
      <button
        v-for="bucket in buckets"
        :key="bucket.date"
        class="flex flex-1 flex-col items-center gap-1.5"
        @click="emit('selectDay', bucket.date)"
      >
        <span class="text-[11px] tabular-nums text-base-content/50">
          {{ bucket.durationSeconds > 0 ? formatDurationCompact(bucket.durationSeconds) : '' }}
        </span>
        <div class="flex h-28 w-full items-end rounded-md bg-base-300/40">
          <div
            class="w-full rounded-md bg-primary transition-all hover:opacity-80"
            :style="{ height: `${Math.max(4, (bucket.durationSeconds / maxSeconds) * 100)}%` }"
          />
        </div>
        <span class="text-[11px] font-medium text-base-content/60">{{ weekdayLabel(bucket.date) }}</span>
      </button>
    </div>
  </div>
</template>
