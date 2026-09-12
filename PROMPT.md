# Mission

Tu es un lead developer senior spécialisé en **Electron, Vue.js, TypeScript, applications desktop locales et architecture logicielle**.

Je veux que tu construises **de zéro une application desktop complète de time tracking**, inspirée fonctionnellement d'outils comme Solidtime, Toggl ou Clockify, mais pensée avant tout comme :

* une application personnelle ;
* extrêmement rapide ;
* offline-first ;
* locale ;
* sans Docker ;
* sans backend distant ;
* sans authentification ;
* sans dépendance à un service cloud.

L'application doit fonctionner sous **Linux, Windows et macOS**.

Ne produis pas seulement une maquette ou un prototype UI.

Je veux une **véritable application utilisable**, avec persistance SQLite, CRUD, timers réels, statistiques calculées à partir des données, tray système, gestion des erreurs, migrations, build Electron et architecture maintenable.

---

# 1. Stack technique

Utilise :

* Vue 3
* TypeScript strict
* Composition API
* `<script setup>`
* Vite
* Electron
* Tailwind CSS
* DaisyUI
* Pinia
* Vue Router
* SQLite
* Drizzle ORM si pertinent
* `better-sqlite3` si compatible proprement avec la version d'Electron utilisée
* `date-fns` pour les manipulations de dates
* `lucide-vue-next` pour les icônes
* Chart.js / vue-chartjs si nécessaire pour les graphiques classiques

Utilise **pnpm** comme package manager.

Choisis les dernières versions stables compatibles entre elles.

Si une dépendance pose des problèmes avec Electron packaging, privilégie la solution la plus robuste plutôt que de conserver cette dépendance à tout prix.

---

# 2. Architecture générale

L'application doit être entièrement locale.

Architecture :

```text
Electron Main Process
    │
    ├── SQLite
    ├── repositories
    ├── services métier
    ├── timers
    ├── idle detection
    ├── filesystem / backup
    ├── tray / OS integrations
    │
    └── IPC sécurisé
             │
             ▼
Electron Preload
             │
             ▼
Vue Renderer
    ├── pages
    ├── components
    ├── stores Pinia
    ├── composables
    └── UI
```

Le renderer Vue ne doit **jamais accéder directement à SQLite ou aux APIs Node.js**.

Utilise :

* `contextIsolation: true`
* `nodeIntegration: false`
* `contextBridge`
* API IPC strictement typée.

Ne transforme pas Electron en faux serveur HTTP local.

Il n'y a aucune raison d'avoir Express, Adonis, Nest ou une API REST dans cette application.

---

# 3. Stockage

Utiliser SQLite comme source de vérité.

Stocker la DB dans :

```ts
app.getPath('userData')
```

Prévoir :

* migrations versionnées ;
* création automatique de la DB au premier lancement ;
* indexes SQLite utiles ;
* contraintes de foreign keys ;
* sauvegarde ;
* restauration ;
* export.

Les données importantes ne doivent PAS être stockées uniquement dans :

* Pinia ;
* localStorage ;
* IndexedDB.

Ces technologies peuvent être utilisées pour de la préférence UI non critique, mais pas comme source de vérité pour le time tracking.

---

# 4. Modèle métier

Prévoir au minimum les entités suivantes.

## Project

```text
id
name
description
color
icon
status
isFavorite
isArchived
hourlyRate nullable
currency nullable
weeklyTargetMinutes nullable
createdAt
updatedAt
archivedAt nullable
```

Status possibles :

```text
active
paused
completed
archived
```

---

## Task

Une tâche appartient obligatoirement à un projet.

```text
id
projectId
name
description
status
priority
estimatedMinutes nullable
isFavorite
createdAt
updatedAt
completedAt nullable
archivedAt nullable
```

Status :

```text
todo
in_progress
done
archived
```

Priorité :

```text
low
normal
high
urgent
```

---

## TimeEntry

```text
id
projectId
taskId nullable
description nullable

startedAt
endedAt nullable
durationSeconds

source

createdAt
updatedAt
```

Sources possibles :

```text
timer
manual
timesheet
idle_adjustment
import
```

Une entrée sans `taskId` correspond à du **temps libre enregistré directement sur le projet**.

---

## Tag

Prévoir des tags optionnels :

