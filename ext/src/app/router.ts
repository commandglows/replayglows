import { createRouter, createWebHashHistory } from 'vue-router'
import WatchView from './views/WatchView.vue'

const routes = [
  { path: '/', redirect: '/feed' },
  { path: '/feed', name: 'feed', component: () => import('./views/FeedView.vue') },
  { path: '/play', name: 'play', component: () => import('./views/PlayView.vue') },
  { path: '/playlists', name: 'playlists', component: () => import('./views/PlaylistsView.vue') },
  { path: '/playlists/create', name: 'create-playlist', component: () => import('./views/CreatePlaylistView.vue') },
  { path: '/playlists/:id', name: 'playlist-detail', component: () => import('./views/PlaylistDetailView.vue') },
  { path: '/playlists/feeds/:id', name: 'feed-detail', component: () => import('./views/VirtualFeedDetailView.vue') },
  { path: '/notes', name: 'notes', component: () => import('./views/NotesView.vue') },
  { path: '/notes/:slug', name: 'note-detail', component: () => import('./views/NoteDetailView.vue') },
  { path: '/notifications', name: 'notifications', component: () => import('./views/NotificationsView.vue') },
  { path: '/preferences', name: 'preferences', component: () => import('./views/PreferencesView.vue') },
  { path: '/hidden', name: 'hidden', component: () => import('./views/HiddenView.vue') },
  { path: '/stats', name: 'stats', component: () => import('./views/StatsView.vue') },
  { path: '/watch', name: 'watch', component: WatchView },
]

export const router = createRouter({
  history: createWebHashHistory(),
  routes,
})
