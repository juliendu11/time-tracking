<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { computed, onMounted, ref, watch } from 'vue'
import { Pause, Play, Plus, Square } from '@lucide/vue'
import type { Task } from '@shared/types/domain'
import { formatDurationClock, formatDurationSpaced } from '@shared/utils/duration'
import { useProjectsStore } from '../../stores/projects'
import { useTimerStore } from '../../stores/timer'
import { useUiStore } from '../../stores/ui'

const projectsStore = useProjectsStore()
const timerStore = useTimerStore()
const uiStore = useUiStore()
const { t, locale } = useI18n()

const projectId = ref('')
const taskId = ref<string | null>(null)
const description = ref('')
const tasks = ref<Task[]>([])
const starting = ref(false)

const runningCount = computed(
  () => timerStore.snapshots.filter((snapshot) => !snapshot.isPaused).length
)
const pausedCount = computed(() => timerStore.snapshots.length - runningCount.value)

onMounted(async () => {
  if (projectsStore.projects.length === 0) await projectsStore.load()
  projectId.value =
    projectsStore.currentProjectId ?? projectsStore.activeProjects[0]?.id ?? ''
})

watch(projectId, async (nextProjectId) => {
  taskId.value = null
  tasks.value = nextProjectId
    ? await window.desktop.tasks.listByProject(nextProjectId)
    : []
})

async function startTimer(): Promise<void> {
  if (!projectId.value || starting.value) return
  starting.value = true
  try {
    await timerStore.start({
      projectId: projectId.value,
      taskId: taskId.value,
      description: description.value.trim() || null
    })
    description.value = ''
    uiStore.pushToast({ message: t('timers.parallelStarted') })
  } finally {
    starting.value = false
  }
}

async function stopTimer(timerId: string): Promise<void> {
  const entry = await timerStore.stop(timerId)
  if (entry) {
    uiStore.pushToast({
      message: t('timer.saved', { duration: formatDurationSpaced(entry.durationSeconds) }),
      timeoutMs: 4000
    })
  }
}

function startedLabel(startedAt: string): string {
  return new Date(startedAt).toLocaleTimeString(locale.value, { hour: '2-digit', minute: '2-digit' })
}
</script>