```text
id
name
color
createdAt
```

Relation many-to-many avec TimeEntry.

Exemples :

```text
coding
meeting
research
design
admin
bug
```

---

## AppSettings

Prévoir notamment :

```text
theme
language
weekStartsOn
timeFormat
dateFormat
defaultProjectId
idleDetectionEnabled
idleThresholdMinutes
launchAtStartup
minimizeToTray
confirmBeforeDeletingEntry
dailyGoalMinutes
weeklyGoalMinutes
notificationsEnabled
```

---

# 5. Gestion du timer

C'est le cœur de l'application.

Il ne peut y avoir qu'**un seul timer actif à la fois dans toute l'application**.

Un timer peut être associé :

### À une tâche

```text
Project A
└── Task "Créer login"
```

ou directement à un projet :

```text
Project A
└── aucune tâche
```

Ce deuxième cas est le **timer libre**.

---

# 6. Contraintes importantes du timer

Le timer doit rester correct même si :

* on change de page ;
* on réduit l'application ;
* la fenêtre est fermée mais Electron continue dans le tray ;
* l'ordinateur passe en veille ;
* l'application plante ;
* Electron redémarre.

NE PAS calculer le temps en incrémentant une variable toutes les secondes.

La durée affichée doit être dérivée des timestamps :

```text
now - startedAt
```

et des éventuelles pauses.

Le timer actif doit être persisté.

Au redémarrage de l'application, si un timer était actif, il doit pouvoir être restauré correctement.

---

# 7. Expérience de lancement du timer

Pouvoir démarrer un timer :

* depuis le Dashboard ;
* depuis une tâche ;
* depuis la page projet ;
* depuis les entrées récentes ;
* depuis le tray ;
* depuis une Command Palette ;
* depuis un raccourci clavier global.

Exemples :

```text
Ctrl/Cmd + Shift + Space
```

Afficher un raccourci permettant de démarrer/arrêter rapidement le dernier timer utilisé.

---

# 8. Current Project

L'application possède le concept de :

```text
Current Project
```

Le projet courant doit être extrêmement visible.

Dans la sidebar, afficher par exemple :

```text
CURRENT PROJECT

🟣 Habits Hero
   02:41:32 today
```

Pouvoir switcher de projet rapidement.

Le projet sélectionné persiste après redémarrage.

Lorsque je lance un timer libre, celui-ci est automatiquement associé au projet courant.

Si aucun projet n'existe encore, afficher un onboarding demandant de créer le premier projet.

---

# 9. Gestion des projets

Page :

```text
Projects
```

Fonctionnalités :

* créer ;
* modifier ;
* archiver ;
* restaurer ;
* supprimer ;
* rechercher ;
* filtrer ;
* mettre en favori ;
* choisir une couleur ;
* choisir une icône ;
* définir un objectif hebdomadaire ;
* éventuellement définir un tarif horaire ;
* afficher les statistiques du projet.

Une suppression comportant des TimeEntries doit demander confirmation.

Préférer généralement l'archivage à la suppression définitive.

---

# 10. Page projet

Une page projet doit afficher :

```text
Nom projet
Temps aujourd'hui
Temps cette semaine
Temps ce mois
Objectif semaine
Progression
```

Puis :

```text
Tasks
```

avec possibilité de :

* création ;
* édition ;
* suppression ;
* completion ;
* archivage ;
* tri ;
* recherche ;
* filtrage ;
* lancement timer ;
* affichage temps passé.

Pour chaque tâche afficher par exemple :

```text
Implement authentication

⏱ 04:32:18
Estimate: 6h
Progress: 75%

[▶ Start]
```

---

# 11. Dashboard principal

Je veux un dashboard très travaillé.

Il doit répondre immédiatement à :

> Qu'ai-je fait aujourd'hui et cette semaine ?

> Sur quoi est-ce que je passe mon temps ?

> Est-ce que je travaille plus ou moins que d'habitude ?

> Quels sont mes projets les plus consommateurs de temps ?

---

# 12. Header du Dashboard

En haut :

```text
Good afternoon 👋

Today
4h 32m

This week
21h 18m

Weekly goal
21h / 30h

vs last week
+12.4%
```

Afficher également le timer actif s'il existe.

---

# 13. Recent Time Entries

Widget :

```text
Recent Time Entries
```

