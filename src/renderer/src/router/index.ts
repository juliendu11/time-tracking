import { createRouter, createWebHashHistory } from 'vue-router'

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      name: 'dashboard',
      component: () => import('../features/dashboard/DashboardPage.vue')
    },
    {
      path: '/projects',
      name: 'projects',
      component: () => import('../features/projects/ProjectsPage.vue')
    },
    {
      path: '/projects/:id',
      name: 'project-detail',
      component: () => import('../features/projects/ProjectDetailPage.vue'),
      props: true
    },
    {
      path: '/timeline',
      name: 'timeline',
      component: () => import('../features/timeline/TimelinePage.vue')
    },
    {
      path: '/timers',
      name: 'timers',
      component: () => import('../features/timer/ActiveTimersPage.vue')
    },
    {
      path: '/timesheet',
      name: 'timesheet',
      component: () => import('../features/timesheet/TimesheetPage.vue')
    },
    {
      path: '/reports',
      name: 'reports',
      component: () => import('../features/reports/ReportsPage.vue')
    },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('../features/settings/SettingsPage.vue')
    },
    {
      path: '/mini-timer',
      name: 'mini-timer',
      component: () => import('../features/timer/MiniTimerPage.vue')
    }
  ]
})
