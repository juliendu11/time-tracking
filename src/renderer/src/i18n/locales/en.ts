const en = {
  common: {
    cancel: 'Cancel',
    save: 'Save',
    close: 'Close',
    delete: 'Delete',
    edit: 'Edit',
    undo: 'Undo',
    restart: 'Restart',
    loading: 'Loading…',
    unknown: 'Unknown',
    unknownProject: 'Unknown project',
    project: 'Project',
    task: 'Task',
    noTask: 'No task',
    description: 'Description',
    name: 'Name',
    genericError: 'Something went wrong.',
    chooseProject: 'Choose a project'
  },
  routes: {
    dashboard: 'Dashboard',
    timers: 'Timers',
    timeline: 'Timeline',
    calendar: 'Calendar',
    timesheet: 'Timesheet',
    reports: 'Reports',
    projects: 'Projects',
    'project-detail': 'Project',
    settings: 'Settings'
  },
  layout: {
    currentProject: 'Current project',
    noProject: 'No project',
    today: '{duration} today',
    activeTimers: '{n} active timer | {n} active timers',
    allProjects: 'All projects',
    noProjectsYet: 'No projects yet',
    addTime: 'Add time'
  },
  timer: {
    start: 'Start timer',
    startAnother: 'Start another timer',
    pause: 'Pause',
    resume: 'Resume',
    stop: 'Stop',
    saved: 'Saved {duration}'
  },
  timers: {
    eyebrow: 'Live workspace',
    title: 'Active timers',
    intro:
      'Every timer is independent. Start work on another project or task without interrupting what is already running.',
    running: 'Running',
    paused: 'Paused',
    combined: 'Combined',
    since: 'Since {time}',
    noDescription: 'No description',
    emptyTitle: 'No active timers',
    emptyBody:
      'Use the launch panel to start a timer with an optional task. Additional timers will run alongside it.',
    launchTitle: 'Launch another timer',
    launchSubtitle: 'Existing timers keep running',
    descriptionPlaceholder: 'What are you working on?',
    startParallel: 'Start in parallel',
    parallelStarted: 'Parallel timer started'
  },
  miniTimer: {
    active: '{n} active | {n} active',
    total: '{duration} total',
    empty: 'No timer running'
  },
  idle: {
    title: 'Welcome back',
    body: 'You were inactive for {duration}. What should we do with that time?',
    discard: 'Remove idle time',
    discardHint: 'Subtract it from this session',
    keep: 'Keep idle time',
    keepHint: 'Count it as worked',
    split: 'Split session',
    splitHint: 'Close it, start a new one now'
  },
  manualEntry: {
    addTitle: 'Add time manually',
    editTitle: 'Edit time entry',
    taskOptional: 'Task (optional)',
    descriptionPlaceholder: 'What did you work on?',
    start: 'Start',
    end: 'End',
    duration: 'Duration:',
    overlap: 'This overlaps with {n} existing entry. | This overlaps with {n} existing entries.',
    errorProject: 'Choose a project.',
    errorEndBeforeStart: 'End time must be after start time.',
    errorSave: 'Unable to save the time entry.'
  },
  entries: {
    deleted: 'Time entry deleted'
  },
  palette: {
    placeholder: 'Search projects, tasks, or type a command…',
    goTo: 'Go to {page}',
    createProject: 'Create project',
    addManualTime: 'Add manual time',
    stopAll: 'Stop all timers ({count})',
    toggleTheme: 'Toggle theme',
    switchLanguage: 'Switch language to {language}',
    start: 'Start',
    noResults: 'No results'
  },
  search: {
    kinds: {
      project: 'project',
      task: 'task',
      timeEntry: 'time entry',
      tag: 'tag'
    }
  },
  dashboard: {
    greeting: {
      morning: 'Good morning',
      afternoon: 'Good afternoon',
      evening: 'Good evening'
    },
    header: {
      today: 'Today',
      thisWeek: 'This week',
      weeklyGoal: 'Weekly goal',
      notSet: 'Not set',
      vsLastWeek: 'vs last week'
    },
    heatmap: {
      title: 'Activity — last 12 months',
      allProjects: 'All Projects',
      currentProject: 'Current Project',
      tracked: '{duration} tracked',
      projects: '{n} project | {n} projects',
      sessions: '{n} session | {n} sessions'
    },
    dayDrawer: {
      empty: 'No time tracked on this day'
    },
    focus: {
      title: 'Focus Score',
      tooltipReached: 'Avg session {minutes}m · {interruptions} interruptions · goal reached',
      tooltipNotReached: 'Avg session {minutes}m · {interruptions} interruptions · goal not reached',
      disclaimer:
        "Based on session length, interruptions, and today's goal. Not a scientific measure of productivity."
    },
    lastSevenDays: 'Last 7 days',
    metrics: {
      title: 'This week at a glance',
      dailyAverage: 'Daily average',
      longestSession: 'Longest session',
      sessionsTodayWeek: 'Sessions today / week',
      activeDays: 'Active days',
      currentStreak: 'Current streak',
      streakDays: '{n} day | {n} days',
      mostProductiveDay: 'Most productive day',
      mostProductivePeriod: 'Most productive period',
      consistencyHint: '100% minus the coefficient of variation across worked days this week',
      weeklyConsistency: 'Weekly consistency'
    },
    distribution: {
      title: 'Time by project',
      thisWeek: 'this week',
      empty: 'No data this week'
    },
    recentEntries: {
      title: 'Recent Time Entries',
      empty: 'No time entries yet'
    },
    topTasks: {
      title: 'Top Tasks',
      empty: 'No tasks tracked this week'
    }
  },
  projects: {
    new: 'New project',
    searchPlaceholder: 'Search projects…',
    filters: {
      active: 'Active',
      favorites: 'Favorites',
      archived: 'Archived'
    },
    todayLabel: 'Today:',
    weekLabel: 'Week:',
    archive: 'Archive',
    restore: 'Restore',
    empty: 'No projects found',
    confirmDelete: 'Delete "{name}"? This cannot be undone.',
    confirmDeleteWithHistory:
      '"{name}" has tracked time. This will permanently delete it and all its time entries. Continue?',
    form: {
      editTitle: 'Edit project',
      namePlaceholder: 'Project name',
      color: 'Color',
      weeklyTarget: 'Weekly target (h)',
      budget: 'Budget (h)',
      hourlyRate: 'Hourly rate (optional)',
      errorName: 'Project name is required.'
    }
  },
  projectDetail: {
    thisMonth: 'This month',
    allTime: 'All time',
    tasks: 'Tasks',
    searchPlaceholder: 'Search tasks…',
    status: {
      all: 'All',
      todo: 'Todo',
      inProgress: 'In progress',
      done: 'Done'
    },
    sort: {
      newest: 'Newest'
    },
    addFolder: 'Folder',
    addTask: 'Task',
    noFolder: 'No folder',
    expandFolder: 'Expand folder',
    collapseFolder: 'Collapse folder',
    addTaskToFolder: 'Add task to folder',
    deleteFolder: 'Delete folder',
    addFirstTask: 'Add the first task',
    noTasks: 'No tasks yet',
    noMatchingTasks: 'No matching tasks',
    errorUpdateTask: 'Unable to update the task.',
    confirmDeleteTask: 'Delete task "{name}"?',
    confirmDeleteTaskWithSubtasks:
      'Delete task "{name}"? Its {count} subtask will become a top-level task. | Delete task "{name}"? Its {count} subtasks will become top-level tasks.',
    confirmDeleteFolder: 'Delete folder "{name}"?',
    confirmDeleteFolderWithTasks:
      'Delete folder "{name}"? It will be removed from {count} task; its other folders will be preserved. | Delete folder "{name}"? It will be removed from {count} tasks; their other folders will be preserved.'
  },
  tasks: {
    priority: {
      low: 'Low',
      normal: 'Normal',
      high: 'High',
      urgent: 'Urgent'
    },
    form: {
      editTitle: 'Edit task',
      newTitle: 'New task',
      newSubtaskTitle: 'New subtask',
      namePlaceholder: 'Task name',
      parent: 'Parent task',
      noParent: 'None (top-level task)',
      folders: 'Folders',
      foldersSelected: '{count} selected',
      noFolders: 'No folders in this project yet.',
      priority: 'Priority',
      estimate: 'Estimate (h)',
      create: 'Create task',
      errorName: 'Task name is required.'
    },
    folderForm: {
      newTitle: 'New folder',
      renameTitle: 'Rename folder',
      namePlaceholder: 'e.g. Backlog',
      create: 'Create folder',
      errorName: 'Folder name is required.'
    },
    row: {
      markDone: 'Mark as done',
      markNotDone: 'Mark as not done',
      completeSubtasksFirst:
        'Complete {n} remaining subtask first | Complete {n} remaining subtasks first',
      expand: 'Expand subtasks',
      collapse: 'Collapse subtasks',
      subtasksDone: '{done} of {total} subtasks done',
      estimate: 'Estimate: {hours}h',
      progress: 'Progress: {percent}%',
      tracking: 'Tracking',
      addSubtask: 'Add subtask'
    }
  },
  timeline: {
    viewLabel: 'Timeline view',
    day: 'Day',
    week: 'Week',
    previousDay: 'Previous day',
    nextDay: 'Next day',
    previousWeek: 'Previous week',
    nextWeek: 'Next week',
    emptyWeek: 'No time tracked this week'
  },
  calendar: {
    previousMonth: 'Previous month',
    nextMonth: 'Next month',
    total: 'Total',
    more: '+{count} more'
  },
  timesheet: {
    duplicateLastWeek: 'Duplicate last week',
    projectTask: 'Project / Task',
    formatsHint: 'Accepts flexible formats: 2, 2.5, 2h, 2h30, 1:30, 90m'
  },
  reports: {
    presets: {
      thisWeek: 'This week',
      lastWeek: 'Last week',
      thisMonth: 'This month',
      last30: 'Last 30 days',
      custom: 'Custom range'
    },
    allTags: 'All tags',
    withoutTask: 'Without task',
    compare: 'Compare to previous period',
    groupBy: {
      project: 'Group by project',
      task: 'Group by task',
      day: 'Group by day',
      week: 'Group by week',
      month: 'Group by month',
      tag: 'Group by tag'
    },
    columns: {
      project: 'Project',
      task: 'Task',
      day: 'Day',
      week: 'Week',
      month: 'Month',
      tag: 'Tag'
    },
    vsPrevious: '{change}% vs previous',
    sessions: 'Sessions',
    avgSession: 'Avg session',
    topProject: 'Top project',
    duration: 'Duration',
    avg: 'Avg',
    empty: 'No data for this period',
    noTag: 'No tag',
    all: 'All',
    weekOf: 'Week of {date}'
  },
  settings: {
    tabs: {
      general: 'General',
      appearance: 'Appearance',
      timer: 'Timer',
      idle: 'Idle detection',
      goals: 'Goals',
      shortcuts: 'Shortcuts',
      backup: 'Backup & Data',
      advanced: 'Advanced',
      about: 'About'
    },
    language: {
      label: 'Language',
      hint: 'Also applies to the tray menu and desktop notifications.'
    },
    general: {
      defaultProject: 'Default project',
      none: 'None',
      minimizeToTray: 'Minimize to tray instead of quitting',
      launchAtStartup: 'Launch at startup',
      confirmDelete: 'Confirm before deleting a time entry',
      notifications: 'Desktop notifications',
      sendTest: 'Send test notification',
      testSent: 'Test notification sent',
      testUnsupported: 'Notifications are not supported on this system'
    },
    appearance: {
      theme: 'Theme',
      themes: {
        system: 'System',
        light: 'Light',
        dark: 'Dark'
      },
      weekStartsOn: 'Week starts on',
      timeFormat: 'Time format',
      hours24: '24-hour',
      hours12: '12-hour'
    },
    timer: {
      parallelTitle: 'Parallel timers',
      parallelBody:
        'Starting a project or task creates a new independent timer. Active timers can be paused or stopped separately.',
      showMiniTimer: 'Show mini timer window',
      miniTimerOnTop: 'Mini timer always on top',
      enablePomodoro: 'Enable Pomodoro',
      focus: 'Focus (min)',
      break: 'Break (min)',
      longBreak: 'Long break (min)'
    },
    idle: {
      detect: "Detect when I'm away from the keyboard",
      threshold: 'Idle threshold (minutes)',
      hint: "We never silently remove tracked time — you'll always be asked what to do when you return from being idle."
    },
    goals: {
      daily: 'Daily goal (minutes)',
      weekly: 'Weekly goal (minutes)',
      streak: 'Streak threshold (minutes/day)'
    },
    shortcuts: {
      toggleTimer: 'Start/stop last timer (global)',
      hint: "Example: CommandOrControl+Shift+Space. If it doesn't apply, another app may already use it.",
      commandPalette: 'Command Palette',
      quickSwitcher: 'Quick switcher',
      closeOverlay: 'Close overlay'
    },
    backup: {
      auto: 'Automatic backups',
      frequency: 'Frequency',
      daily: 'Daily',
      weekly: 'Weekly',
      keep: 'Keep',
      createNow: 'Create backup now',
      openFolder: 'Open backup folder',
      restoreFrom: 'Restore backup…',
      exportJson: 'Export JSON',
      exportCsv: 'Export CSV',
      restore: 'Restore',
      created: 'Backup created',
      exported: 'Exported to {path}',
      confirmRestore:
        'Restore this backup? Your current data will be safety-backed-up first, then the app will restart.',
      dangerZone: 'Danger zone',
      resetBody:
        'Permanently deletes every project, task, time entry and tag to start from a clean slate. A safety backup is taken first and the app restarts. Your settings are kept.',
      reset: 'Reset all data',
      confirmReset:
        'Delete ALL projects, tasks, time entries and tags? A safety backup will be created first, then the app will restart. This cannot be undone from the UI.'
    },
    advanced: {
      openLogs: 'Open logs folder'
    },
    about: {
      version: 'TimeTracker v{version}',
      platform: 'Platform: {platform}',
      tagline: 'A local-first, offline time tracking desktop app. No account, no cloud.'
    }
  }
}

export default en