Afficher :

```text
13:42 - 15:18
Habits Hero
Implement onboarding
1h36

11:20 - 12:05
Marketing
45m

09:14 - 10:52
Habits Hero
Fix iOS notifications
1h38
```

Actions rapides :

* relancer le même timer ;
* modifier ;
* changer projet ;
* changer tâche ;
* ajouter tag ;
* supprimer.

---

# 14. Last 7 Days

Créer un graphique :

```text
Last 7 days
```

avec :

```text
Mon █████ 4h12
Tue ███   2h32
Wed ███████ 6h01
Thu ██    1h48
Fri █████ 4h42
Sat █
Sun ████
```

Pouvoir cliquer sur une journée pour afficher ses entrées.

---

# 15. Activity Heatmap

Créer une heatmap style GitHub.

Par défaut :

```text
12 derniers mois
```

Chaque cellule représente un jour.

Intensité basée sur le temps travaillé.

Tooltip :

```text
Tuesday 8 September

6h 42m tracked
3 projects
7 sessions
```

Filtres :

```text
All Projects
Current Project
```

---

# 16. Time Distribution

Créer un graphique donut :

```text
Time by project
```

Exemple :

```text
Habits Hero       42%
Marketing         27%
KDP               19%
Other             12%
```

Un clic sur un projet filtre le dashboard.

---

# 17. Top Tasks

Widget :

```text
Top Tasks
```

Exemple :

```text
1. Implement notifications   6h42
2. Landing page              4h16
3. Analytics                 3h51
4. Bug fixing                2h20
```

---

# 18. Métriques supplémentaires

Ajouter des métriques utiles.

### Daily Average

Temps moyen quotidien sur les jours travaillés.

### Longest Session

Plus longue session sans interruption.

### Sessions

Nombre de sessions aujourd'hui / semaine.

### Active Days

Nombre de jours avec activité sur la semaine.

### Current Streak

Nombre de jours consécutifs ayant dépassé un seuil configurable.

### Most Productive Day

Jour de la semaine où le plus de temps est généralement enregistré.

### Most Productive Hour

Exemple :

```text
Most productive period
17:00 → 20:00
```

Calculé depuis l'historique.

### Weekly Consistency

Mesurer la régularité du temps de travail.

Ne pas inventer un score opaque.

Si un score est utilisé, expliquer son calcul dans l'interface.

---

# 19. Focus Score

Créer éventuellement un indicateur :

```text
Focus Score
82 / 100
```

Mais le score doit être transparent.

Exemple de calcul basé sur :

* durée moyenne des sessions ;
* nombre d'interruptions ;
* atteinte de l'objectif quotidien ;
* fragmentation du temps.

Afficher dans un tooltip comment il est calculé.

Il ne doit pas prétendre mesurer scientifiquement la productivité.

---

# 20. Timeline

Créer une page :

```text
Timeline
```

permettant de visualiser une journée chronologiquement.

Exemple :

```text
08:00

09:14 ┌────────────────────────────
      │ Habits Hero
      │ Push notifications
10:52 └────────────────────────────

11:20 ┌────────────────
      │ Marketing
12:05 └────────────────

13:42 ┌────────────────────────────
      │ Habits Hero
      │ Onboarding
15:18 └────────────────────────────
```

Navigation :

```text
← Previous day
Today
Next day →
```

Pouvoir éditer les blocs.

---

# 21. Manual Time Entry

Permettre de créer une entrée manuellement.

Exemple :

```text
Project
Task
Description

Start
14:30

End
16:00

Duration
1h30
```

Faire les validations nécessaires.

Éviter les entrées incohérentes.

Détecter les overlaps et prévenir l'utilisateur.

---

# 22. Weekly Timesheet

Créer une page :

```text
Timesheet
```

présentée sous forme de tableau :

```text
                 MON   TUE   WED   THU   FRI   SAT   SUN    TOTAL

Habits Hero
Notifications   2:30  1:00  0:45  2:10   -     -     -     6:25
Onboarding      1:00    -   2:30   1:20  3:00   -     -     7:50

Marketing
Content           -   1:30    -    0:45   -     -     -     2:15
```

Permettre :

* édition d'une cellule ;
* ajout d'heures ;
* suppression ;
* navigation semaine précédente/suivante ;
* total journalier ;
* total hebdomadaire ;
* duplication de la structure de la semaine précédente.

