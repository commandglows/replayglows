import { DEFAULT_KEYS, DEFAULT_SETTINGS, RATE_MAX, RATE_MIN, type MediaSnapshot, type PlaybackContext, type PlaybackSettings, type PlaybackView } from './protocol'

type Request = Record<string, unknown>
type Session = { pins: Record<string, number>; frames: Record<string, number[]> }
const SESSION_KEY = 'playbackSession'
const ACTIONS = new Set(['rg:register', 'rg:context', 'rg:get', 'rg:rate', 'rg:pin', 'rg:settings', 'rg:command'])
const COMMANDS = new Set(['rewind', 'forward', 'markA', 'markB', 'clearLoop', 'loopRange', 'togglePlay'])
const DEFAULT_BOOKMARK_KEYS = ['ALT+B', 'ALT+D', 'ALT+Q', 'ALT+1', 'ALT+2']
function canonicalShortcut(shortcut: string): string {
  const parts = shortcut.toUpperCase().split('+')
  return [...parts.slice(0, -1).sort(), parts.at(-1)].join('+')
}

function object(value: unknown): value is Request { return !!value && typeof value === 'object' && !Array.isArray(value) }
function rate(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < RATE_MIN || value > RATE_MAX) throw new Error('Vitesse invalide (0,25–4×).')
  return Math.round(value * 100) / 100
}
function validateSettings(value: unknown): Partial<PlaybackSettings> {
  if (!object(value) || Object.keys(value).some(key => !['rate', 'favorite', 'step', 'enabled', 'keys'].includes(key))) throw new Error('Réglages invalides.')
  const out: Partial<PlaybackSettings> = {}
  if ('rate' in value) out.rate = rate(value.rate)
  if ('favorite' in value) out.favorite = rate(value.favorite)
  if ('enabled' in value) {
    if (typeof value.enabled !== 'boolean') throw new Error('Activation invalide.')
    out.enabled = value.enabled
  }
  if ('step' in value) {
    if (typeof value.step !== 'number' || !Number.isFinite(value.step) || value.step < 0.05 || value.step > 1) throw new Error('Incrément invalide (0,05–1).')
    out.step = Math.round(value.step * 100) / 100
  }
  if ('keys' in value) {
    if (!object(value.keys) || Object.keys(value.keys).length !== Object.keys(DEFAULT_KEYS).length) throw new Error('Raccourcis incomplets.')
    const keys = value.keys
    const shortcuts = Object.keys(DEFAULT_KEYS).map(key => {
      const shortcut = keys[key]
      if (typeof shortcut !== 'string' || (shortcut !== '' && !/^(?:(?:ALT|CTRL|SHIFT|META)\+)*[A-Z0-9]$/.test(shortcut))) throw new Error('Raccourci invalide.')
      if (new Set(shortcut.split('+')).size !== shortcut.split('+').length) throw new Error('Modificateur répété.')
      return shortcut
    }).filter(Boolean)
    // Normalize modifier order for conflict detection (CTRL+ALT+A equals ALT+CTRL+A).
    const canonical = shortcuts.map(canonicalShortcut)
    if (new Set(canonical).size !== canonical.length) throw new Error('Deux commandes utilisent le même raccourci.')
    out.keys = Object.fromEntries(Object.entries(keys).map(([action, shortcut]) => {
      const parts = (shortcut as string).split('+')
      return [action, [...['CTRL', 'ALT', 'SHIFT', 'META'].filter(modifier => parts.slice(0, -1).includes(modifier)), parts.at(-1)].join('+')]
    })) as PlaybackSettings['keys']
  }
  return out
}
async function settings(): Promise<PlaybackSettings> {
  const saved = (await chrome.storage.local.get('playbackSettings')).playbackSettings
  try { return { ...DEFAULT_SETTINGS, keys: { ...DEFAULT_KEYS }, ...validateSettings(saved ?? {}) } }
  catch { return { ...DEFAULT_SETTINGS, keys: { ...DEFAULT_KEYS } } }
}
async function session(): Promise<Session> {
  const saved = (await chrome.storage.session.get(SESSION_KEY))[SESSION_KEY]
  const next: Session = { pins: {}, frames: {} }
  if (!object(saved)) return next
  if (object(saved.pins)) for (const [id, value] of Object.entries(saved.pins)) {
    if (!/^\d+$/.test(id)) continue
    try { next.pins[id] = rate(value) } catch { /* Ignore malformed persisted data. */ }
  }
  if (object(saved.frames)) for (const [id, value] of Object.entries(saved.frames)) {
    if (/^\d+$/.test(id) && Array.isArray(value)) next.frames[id] = [...new Set(value.filter((v): v is number => Number.isInteger(v) && v >= 0))]
  }
  return next
}
function context(config: PlaybackSettings, state: Session, tabId: number): PlaybackContext {
  const pinned = Object.hasOwn(state.pins, String(tabId))
  return { settings: config, pinned, rate: pinned ? state.pins[tabId] : config.rate }
}
async function saveSession(state: Session) { await chrome.storage.session.set({ [SESSION_KEY]: state }) }
async function broadcast(config: PlaybackSettings, state: Session) {
  await Promise.allSettled(Object.entries(state.frames).flatMap(([id, frames]) => frames.map(frameId =>
    chrome.tabs.sendMessage(Number(id), { action: 'rg:apply', context: context(config, state, Number(id)) }, { frameId }))))
}
function snapshot(value: unknown): value is MediaSnapshot {
  return object(value) && typeof value.available === 'boolean' && typeof value.rate === 'number' && Number.isFinite(value.rate)
    && typeof value.currentTime === 'number' && Number.isFinite(value.currentTime) && typeof value.paused === 'boolean'
    && (value.kind === 'video' || value.kind === 'audio') && typeof value.title === 'string' && typeof value.error === 'string'
    && (value.duration === null || (typeof value.duration === 'number' && Number.isFinite(value.duration)))
    && (value.loop === null || (object(value.loop) && typeof value.loop.a === 'number' && Number.isFinite(value.loop.a) && value.loop.a >= 0
      && (value.loop.b === null || (typeof value.loop.b === 'number' && Number.isFinite(value.loop.b) && value.loop.b > value.loop.a))))
}
async function view(config: PlaybackSettings, state: Session, tabId: number): Promise<PlaybackView> {
  const frames = state.frames[tabId] ?? []
  const responses = await Promise.all(frames.map(async frameId => {
    try {
      const media: unknown = await chrome.tabs.sendMessage(tabId, { action: 'rg:snapshot' }, { frameId })
      if (!snapshot(media)) throw new Error('Réponse média invalide.')
      return { frameId, media }
    } catch { return null }
  }))
  const live = responses.filter((item): item is NonNullable<typeof item> => item !== null)
  if (live.length !== frames.length) {
    state.frames[tabId] = live.map(item => item.frameId)
    await saveSession(state)
  }
  live.sort((a, b) => Number(b.media.available) - Number(a.media.available)
    || Number(a.media.paused) - Number(b.media.paused) || Number(b.media.kind === 'video') - Number(a.media.kind === 'video') || a.frameId - b.frameId)
  return { ...context(config, state, tabId), media: live[0]?.media ?? null, frameId: live[0]?.frameId ?? null }
}