<template>
  <div class="mx-auto max-w-6xl space-y-6 p-6">
    <section class="overflow-hidden rounded-2xl border border-base-300 bg-base-200/40">
      <div class="grid gap-5 p-5 sm:grid-cols-[1fr_auto] sm:items-end">
        <div>
          <p class="text-xs font-semibold uppercase tracking-[0.2em] text-primary">{{ t('timers.eyebrow') }}</p>
          <h1 class="mt-1 text-2xl font-semibold tracking-tight">{{ t('timers.title') }}</h1>
          <p class="mt-2 max-w-xl text-sm text-base-content/60">
            {{ t('timers.intro') }}
          </p>
        </div>
        <div class="flex gap-2 text-center">
          <div class="min-w-20 rounded-xl border border-base-300 bg-base-100 px-4 py-2.5">
            <p class="font-mono text-xl font-semibold tabular-nums">{{ runningCount }}</p>
            <p class="text-[10px] font-semibold uppercase tracking-wider text-base-content/45">{{ t('timers.running') }}</p>
          </div>
          <div class="min-w-20 rounded-xl border border-base-300 bg-base-100 px-4 py-2.5">
            <p class="font-mono text-xl font-semibold tabular-nums">{{ pausedCount }}</p>
            <p class="text-[10px] font-semibold uppercase tracking-wider text-base-content/45">{{ t('timers.paused') }}</p>
          </div>
          <div class="min-w-28 rounded-xl border border-primary/30 bg-primary/10 px-4 py-2.5">
            <p class="font-mono text-xl font-semibold tabular-nums text-primary">
              {{ formatDurationClock(timerStore.totalElapsedSeconds) }}
            </p>
            <p class="text-[10px] font-semibold uppercase tracking-wider text-primary/70">{{ t('timers.combined') }}</p>
          </div>
        </div>
      </div>
    </section>

    <div class="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <section>
        <div v-if="timerStore.isRunning" class="grid gap-4 md:grid-cols-2">
          <article
            v-for="snapshot in timerStore.snapshots"
            :key="snapshot.timer.id"
            class="group relative overflow-hidden rounded-2xl border border-base-300 bg-base-100 p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            :class="snapshot.isPaused ? 'opacity-70' : ''"
          >
            <div
              class="absolute inset-x-0 top-0 h-1"
              :style="{ backgroundColor: snapshot.project.color }"
            />
            <div class="flex items-start gap-3">
              <span
                class="mt-1 h-3 w-3 shrink-0 rounded-full"
                :class="snapshot.isPaused ? '' : 'tt-pulse'"
                :style="{ backgroundColor: snapshot.project.color }"
              />
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2">
                  <h2 class="truncate text-base font-semibold">{{ snapshot.project.name }}</h2>
                  <span v-if="snapshot.isPaused" class="badge badge-ghost badge-xs">{{ t('timers.paused') }}</span>
                </div>
                <p class="mt-0.5 truncate text-sm text-base-content/60">
                  {{ snapshot.task?.name ?? t('common.noTask') }}
                </p>
              </div>
              <p class="text-xs tabular-nums text-base-content/45">
                {{ t('timers.since', { time: startedLabel(snapshot.timer.startedAt) }) }}
              </p>
            </div>

            <p
              v-if="snapshot.timer.description"
              class="mt-4 line-clamp-2 min-h-10 text-sm text-base-content/65"
            >
              {{ snapshot.timer.description }}
            </p>
            <div v-else class="mt-4 min-h-10 text-sm italic text-base-content/30">{{ t('timers.noDescription') }}</div>

            <div class="mt-4 flex items-end justify-between gap-4 border-t border-base-300/70 pt-4">
              <p class="font-mono text-3xl font-semibold tracking-tight tabular-nums">
                {{ formatDurationClock(timerStore.elapsedSeconds(snapshot.timer.id)) }}
              </p>
              <div class="flex gap-2">
                <button
                  class="btn btn-sm"
                  @click="snapshot.isPaused ? timerStore.resume(snapshot.timer.id) : timerStore.pause(snapshot.timer.id)"
                >
                  <Play v-if="snapshot.isPaused" :size="14" />
                  <Pause v-else :size="14" />
                  {{ snapshot.isPaused ? t('timer.resume') : t('timer.pause') }}
                </button>
                <button class="btn btn-error btn-sm" @click="stopTimer(snapshot.timer.id)">
                  <Square :size="14" /> {{ t('timer.stop') }}
                </button>
              </div>
            </div>
          </article>
        </div>

        <div
          v-else
          class="flex min-h-72 flex-col items-center justify-center rounded-2xl border border-dashed border-base-300 bg-base-200/25 p-8 text-center"
        >
          <div class="grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary">
            <Play :size="20" />
          </div>
          <h2 class="mt-4 text-base font-semibold">{{ t('timers.emptyTitle') }}</h2>
          <p class="mt-1 max-w-sm text-sm text-base-content/55">
            {{ t('timers.emptyBody') }}
          </p>
        </div>
      </section>

      <aside class="sticky top-6 rounded-2xl border border-base-300 bg-base-200/45 p-5">
        <div class="flex items-center gap-2">
          <div class="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-content">
            <Plus :size="16" />
          </div>
          <div>
            <h2 class="text-sm font-semibold">{{ t('timers.launchTitle') }}</h2>
            <p class="text-xs text-base-content/50">{{ t('timers.launchSubtitle') }}</p>
          </div>
        </div>

        <div class="mt-5 space-y-4">
          <label class="block">
            <span class="mb-1.5 block text-xs font-medium text-base-content/60">{{ t('common.project') }}</span>
            <select v-model="projectId" class="select select-bordered select-sm w-full">
              <option value="" disabled>{{ t('common.chooseProject') }}</option>
              <option v-for="project in projectsStore.activeProjects" :key="project.id" :value="project.id">
                {{ project.name }}
              </option>
            </select>
          </label>

          <label class="block">
            <span class="mb-1.5 block text-xs font-medium text-base-content/60">{{ t('common.task') }}</span>
            <select v-model="taskId" class="select select-bordered select-sm w-full" :disabled="!projectId">
              <option :value="null">{{ t('common.noTask') }}</option>
              <option v-for="task in tasks" :key="task.id" :value="task.id">{{ task.name }}</option>
            </select>
          </label>

          <label class="block">
            <span class="mb-1.5 block text-xs font-medium text-base-content/60">{{ t('common.description') }}</span>
            <textarea
              v-model="description"
              class="textarea textarea-bordered min-h-20 w-full resize-none text-sm"
              :placeholder="t('timers.descriptionPlaceholder')"
            />
          </label>

          <button
            class="btn btn-primary w-full gap-2"
            :disabled="!projectId || starting"
            @click="startTimer"
          >
            <Play :size="15" />
            {{ timerStore.isRunning ? t('timers.startParallel') : t('timer.start') }}
          </button>
        </div>
      </aside>
    </div>
  </div>
</template>