Accepter différents formats d'entrée :

```text
2
2.5
2h
2h30
1:30
90m
```

---

# 23. Reports

Créer une page avancée :

```text
Reports
```

Filtres :

* plage de dates ;
* projet ;
* tâche ;
* tag ;
* entrée avec/sans tâche.

Grouping :

```text
Project
Task
Day
Week
Month
Tag
```

Afficher :

* total ;
* moyenne ;
* nombre de sessions ;
* durée moyenne session ;
* top projet ;
* top tâche.

Pouvoir comparer :

```text
Current period
vs
Previous period
```

Exemple :

```text
1 Sep → 7 Sep
vs
25 Aug → 31 Aug
```

---

# 24. Export

Permettre export :

```text
CSV
JSON
```

Les exports doivent permettre de reconstruire intégralement les données importantes.

Exporter :

* projects ;
* tasks ;
* tags ;
* time entries ;
* settings utiles.

Créer également :

```text
Full Backup
```

qui génère un fichier de sauvegarde complet.

---

# 25. Backups

Ajouter des sauvegardes automatiques locales.

Exemple :

```text
Settings
→ Backup

Automatic backups
[x] Enabled

Frequency
Daily

Keep
30 backups
```

Stocker les backups dans un dossier approprié.

Permettre :

```text
Open backup folder
Create backup now
Restore backup
```

Avant restauration :

1. sauvegarder automatiquement l'état courant ;
2. vérifier le fichier ;
3. demander confirmation.

---

# 26. Idle Detection

Utiliser les APIs système Electron lorsque possible.

Prévoir :

```text
Idle detection
```

Exemple :

Utilisateur travaille :

```text
14:00 → 14:52
```

puis quitte son ordinateur.

Il revient à :

```text
15:25
```

Afficher :

```text
You were inactive for 33 minutes.

What should we do?

[Remove idle time]
[Keep idle time]
[Split session]
```

Ne jamais supprimer automatiquement du temps sans validation si le comportement n'a pas été explicitement configuré.

Tout doit fonctionner localement.

---

# 27. Sleep / Resume

Gérer correctement :

* veille ;
* réveil ;
* suspend ;
* resume.

Si l'ordinateur a dormi pendant 2 heures alors qu'un timer tournait, demander :

```text
Your computer was inactive for 2h14.

Include this time?
```

---

# 28. System Tray

Créer une vraie intégration tray.

Exemple menu :

```text
TimeTracker

● Habits Hero
  Onboarding
  00:42:18

Stop timer
────────────

Recent tasks
▶ Notifications
▶ Onboarding
▶ Landing page

────────────
Open TimeTracker
Quit
```

Le temps du timer dans le tray doit être actualisé de manière raisonnable.

---

# 29. Mini Timer

Créer une petite fenêtre optionnelle :

```text
┌─────────────────────────┐
│ 🟣 Habits Hero          │
│ Onboarding              │
│                         │
│       01:42:18          │
│                         │
│     [ ■ Stop ]          │
└─────────────────────────┘
```

Toujours au-dessus si configuré.

Elle doit être discrète.

---

# 30. Command Palette

Créer une Command Palette accessible avec :

```text
Ctrl/Cmd + K
```

Actions :

```text
Switch project
Start task
Stop timer
Create task
Create project
Add manual time
Go to Dashboard
Go to Reports
Toggle theme
```

Recherche fuzzy.

Navigation entièrement clavier.

---

# 31. Quick Switcher

Créer éventuellement :

```text
Ctrl/Cmd + P
```

pour rechercher immédiatement :

```text
Projects
Tasks
```

et commencer à tracker sans toucher à la souris.

---

# 32. Favorites

Pouvoir mettre certains éléments en favoris :

* projets ;
* tâches.

Les favoris sont prioritaires dans :

* Command Palette ;
* tray ;
* sélecteur de timer.

---

# 33. Smart Recent Tasks

Calculer localement les tâches probablement intéressantes en se basant sur :

* récence ;
* fréquence d'utilisation ;
* projet courant ;
* heure habituelle.

Aucune IA externe.

Exemple :

```text
Suggested

▶ Habits Hero / Development
▶ Habits Hero / Analytics
▶ Marketing / Content
```

