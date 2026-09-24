import type { MessageSchema } from '../index'

const fr: MessageSchema = {
  common: {
    cancel: 'Annuler',
    save: 'Enregistrer',
    close: 'Fermer',
    delete: 'Supprimer',
    edit: 'Modifier',
    undo: 'Annuler',
    restart: 'Relancer',
    loading: 'Chargement…',
    unknown: 'Inconnu',
    unknownProject: 'Projet inconnu',
    project: 'Projet',
    task: 'Tâche',
    noTask: 'Aucune tâche',
    description: 'Description',
    name: 'Nom',
    genericError: 'Une erreur est survenue.',
    chooseProject: 'Choisir un projet'
  },
  routes: {
    dashboard: 'Tableau de bord',
    timers: 'Chronomètres',
    timeline: 'Chronologie',
    calendar: 'Calendrier',
    timesheet: 'Feuille de temps',
    reports: 'Rapports',
    projects: 'Projets',
    'project-detail': 'Projet',
    settings: 'Paramètres'
  },
  layout: {
    currentProject: 'Projet actuel',
    noProject: 'Aucun projet',
    today: '{duration} aujourd’hui',
    activeTimers: '{n} chronomètre actif | {n} chronomètres actifs',
    allProjects: 'Tous les projets',
    noProjectsYet: 'Aucun projet pour l’instant',
    addTime: 'Ajouter du temps'
  },
  timer: {
    start: 'Démarrer',
    startAnother: 'Démarrer un autre chronomètre',
    pause: 'Pause',
    resume: 'Reprendre',
    stop: 'Arrêter',
    saved: '{duration} enregistrées'
  },
  timers: {
    eyebrow: 'Espace de travail en direct',
    title: 'Chronomètres actifs',
    intro:
      'Chaque chronomètre est indépendant. Commencez à travailler sur un autre projet ou une autre tâche sans interrompre ce qui tourne déjà.',
    running: 'En cours',
    paused: 'En pause',
    combined: 'Cumulé',
    since: 'Depuis {time}',
    noDescription: 'Aucune description',
    emptyTitle: 'Aucun chronomètre actif',
    emptyBody:
      'Utilisez le panneau de lancement pour démarrer un chronomètre avec une tâche facultative. Les chronomètres supplémentaires tourneront en parallèle.',
    launchTitle: 'Lancer un autre chronomètre',
    launchSubtitle: 'Les chronomètres existants continuent de tourner',
    descriptionPlaceholder: 'Sur quoi travaillez-vous ?',
    startParallel: 'Démarrer en parallèle',
    parallelStarted: 'Chronomètre parallèle démarré'
  },
  miniTimer: {
    active: '{n} actif | {n} actifs',
    total: '{duration} au total',
    empty: 'Aucun chronomètre en cours'
  },
  idle: {
    title: 'Bon retour',
    body: 'Vous avez été inactif pendant {duration}. Que faire de ce temps ?',
    discard: 'Retirer le temps d’inactivité',
    discardHint: 'Le soustraire de cette session',
    keep: 'Garder le temps d’inactivité',
    keepHint: 'Le compter comme travaillé',
    split: 'Scinder la session',
    splitHint: 'La clôturer et en démarrer une nouvelle'
  },
  manualEntry: {
    addTitle: 'Ajouter du temps manuellement',
    editTitle: 'Modifier l’entrée de temps',
    taskOptional: 'Tâche (facultative)',
    descriptionPlaceholder: 'Sur quoi avez-vous travaillé ?',
    start: 'Début',
    end: 'Fin',
    duration: 'Durée :',
    overlap: 'Chevauche {n} entrée existante. | Chevauche {n} entrées existantes.',
    errorProject: 'Choisissez un projet.',
    errorEndBeforeStart: 'L’heure de fin doit être postérieure à l’heure de début.',
    errorSave: 'Impossible d’enregistrer l’entrée de temps.'
  },
  entries: {
    deleted: 'Entrée de temps supprimée'
  },
  palette: {
    placeholder: 'Rechercher des projets, des tâches ou taper une commande…',
    goTo: 'Aller à : {page}',
    createProject: 'Créer un projet',
    addManualTime: 'Ajouter du temps manuellement',
    stopAll: 'Arrêter tous les chronomètres ({count})',
    toggleTheme: 'Changer de thème',
    switchLanguage: 'Passer la langue en {language}',
    start: 'Démarrer',
    noResults: 'Aucun résultat'
  },
  search: {
    kinds: {
      project: 'projet',
      task: 'tâche',
      timeEntry: 'entrée de temps',
      tag: 'étiquette'
    }
  },
  dashboard: {
    greeting: {
      morning: 'Bonjour',
      afternoon: 'Bon après-midi',
      evening: 'Bonsoir'
    },
    header: {
      today: 'Aujourd’hui',
      thisWeek: 'Cette semaine',
      weeklyGoal: 'Objectif hebdo',
      notSet: 'Non défini',
      vsLastWeek: 'vs semaine dernière'
    },
    heatmap: {
      title: 'Activité — 12 derniers mois',
      allProjects: 'Tous les projets',
      currentProject: 'Projet actuel',
      tracked: '{duration} suivies',
      projects: '{n} projet | {n} projets',
      sessions: '{n} session | {n} sessions'
    },
    dayDrawer: {
      empty: 'Aucun temps suivi ce jour-là'
    },
    focus: {
      title: 'Score de concentration',
      tooltipReached: 'Session moyenne {minutes} min · {interruptions} interruptions · objectif atteint',
      tooltipNotReached: 'Session moyenne {minutes} min · {interruptions} interruptions · objectif non atteint',
      disclaimer:
        'Basé sur la durée des sessions, les interruptions et l’objectif du jour. Ce n’est pas une mesure scientifique de la productivité.'
    },
    lastSevenDays: '7 derniers jours',
    metrics: {
      title: 'Cette semaine en bref',
      dailyAverage: 'Moyenne quotidienne',
      longestSession: 'Session la plus longue',
      sessionsTodayWeek: 'Sessions jour / semaine',
      activeDays: 'Jours actifs',
      currentStreak: 'Série en cours',
      streakDays: '{n} jour | {n} jours',
      mostProductiveDay: 'Jour le plus productif',
      mostProductivePeriod: 'Période la plus productive',
      consistencyHint: '100 % moins le coefficient de variation entre les jours travaillés cette semaine',
      weeklyConsistency: 'Régularité hebdomadaire'
    },
    distribution: {
      title: 'Temps par projet',
      thisWeek: 'cette semaine',
      empty: 'Aucune donnée cette semaine'
    },
    recentEntries: {
      title: 'Entrées de temps récentes',
      empty: 'Aucune entrée de temps pour l’instant'
    },
    topTasks: {
      title: 'Tâches principales',
      empty: 'Aucune tâche suivie cette semaine'
    }
  },
  projects: {
    new: 'Nouveau projet',
    searchPlaceholder: 'Rechercher des projets…',
    filters: {
      active: 'Actifs',
      favorites: 'Favoris',
      archived: 'Archivés'
    },
    todayLabel: 'Aujourd’hui :',
    weekLabel: 'Semaine :',
    archive: 'Archiver',
    restore: 'Restaurer',
    empty: 'Aucun projet trouvé',
    confirmDelete: 'Supprimer « {name} » ? Cette action est irréversible.',
    confirmDeleteWithHistory:
      '« {name} » contient du temps suivi. Le projet et toutes ses entrées de temps seront définitivement supprimés. Continuer ?',
    form: {
      editTitle: 'Modifier le projet',
      namePlaceholder: 'Nom du projet',
      color: 'Couleur',
      weeklyTarget: 'Objectif hebdo (h)',
      budget: 'Budget (h)',
      hourlyRate: 'Taux horaire (facultatif)',
      errorName: 'Le nom du projet est obligatoire.'
    }
  },
  projectDetail: {
    thisMonth: 'Ce mois-ci',
    allTime: 'Depuis le début',
    tasks: 'Tâches',
    searchPlaceholder: 'Rechercher des tâches…',
    status: {
      all: 'Toutes',
      todo: 'À faire',
      inProgress: 'En cours',
      done: 'Terminées'
    },
    sort: {
      newest: 'Plus récentes'
    },
    addFolder: 'Dossier',
    addTask: 'Tâche',
    noFolder: 'Sans dossier',
    expandFolder: 'Déplier le dossier',
    collapseFolder: 'Replier le dossier',
    addTaskToFolder: 'Ajouter une tâche au dossier',
    deleteFolder: 'Supprimer le dossier',
    addFirstTask: 'Ajouter la première tâche',
    noTasks: 'Aucune tâche pour l’instant',
    noMatchingTasks: 'Aucune tâche correspondante',
    errorUpdateTask: 'Impossible de mettre à jour la tâche.',
    confirmDeleteTask: 'Supprimer la tâche « {name} » ?',
    confirmDeleteTaskWithSubtasks:
      'Supprimer la tâche « {name} » ? Sa sous-tâche deviendra une tâche de premier niveau. | Supprimer la tâche « {name} » ? Ses {count} sous-tâches deviendront des tâches de premier niveau.',
    confirmDeleteFolder: 'Supprimer le dossier « {name} » ?',
    confirmDeleteFolderWithTasks:
      'Supprimer le dossier « {name} » ? Il sera retiré de {count} tâche ; ses autres dossiers seront conservés. | Supprimer le dossier « {name} » ? Il sera retiré de {count} tâches ; leurs autres dossiers seront conservés.'
  },
  tasks: {
    priority: {
      low: 'Basse',
      normal: 'Normale',
      high: 'Haute',
      urgent: 'Urgente'
    },
    form: {
      editTitle: 'Modifier la tâche',
      newTitle: 'Nouvelle tâche',
      newSubtaskTitle: 'Nouvelle sous-tâche',
      namePlaceholder: 'Nom de la tâche',
      parent: 'Tâche parente',
      noParent: 'Aucune (tâche de premier niveau)',
      folders: 'Dossiers',
      foldersSelected: '{count} sélectionné(s)',
      noFolders: 'Aucun dossier dans ce projet pour l’instant.',
      priority: 'Priorité',
      estimate: 'Estimation (h)',
      create: 'Créer la tâche',
      errorName: 'Le nom de la tâche est obligatoire.'
    },
    folderForm: {
      newTitle: 'Nouveau dossier',
      renameTitle: 'Renommer le dossier',
      namePlaceholder: 'ex. Backlog',
      create: 'Créer le dossier',
      errorName: 'Le nom du dossier est obligatoire.'
    },
    row: {
      markDone: 'Marquer comme terminée',
      markNotDone: 'Marquer comme non terminée',
      completeSubtasksFirst:
        'Terminez d’abord la sous-tâche restante | Terminez d’abord les {n} sous-tâches restantes',
      expand: 'Déplier les sous-tâches',
      collapse: 'Replier les sous-tâches',
      subtasksDone: '{done} sous-tâche(s) terminée(s) sur {total}',
      estimate: 'Estimation : {hours} h',
      progress: 'Progression : {percent} %',
      tracking: 'En cours',
      addSubtask: 'Ajouter une sous-tâche'
    }
  },
  timeline: {
    viewLabel: 'Vue de la chronologie',
    day: 'Jour',
    week: 'Semaine',
    previousDay: 'Jour précédent',
    nextDay: 'Jour suivant',
    previousWeek: 'Semaine précédente',
    nextWeek: 'Semaine suivante',
    emptyWeek: 'Aucun temps suivi cette semaine'
  },
  calendar: {
    previousMonth: 'Mois précédent',
    nextMonth: 'Mois suivant',
    total: 'Total',
    more: '+{count} de plus'
  },
  timesheet: {
    duplicateLastWeek: 'Dupliquer la semaine dernière',
    projectTask: 'Projet / Tâche',
    formatsHint: 'Formats acceptés : 2, 2.5, 2h, 2h30, 1:30, 90m'
  },
  reports: {
    presets: {
      thisWeek: 'Cette semaine',
      lastWeek: 'Semaine dernière',
      thisMonth: 'Ce mois-ci',
      last30: '30 derniers jours',
      custom: 'Période personnalisée'
    },
    allTags: 'Toutes les étiquettes',
    withoutTask: 'Sans tâche',
    compare: 'Comparer à la période précédente',
    groupBy: {
      project: 'Grouper par projet',
      task: 'Grouper par tâche',
      day: 'Grouper par jour',
      week: 'Grouper par semaine',
      month: 'Grouper par mois',
      tag: 'Grouper par étiquette'
    },
    columns: {
      project: 'Projet',
      task: 'Tâche',
      day: 'Jour',
      week: 'Semaine',
      month: 'Mois',
      tag: 'Étiquette'
    },
    vsPrevious: '{change} % vs période précédente',
    sessions: 'Sessions',
    avgSession: 'Session moyenne',
    topProject: 'Projet principal',
    duration: 'Durée',
    avg: 'Moy.',
    empty: 'Aucune donnée pour cette période',
    noTag: 'Sans étiquette',
    all: 'Tout',
    weekOf: 'Semaine du {date}'
  },
  settings: {
    tabs: {
      general: 'Général',
      appearance: 'Apparence',
      timer: 'Chronomètre',
      idle: 'Détection d’inactivité',
      goals: 'Objectifs',
      shortcuts: 'Raccourcis',
      backup: 'Sauvegarde et données',
      advanced: 'Avancé',
      about: 'À propos'
    },
    language: {
      label: 'Langue',
      hint: 'S’applique aussi au menu de la barre système et aux notifications.'
    },
    general: {
      defaultProject: 'Projet par défaut',
      none: 'Aucun',
      minimizeToTray: 'Réduire dans la barre système au lieu de quitter',
      launchAtStartup: 'Lancer au démarrage',
      confirmDelete: 'Confirmer avant de supprimer une entrée de temps',
      notifications: 'Notifications de bureau',
      sendTest: 'Envoyer une notification de test',
      testSent: 'Notification de test envoyée',
      testUnsupported: 'Les notifications ne sont pas prises en charge sur ce système'
    },
    appearance: {
      theme: 'Thème',
      themes: {
        system: 'Système',
        light: 'Clair',
        dark: 'Sombre'
      },
      weekStartsOn: 'Début de semaine',
      timeFormat: 'Format horaire',
      hours24: '24 heures',
      hours12: '12 heures'
    },
    timer: {
      parallelTitle: 'Chronomètres parallèles',
      parallelBody:
        'Démarrer un projet ou une tâche crée un nouveau chronomètre indépendant. Les chronomètres actifs peuvent être mis en pause ou arrêtés séparément.',
      showMiniTimer: 'Afficher la mini-fenêtre du chronomètre',
      miniTimerOnTop: 'Mini chronomètre toujours au premier plan',
      enablePomodoro: 'Activer Pomodoro',
      focus: 'Concentration (min)',
      break: 'Pause (min)',
      longBreak: 'Pause longue (min)'
    },
    idle: {
      detect: 'Détecter quand je suis loin du clavier',
      threshold: 'Seuil d’inactivité (minutes)',
      hint: 'Le temps suivi n’est jamais supprimé en silence : on vous demandera toujours quoi faire à votre retour.'
    },
    goals: {
      daily: 'Objectif quotidien (minutes)',
      weekly: 'Objectif hebdomadaire (minutes)',
      streak: 'Seuil de série (minutes/jour)'
    },
    shortcuts: {
      toggleTimer: 'Démarrer/arrêter le dernier chronomètre (global)',
      hint: 'Exemple : CommandOrControl+Shift+Space. S’il ne s’applique pas, une autre application l’utilise peut-être déjà.',
      commandPalette: 'Palette de commandes',
      quickSwitcher: 'Sélecteur rapide',
      closeOverlay: 'Fermer la fenêtre superposée'
    },
    backup: {
      auto: 'Sauvegardes automatiques',
      frequency: 'Fréquence',
      daily: 'Quotidienne',
      weekly: 'Hebdomadaire',
      keep: 'Conserver',
      createNow: 'Sauvegarder maintenant',
      openFolder: 'Ouvrir le dossier des sauvegardes',
      restoreFrom: 'Restaurer une sauvegarde…',
      exportJson: 'Exporter en JSON',
      exportCsv: 'Exporter en CSV',
      restore: 'Restaurer',
      created: 'Sauvegarde créée',
      exported: 'Exporté vers {path}',
      confirmRestore:
        'Restaurer cette sauvegarde ? Vos données actuelles seront d’abord sauvegardées par sécurité, puis l’application redémarrera.',
      dangerZone: 'Zone de danger',
      resetBody:
        'Supprime définitivement tous les projets, tâches, entrées de temps et étiquettes pour repartir de zéro. Une sauvegarde de sécurité est d’abord effectuée, puis l’application redémarre. Vos paramètres sont conservés.',
      reset: 'Réinitialiser toutes les données',
      confirmReset:
        'Supprimer TOUS les projets, tâches, entrées de temps et étiquettes ? Une sauvegarde de sécurité sera d’abord créée, puis l’application redémarrera. Cette action ne peut pas être annulée depuis l’interface.'
    },
    advanced: {
      openLogs: 'Ouvrir le dossier des journaux'
    },
    about: {
      version: 'TimeTracker v{version}',
      platform: 'Plateforme : {platform}',
      tagline: 'Une application de bureau de suivi du temps, locale et hors ligne. Sans compte, sans cloud.'
    }
  }
}

export default fr