export function registerPlaybackBackground() {
  // One queue owns all session reads and writes, including frame cleanup and tab close.
  // It is deliberately not an MV3 state cache: every operation reads persisted state.
  let pending: Promise<unknown> = Promise.resolve()
  const enqueue = <T>(operation: () => Promise<T>): Promise<T> => {
    const result = pending.then(operation)
    pending = result.catch(() => undefined)
    return result
  }
  async function handle(request: Request, sender: chrome.runtime.MessageSender) {
    // Extension pages opened as tabs also have sender.tab; their URL establishes UI authority first.
    const ui = sender.url?.startsWith(chrome.runtime.getURL('')) === true
    const content = !ui && sender.tab !== undefined
    const origin = (sender as chrome.runtime.MessageSender & { origin?: string }).origin
    const contentUrl = sender.url ?? ''
    const inheritedOrigin = /^(?:about:(?:blank|srcdoc)(?:[?#]|$)|blob:)/.test(contentUrl) && /^https?:\/\//.test(origin ?? '')
    if (sender.id !== chrome.runtime.id || (!content && !ui)
      || (content && !/^https?:\/\//.test(contentUrl) && !inheritedOrigin)) throw new Error('Émetteur non autorisé.')
    const action = request.action
    if ((action === 'rg:pin' || action === 'rg:get') && content) throw new Error('Action réservée à l’interface.')
    if (action === 'rg:register' && !content) throw new Error('Enregistrement réservé aux pages.')
    const tabId = content ? sender.tab?.id : request.tabId
    const globalContext = !content && action === 'rg:context' && tabId === undefined
    if (action !== 'rg:settings' && !globalContext && (typeof tabId !== 'number' || !Number.isInteger(tabId) || tabId < 0)) throw new Error('Onglet invalide.')
    const id = typeof tabId === 'number' ? tabId : -1
    const config = await settings()
    const state = await session()
    if (action === 'rg:register') {
      const frameId = sender.frameId ?? 0
      if (!Number.isInteger(frameId) || frameId < 0) throw new Error('Cadre invalide.')
      state.frames[id] = [...new Set([...(state.frames[id] ?? []), frameId])]
      await saveSession(state)
      return context(config, state, id)
    }
    if (action === 'rg:context') return context(config, state, id)
    if (action === 'rg:get') return view(config, state, id)
    if (action === 'rg:settings') {
      if (content && (!object(request.settings) || Object.keys(request.settings).length !== 1 || !('enabled' in request.settings))) throw new Error('Seule la suspension est autorisée depuis une page.')
      const patch = validateSettings(request.settings)
      if (patch.keys) {
        const saved = (await chrome.storage.local.get('hotkeys')).hotkeys
        const bookmarkKeys = new Set((object(saved) ? Object.values(saved) : DEFAULT_BOOKMARK_KEYS)
          .filter((key): key is string => typeof key === 'string' && key !== '').map(canonicalShortcut))
        if (Object.values(patch.keys).some(key => key && bookmarkKeys.has(canonicalShortcut(key)))) throw new Error('Ce raccourci est déjà utilisé pour les marque-pages.')
      }
      const next = { ...config, ...patch }
      await chrome.storage.local.set({ playbackSettings: next })
      await broadcast(next, state)
      return next
    }
    if (action === 'rg:pin') {
      if (typeof request.pinned !== 'boolean') throw new Error('Épinglage invalide.')
      if (request.pinned) state.pins[id] = context(config, state, id).rate
      else delete state.pins[id]
      await saveSession(state)
      await broadcast(config, state)
      return context(config, state, id)
    }
    if (action === 'rg:rate') {
      if (('rate' in request) === ('delta' in request)) throw new Error('Spécifiez une vitesse ou un incrément.')
      let nextRate: number
      if ('delta' in request) {
        if (typeof request.delta !== 'number' || !Number.isFinite(request.delta) || Math.abs(request.delta) > RATE_MAX) throw new Error('Incrément invalide.')
        nextRate = rate(Math.max(RATE_MIN, Math.min(RATE_MAX, context(config, state, id).rate + request.delta)))
      } else nextRate = rate(request.rate)
      if (Object.hasOwn(state.pins, String(id))) { state.pins[id] = nextRate; await saveSession(state) }
      else { config.rate = nextRate; await chrome.storage.local.set({ playbackSettings: config }) }
      await broadcast(config, state)
      return context(config, state, id)
    }
    if (action === 'rg:command') {
      if (typeof request.command !== 'string' || !COMMANDS.has(request.command)) throw new Error('Commande inconnue.')
      if (request.command === 'loopRange' && (typeof request.a !== 'number' || typeof request.b !== 'number'
        || !Number.isFinite(request.a) || !Number.isFinite(request.b) || request.a < 0 || request.b <= request.a)) throw new Error('Bornes de boucle invalides.')
      const target = content ? sender.frameId ?? 0 : (await view(config, state, id)).frameId
      if (target === null) throw new Error('Aucun média accessible dans cet onglet.')
      try {
        return await chrome.tabs.sendMessage(id, { action: 'rg:control', command: request.command, a: request.a, b: request.b }, { frameId: target })
          ?? { error: 'Le média ne répond pas.' }
      } catch { throw new Error('Le média est déconnecté. Rechargez la page.') }
    }
    throw new Error('Action inconnue.')
  }
  chrome.runtime.onMessage.addListener((request: unknown, sender, sendResponse) => {
    if (!object(request) || typeof request.action !== 'string' || !ACTIONS.has(request.action)) return false
    enqueue(() => handle(request, sender)).then(sendResponse, error => sendResponse({ error: error instanceof Error ? error.message : 'Échec du contrôle de lecture.' }))
    return true
  })
  chrome.tabs.onRemoved.addListener(tabId => {
    void enqueue(async () => { const state = await session(); delete state.pins[tabId]; delete state.frames[tabId]; await saveSession(state) })
  })
}