L'algorithme doit rester simple et explicable.

---

# 34. Goals

Ajouter :

```text
Daily goal
Weekly goal
```

globalement.

Et éventuellement :

```text
Project weekly goal
```

Exemple :

```text
Habits Hero

12h 42m / 15h
████████████████░░░ 84%
```

---

# 35. Project Budget

Feature optionnelle intéressante.

Un projet peut avoir :

```text
Time budget
```

exemple :

```text
50 hours
```

Afficher :

```text
42h / 50h
84%
```

Ou un budget financier si `hourlyRate` est renseigné.

Ne pas rendre cette fonctionnalité obligatoire pour créer un projet.

---

# 36. Breaks

Permettre éventuellement :

```text
Take a break
```

Le timer de travail est suspendu et un compteur de pause commence.

La pause ne doit pas apparaître dans le temps travaillé.

Afficher :

```text
Today

Work      6h24
Breaks    1h02
```

---

# 37. Pomodoro facultatif

Prévoir une intégration Pomodoro optionnelle dans Settings.

Exemple :

```text
Focus
25 min

Break
5 min

Long break
15 min
```

Mais le système classique de timer reste le comportement principal.

Pomodoro ne doit pas complexifier le MVP.

---

# 38. Recherche globale

Ajouter une recherche permettant de retrouver :

* projet ;
* tâche ;
* description TimeEntry ;
* tag.

Exemple :

```text
"notification"
```

retourne :

```text
Habits Hero / Push notification
Habits Hero / Fix notification permission
Entrée du 12 septembre : debug notifications iOS
```

---

# 39. Design

Je veux un design desktop moderne, premium et extrêmement propre.

Inspiration générale :

* Linear ;
* Raycast ;
* GitHub ;
* VS Code ;
* Solidtime ;
* applications SaaS modernes.

Mais ne copie pas leur identité visuelle.

Utiliser DaisyUI comme système de composants mais ne pas donner l'impression d'une interface DaisyUI générique.

Créer une vraie identité cohérente.

---

# 40. Layout

Desktop :

```text
┌────────────────────────────────────────────────────────────┐
│ Sidebar │                 Main content                    │
│         │                                                 │
│ Timer   │                                                 │
│         │                                                 │
│ Dashboard                                                 │
│ Timeline                                                  │
│ Timesheet                                                 │
│ Reports                                                   │
│                                                         │
│ Projects                                                  │
│   Habits Hero                                             │
│   Marketing                                               │
│   KDP                                                     │
│                                                         │
│ Settings                                                  │
└────────────────────────────────────────────────────────────┘
```

Sidebar réductible.

---

# 41. Active Timer

Le timer actif doit toujours être identifiable dans la sidebar.

Exemple :

```text
TRACKING

🟣 Habits Hero
Onboarding redesign

01:42:16

[Stop]
```

Utiliser une animation subtile indiquant qu'il tourne.

Pas d'animation agressive.

---

# 42. UX

Priorités UX :

1. démarrer un timer très rapidement ;
2. retrouver immédiatement le projet courant ;
3. arrêter un timer sans chercher ;
4. modifier une entrée facilement ;
5. comprendre sa journée en quelques secondes.

Actions fréquentes :

```text
1 à 2 clics maximum
```

Les modals ne doivent pas être utilisées inutilement.

Utiliser drawers, dropdowns ou édition inline lorsque cela améliore l'UX.

---

# 43. Themes

Prévoir :

```text
System
Light
Dark
```

Persistance du choix.

Dark mode particulièrement travaillé.

---

# 44. Responsive

C'est une application desktop mais elle doit rester utilisable sur :

```text
1024px
1280px
1440px
1920px
ultrawide
```

Prévoir un minimum width raisonnable.

---

# 45. State Management

Pinia ne doit pas devenir un gigantesque store.

Organiser par domaine :

```text
stores/
  timer.ts
  projects.ts
  tasks.ts
  reports.ts
  settings.ts
```

Les données SQLite restent la source de vérité.

Les stores servent à :

* état UI ;
* caching ;
* synchronisation temporaire ;
* timer affiché.

---

# 46. Domain architecture

Privilégier :

```text
features/
  timer/
  projects/
  tasks/
  dashboard/
  timeline/
  timesheet/
  reports/
  settings/
```

