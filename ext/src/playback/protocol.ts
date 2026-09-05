export const RATE_MIN = 0.25
export const RATE_MAX = 4
export const DEFAULT_KEYS = {
  slower: 'ALT+SHIFT+S', faster: 'ALT+SHIFT+D', reset: 'ALT+SHIFT+R',
  favorite: 'ALT+SHIFT+F', rewind: 'ALT+SHIFT+Z', forward: 'ALT+SHIFT+X',
  boost: 'ALT+SHIFT+G', markA: 'ALT+SHIFT+A', markB: 'ALT+SHIFT+B',
  clearLoop: 'ALT+SHIFT+C', suspend: 'ALT+SHIFT+V',
}
export type PlaybackAction = keyof typeof DEFAULT_KEYS
export interface PlaybackSettings {
  rate: number
  favorite: number
  step: number
  enabled: boolean
  keys: Record<PlaybackAction, string>
}
export const DEFAULT_SETTINGS: PlaybackSettings = {
  rate: 1, favorite: 1.5, step: 0.1, enabled: true, keys: { ...DEFAULT_KEYS },
}
export interface PlaybackContext {
  settings: PlaybackSettings
  pinned: boolean
  rate: number
}
export interface MediaSnapshot {
  available: boolean
  rate: number
  currentTime: number
  duration: number | null
  paused: boolean
  kind: 'video' | 'audio'
  title: string
  loop: { a: number; b: number | null } | null
  error: string
}
export interface PlaybackView extends PlaybackContext {
  media: MediaSnapshot | null
  frameId: number | null
}
// UI/worker: rg:get {tabId}, rg:rate {tabId, rate? , delta?}, rg:pin {tabId,pinned},
// rg:settings {settings: partial}, rg:command {tabId, command, a?, b?}.
// Content/worker: rg:register (sender frame), rg:context, rg:rate, rg:settings,
// rg:command routed to the sender frame when sender.tab exists.
// Worker/content: rg:apply {context}, rg:snapshot, rg:control {command,a?,b?}.
// Commands: rewind, forward, markA, markB, clearLoop, loopRange, togglePlay.
// Responses use {error:string} on failure; rg:register/context return PlaybackContext,
// rg:get returns PlaybackView; mutations return context/settings or {success:true}.