plutôt qu'un énorme dossier :

```text
components/
```

Chaque feature peut contenir :

```text
components
composables
types
utils
services
```

Éviter également les fichiers de plusieurs milliers de lignes.

---

# 47. TypeScript

TypeScript strict.

Interdiction de résoudre les erreurs avec :

```ts
any
```

sauf justification exceptionnelle.

Préférer des objets structurés.

Exemple :

```ts
type ProjectStats = {
  today: {
    duration: number
    sessions: number
  }

  week: {
    duration: number
    sessions: number
    goalPercentage: number
  }

  month: {
    duration: number
  }
}
```

plutôt que :

```ts
todayDuration
todaySessions
weekDuration
weekSessions
weekGoalPercentage
monthDuration
```

Créer des types domaine cohérents.

---

# 48. Dates et temps

Stocker les dates de manière fiable.

Privilégier UTC en DB.

Convertir dans le timezone local pour l'affichage.

Faire particulièrement attention :

* changement de jour ;
* changement d'heure ;
* DST ;
* sessions traversant minuit ;
* ordinateur en veille.

Une TimeEntry :

```text
23:30 → 01:30
```

doit contribuer :

```text
30 minutes au jour 1
1h30 au jour 2
```

dans les statistiques journalières.

Créer des fonctions utilitaires testées pour ce comportement.

---

# 49. Performance

Même avec :

```text
100 projets
5 000 tâches
100 000 TimeEntries
```

l'application doit rester fluide.

Prévoir indexes SQLite appropriés notamment sur :

```text
projectId
taskId
startedAt
endedAt
```

Les agrégations complexes peuvent être faites en SQL plutôt que de charger 100 000 lignes dans Vue.

---

# 50. Electron Security

Respecter les bonnes pratiques Electron.

Notamment :

```text
nodeIntegration false
contextIsolation true
sandbox si compatible
```

Valider toutes les données entrant dans les handlers IPC.

Ne jamais exposer directement :

```text
fs
database
ipcRenderer
shell
```

au renderer.

Exposer uniquement des méthodes métier précises.

Exemple :

```ts
window.desktop.projects.list()

window.desktop.projects.create(data)

window.desktop.timer.start({
  projectId,
  taskId
})

window.desktop.timer.stop()

window.desktop.reports.getWeekly(...)
```

---

# 51. IPC typings

Créer une définition centrale permettant d'avoir des appels complètement typés entre :

```text
renderer
preload
main
```

Éviter les chaînes IPC dispersées partout.

---

# 52. Validation

Créer des schemas de validation pour :

* Project ;
* Task ;
* TimeEntry ;
* Settings ;
* IPC payloads.

Zod peut être utilisé si pertinent.

---

# 53. Database repositories

Éviter d'exécuter du SQL directement dans les composants.

Créer :

```text
ProjectRepository
TaskRepository
TimeEntryRepository
SettingsRepository
TagRepository
```

Puis une couche métier lorsque nécessaire :

```text
TimerService
ReportService
BackupService
IdleService
```

---

# 54. TimerService

Centraliser toute la logique critique dans :

```text
TimerService
```

Il doit gérer :

```text
start
stop
pause
resume
switchTask
switchProject
restore
handleIdle
handleSuspend
handleResume
```

Une seule implémentation doit décider de l'état réel du timer.

Le renderer ne doit pas contenir la logique métier critique.

---

# 55. Switching timer

Si un timer fonctionne et que je clique sur une autre tâche :

```text
Task A running
→ click Start Task B
```

ne demande pas nécessairement :

```text
Stop Task A?
```

si Settings autorise le switch rapide.

Faire :

```text
stop Task A
start Task B
```

atomiquement.

Le comportement doit être configurable si nécessaire.

---

# 56. Database transactions

Pour les actions critiques comme :

```text
switch timer
restore backup
bulk edit
```

utiliser des transactions SQLite.

Éviter les états intermédiaires incohérents.

---

# 57. Settings

Page Settings organisée :

```text
General
Appearance
Timer
Idle detection
Goals
Shortcuts
Backup & Data
Advanced
About
```

---

# 58. Keyboard-first

L'application doit pouvoir être largement contrôlée au clavier.

Exemples :

```text
Ctrl/Cmd + K     Command Palette
Ctrl/Cmd + Shift + Space     Start/Stop
Ctrl/Cmd + P     Quick task switcher
Esc              Close overlay
```

Ne pas hardcoder des raccourcis incompatibles avec macOS.

Créer une abstraction :

```text
CommandOrControl
```

---

# 59. Notifications

Notifications desktop optionnelles pour :

* objectif journalier atteint ;
* Pomodoro terminé ;
* timer actif depuis très longtemps ;
* retour après idle prolongé.

Éviter les notifications intrusives.

---

# 60. Data integrity

Prévoir les scénarios :

* suppression projet avec tâches ;
* suppression tâche avec TimeEntries ;
* projet archivé avec historique ;
* tâche archivée avec historique ;
* TimeEntry sans tâche ;
* timer actif lors d'un crash ;
* restoration backup ;
* entrée traversant minuit.

L'historique ne doit jamais disparaître silencieusement.

---

# 61. Undo

Pour certaines opérations :

```text
Delete TimeEntry
Archive Task
Archive Project
```

afficher un toast :

```text
Time entry deleted

[Undo]
```

lorsque techniquement raisonnable.

---

# 62. Seed / Demo Mode

En développement uniquement, créer une commande permettant de générer :

* plusieurs projets ;
* tâches ;
* ~6 mois de TimeEntries ;
* heatmap réaliste.

Cela permettra de tester visuellement les dashboards.

Ne pas injecter ces données dans une build utilisateur.

---

# 63. Tests

Ajouter des tests prioritaires pour la logique métier.

Tester au minimum :

### Timer

* start ;
* stop ;
* switch ;
* restore après crash ;
* pause ;
* resume.

### Time calculations

* même journée ;
* session traversant minuit ;
* changement de semaine ;
* DST.

### Reports

* total journée ;
* total semaine ;
* grouping par projet ;
* grouping par tâche.

### Database

* cascade / restrictions ;
* migrations.

### Idle

* détection ;
* retrait ;
* conservation.

Ne cherche pas nécessairement une couverture 100%.

Concentre les tests sur les zones où une erreur pourrait fausser le temps enregistré.

---

# 64. Error handling

Créer une gestion cohérente des erreurs.

Dans le main process :

* logger technique.

Dans l'interface :

```text
Unable to save the time entry.
```

avec éventuellement :

```text
Retry
```

Ne jamais afficher directement une énorme stack trace à l'utilisateur.

En développement, conserver les informations nécessaires au debugging.

---

# 65. Logs

Mettre en place un logging local raisonnable.

Prévoir rotation ou limite de taille.

Permettre :

```text
Settings
→ Advanced
→ Open logs folder
```

Ne logger aucune information sensible inutile.

---

# 66. Auto Update

Structurer le projet pour que l'ajout futur d'auto-update Electron soit possible.

Mais ne rends pas un serveur d'update obligatoire pour faire fonctionner le projet.

---

# 67. Packaging

Configurer le build desktop.

Je veux pouvoir exécuter :

```bash
pnpm dev
```

pour le développement.

Puis :

```bash
pnpm build
```

et une commande dédiée au packaging.

Support souhaité :

### Linux

```text
AppImage
.deb
```

### Windows

```text
.exe / NSIS
```

### macOS

```text
.dmg
```

Utiliser electron-builder ou une solution équivalente fiable.

---

# 68. README

Créer un README complet avec :

```text
Requirements
Installation
Development
Database
Architecture
Build
Packaging
Testing
Project structure
Keyboard shortcuts
Data location
Backup location
```

---

# 69. Roadmap interne

Travaille en phases.

## Phase 1 — Foundation

Créer :

* Electron ;
* Vue ;
* TypeScript ;
* Tailwind ;
* DaisyUI ;
* routing ;
* IPC ;
* SQLite ;
* migrations ;
* layout.

Faire fonctionner l'application avant de continuer.

---

## Phase 2 — Projects / Tasks

Implémenter :

* Projects CRUD ;
* Tasks CRUD ;
* project switcher ;
* favorites ;
* archive.

---

## Phase 3 — Timer

Implémenter complètement :

* active timer ;
* free timer ;
* timer task ;
* stop ;
* switch ;
* persistence ;
* recovery.

Cette phase est critique.

---

## Phase 4 — Time Entries

Implémenter :

* history ;
* edition ;
* deletion ;
* manual entries ;
* recent entries.

---

## Phase 5 — Dashboard

Implémenter :

* Today ;
* Week ;
* weekly goal ;
* 7 day chart ;
* heatmap ;
* project distribution ;
* top tasks ;
* recent time entries ;
* additional metrics.

---

## Phase 6 — Timeline + Timesheet

Implémenter ces deux vues.

---

## Phase 7 — Reports

Filtres, grouping et comparaison temporelle.

---

## Phase 8 — Desktop integrations

Implémenter :

* tray ;
* global shortcuts ;
* system notifications ;
* idle detection ;
* sleep/resume ;
* mini timer.

---

## Phase 9 — Backup / Export

Ajouter :

* CSV ;
* JSON ;
* full backup ;
* restore ;
* automatic backups.

---

## Phase 10 — Polish

Ajouter :

* keyboard navigation ;
* command palette ;
* animations ;
* empty states ;
* loading states ;
* error states ;
* accessibility ;
* responsive desktop ;
* UX polish.

---

# 70. Méthode de travail

IMPORTANT.

Ne me donne pas simplement un plan puis attends ma validation.

Commence par analyser l'environnement puis **implémente réellement le projet**.

Si le répertoire est vide :

1. initialise le projet ;
2. installe les dépendances ;
3. crée l'architecture ;
4. implémente les fonctionnalités progressivement.

Après chaque grande phase :

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

ou les commandes équivalentes configurées dans le projet.

Corrige les erreurs avant de continuer.

---

# 71. Autonomie

Ne m'interromps pas pour chaque choix mineur.

Si un élément n'est pas explicitement défini :

* prends une décision raisonnable ;
* privilégie simplicité ;
* privilégie maintenabilité ;
* privilégie robustesse ;
* documente le choix.

Tu peux améliorer mes spécifications lorsqu'une meilleure solution technique existe.

En revanche, ne remplace pas arbitrairement les technologies principales suivantes :

```text
Vue
Electron
Tailwind
DaisyUI
SQLite
```

---

# 72. Priorité absolue

L'ordre des priorités est :

```text
1. Fiabilité du tracking
2. Intégrité des données
3. UX
4. Performance
5. Architecture
6. Design
7. Features secondaires
```

Un joli dashboard avec un timer incorrect est un échec.

---

# 73. Principe fondamental

Cette application doit donner l'impression qu'elle a été conçue comme une **vraie application desktop native**, et non comme une simple page web encapsulée dans Electron.

Utilise donc réellement les possibilités d'Electron :

* tray ;
* raccourcis globaux ;
* notifications ;
* filesystem ;
* idle detection ;
* startup ;
* fenêtre mini timer ;
* persistance locale ;
* intégration OS.

---

# 74. MVP considéré terminé lorsque

Je dois pouvoir :

1. installer/lancer l'application ;
2. créer plusieurs projets ;
3. switcher de projet ;
4. créer des tâches ;
5. démarrer un timer sur une tâche ;
6. démarrer un timer libre sur le projet courant ;
7. arrêter le timer ;
8. fermer et rouvrir l'application sans perdre le timer/historique ;
9. modifier une TimeEntry ;
10. ajouter manuellement du temps ;
11. voir mes entrées récentes ;
12. voir mon activité des 7 derniers jours ;
13. voir une heatmap ;
14. voir mon temps par projet ;
15. consulter une timeline ;
16. utiliser un timesheet hebdomadaire ;
17. consulter mes rapports ;
18. utiliser le tray ;
19. récupérer correctement une session après idle/sleep ;
20. exporter et sauvegarder toutes mes données.

---

# 75. Dernière consigne

Commence maintenant.

Analyse l'état du dossier courant.

Si nécessaire, initialise complètement le projet.

Puis travaille phase par phase jusqu'à obtenir une application fonctionnelle.

Ne te contente jamais de créer des fichiers avec des TODO du type :

```text
// TODO implement later
```

pour une fonctionnalité annoncée comme terminée.

Lorsqu'une fonctionnalité est trop importante pour être terminée immédiatement, garde-la explicitement dans la roadmap au lieu de créer une fausse implémentation.

À chaque étape, cherche à produire du code réellement exécutable et testable.
