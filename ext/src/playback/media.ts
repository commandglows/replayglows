import type { MediaSnapshot, PlaybackAction, PlaybackContext } from './protocol'

// This entry must stay self-contained: manifest content scripts are classic scripts.
(() => {
  const RESUME_SAVE_INTERVAL_MS = 15_000
  if (location.origin === 'https://app.replayglows.com') {
    let authStateReceived = false
    window.addEventListener('message', event => {
      if (event.source !== window || event.origin !== 'https://app.replayglows.com' ||
          event.data?.type !== 'RG_CAPTURE_AUTH_STATE' || typeof event.data.authenticated !== 'boolean') return
      authStateReceived = true
      void chrome.runtime.sendMessage({ action: 'rg:captureAuthState', authenticated: event.data.authenticated })
    })
    let attempts = 0
    const requestAuthState = () => {
      if (authStateReceived || attempts++ >= 40) return
      window.postMessage({ type: 'RG_CAPTURE_AUTH_REQUEST' }, 'https://app.replayglows.com')
      setTimeout(requestAuthState, 500)
    }
    requestAuthState()
  }
  let context: PlaybackContext | null = null
  let selected: HTMLMediaElement | null = null
  let loop: { a: number; b: number | null } | null = null
  let boostKey: string | null = null
  let lastUrl = location.href
  let resumeUrl = ''
  let resumeLastWrite = 0
  let resumeStarted = false
  let discoveryPending = false
  const pendingSubtrees = new Set<Element>()
  const media = new Set<HTMLMediaElement>()
  // Weak references to custom elements cover the common shadow DOM hosts
  // without retaining page nodes. A slower document pass covers unusual hosts.
  const shadowHosts = new Set<WeakRef<Element>>()
  const knownShadowHosts = new WeakSet<Element>()
  const boundMedia = new WeakSet<HTMLMediaElement>()
  const errors = new WeakMap<HTMLMediaElement, string>()
  const sources = new WeakMap<HTMLMediaElement, string>()
  const observed = new WeakSet<Node>()

  function effectiveRate(): number { return context?.rate ?? 1 }
  function boostRate(): number { return Math.min(4, Math.max(effectiveRate() * 2, context?.settings.favorite ?? 2)) }
  function applyRate(element: HTMLMediaElement, rate = effectiveRate()): void {
    if (!context?.settings.enabled) return
    try {
      element.playbackRate = rate
      errors.set(element, Math.abs(element.playbackRate - rate) < 0.005
        ? '' : 'Le lecteur refuse cette vitesse.')
    } catch { errors.set(element, 'Cette vitesse n’est pas prise en charge par ce lecteur.') }
  }
  function stopBoost(): void {
    if (!boostKey) return
    boostKey = null
    if (selected) applyRate(selected)
  }
  function choose(): HTMLMediaElement | null {
    let best: HTMLMediaElement | null = null
    let bestScore = -Infinity
    for (const element of media) {
      if (!element.isConnected) { media.delete(element); continue }
      const bounds = element.getBoundingClientRect()
      const style = getComputedStyle(element)
      const visible = bounds.width > 0 && bounds.height > 0 && style.visibility !== 'hidden' && style.display !== 'none'
      const area = visible ? bounds.width * bounds.height : 0 // Measured media area, not a presentation dimension.
      const isVideo = element.tagName === 'VIDEO'
      const score = (!element.paused && !element.ended ? (isVideo ? 2e12 : 1e12) : 0)
        + (isVideo && visible ? 1e9 + Math.min(area, 1e8) : isVideo ? 1 : 10)
      if (score > bestScore) { best = element; bestScore = score }
    }
    if (best !== selected) { stopBoost(); loop = null; selected = best }
    return selected
  }
  function resetNavigation(): void {
    if (lastUrl !== location.href) {
      lastUrl = location.href
      resumeUrl = ''
      resumeLastWrite = 0
      resumeStarted = false
      stopBoost()
      loop = null
    }
    if (selected && sources.get(selected) !== selected.currentSrc) {
      stopBoost()
      loop = null
      sources.set(selected, selected.currentSrc)
    }
  }
  function snapshot(): MediaSnapshot {
    resetNavigation()
    const element = choose()
    const requested = boostKey ? boostRate() : effectiveRate()
    const rejected = element && context?.settings.enabled && Math.abs(element.playbackRate - requested) > 0.005
    return {
      available: !!element,
      rate: element?.playbackRate ?? effectiveRate(),
      currentTime: element?.currentTime ?? 0,
      duration: element && Number.isFinite(element.duration) ? element.duration : null,
      paused: element?.paused ?? true,
      kind: element?.tagName === 'AUDIO' ? 'audio' : 'video',
      title: document.title,
      loop: loop ? { ...loop } : null,
      error: element ? errors.get(element) || (rejected ? 'Le site a modifié ou refusé la vitesse demandée.' : '') : '',
    }
  }
  function setContext(next: PlaybackContext): void {
    // Restore a held temporary rate before disabling enforcement.
    stopBoost()
    context = next
    if (!next.settings.enabled) loop = null
    else for (const element of media) if (element.isConnected) applyRate(element)
  }
  async function send(message: Record<string, unknown>): Promise<unknown> {
    try { return await chrome.runtime.sendMessage(message) } catch { return null }
  }
  function saveResume(element: HTMLMediaElement, force = false, completed = false, started = false): void {
    if (location.origin !== 'https://www.youtube.com' || location.pathname !== '/watch' || element.tagName !== 'VIDEO' || !resumeStarted) return
    if (document.querySelector('#movie_player.ad-showing, #movie_player.ad-interrupting')) return
    const duration = element.duration
    const position = element.currentTime
    if (!Number.isFinite(duration) || duration <= 0 || !Number.isFinite(position) || position < 0) return
    const url = `${location.origin}${location.pathname}?v=${new URL(location.href).searchParams.get('v') || ''}`
    if (url === 'https://www.youtube.com/watch?v=') return
    const now = Date.now()
    if (!force && url === resumeUrl && now - resumeLastWrite < RESUME_SAVE_INTERVAL_MS) return
    resumeUrl = url
    resumeLastWrite = now
    void send({ action: 'resume:progress', url, title: document.title.replace(/\s*-\s*YouTube\s*$/i, ''), position: completed ? duration : position, duration, completed, started })
  }
  function register(element: HTMLMediaElement): void {
    if (media.has(element)) return
    media.add(element)
    sources.set(element, element.currentSrc)
    applyRate(element)
    if (boundMedia.has(element)) return
    boundMedia.add(element)
    const refreshed = () => {
      resetNavigation()
      if (sources.get(element) !== element.currentSrc) {
        sources.set(element, element.currentSrc)
        if (element === selected) { stopBoost(); loop = null }
      }
      choose()
      applyRate(element, element === selected && boostKey ? boostRate() : effectiveRate())
    }
    element.addEventListener('loadedmetadata', refreshed)
    element.addEventListener('play', () => {
      refreshed()
      if (location.origin === 'https://www.youtube.com' && location.pathname === '/watch' && element.tagName === 'VIDEO' && !resumeStarted && !document.querySelector('#movie_player.ad-showing, #movie_player.ad-interrupting')) {
        resumeStarted = true
        saveResume(element, true, false, true)
      }
    })
    element.addEventListener('pause', () => { if (element === selected) saveResume(element, true) })
    element.addEventListener('ended', () => { if (element === selected) saveResume(element, true, true) })
    element.addEventListener('emptied', () => {
      if (selected === element) { stopBoost(); loop = null }
    })
    element.addEventListener('seeking', () => {
      if (element === selected && loop && (element.currentTime < loop.a - 0.1 || (loop.b !== null && element.currentTime > loop.b + 0.1))) loop = null
    })
    element.addEventListener('durationchange', () => {
      if (element === selected && loop && (!Number.isFinite(element.duration) || loop.a >= element.duration || (loop.b !== null && loop.b > element.duration))) loop = null
    })
    element.addEventListener('timeupdate', () => {
      resetNavigation()
      if (element === selected) saveResume(element)
      if (element !== selected || !context?.settings.enabled || !loop || loop.b === null) return
      if (!element.isConnected) { loop = null; return }
      if (element.currentTime >= loop.b && !element.seeking) {
        try { element.currentTime = loop.a } catch { loop = null }
      }
    })
  }
  function scan(root: Document | ShadowRoot | Element): void {
    if (!(root instanceof Element) && !observed.has(root)) {
      observed.add(root)
      observer.observe(root, { childList: true, subtree: true })
    }
    const visit = (element: Element) => {
      if (element.localName.includes('-') && !knownShadowHosts.has(element)) {
        knownShadowHosts.add(element)
        shadowHosts.add(new WeakRef(element))
      }
      if (element instanceof HTMLMediaElement) register(element)
      if (element.shadowRoot) scan(element.shadowRoot)
    }
    if (root instanceof Element) visit(root)
    for (const element of root.querySelectorAll('*')) visit(element)
  }
  function discover(): void {
    discoveryPending = false
    resetNavigation()
    scan(document)
    choose()
  }
  function discoverLateShadowRoots(): void {
    resetNavigation()
    let foundRoot = false
    for (const reference of shadowHosts) {
      const host = reference.deref()
      if (!host) {
        shadowHosts.delete(reference)
        continue
      }
      if (!host.isConnected) continue
      const root = host.shadowRoot
      if (root && !observed.has(root)) {
        scan(root)
        foundRoot = true
      }
    }
    if (foundRoot) choose()
  }
  const observer = new MutationObserver(records => {
    for (const record of records) for (const node of record.addedNodes) {
      if (node instanceof Element) pendingSubtrees.add(node)
    }
    if (discoveryPending) return
    discoveryPending = true
    setTimeout(() => {
      discoveryPending = false
      resetNavigation()
      const roots = [...pendingSubtrees]
      pendingSubtrees.clear()
      const candidates = new Set(roots)
      for (const root of roots) {
        if (!root.isConnected) continue
        // Walk ancestors once per candidate instead of comparing every pair.
        let parent = root.parentElement
        let covered = false
        while (parent) {
          if (candidates.has(parent)) { covered = true; break }
          parent = parent.parentElement
        }
        if (!covered) scan(root)
      }
      choose()
    }, 100)
  })
  function control(command: string, a?: number, b?: number): MediaSnapshot | { error: string } {
    const element = choose()
    resetNavigation()
    if (!element) return { error: 'Aucun média disponible dans cet onglet.' }
    if (!context?.settings.enabled) return { error: 'Les commandes de lecture sont suspendues.' }
    try {
      switch (command) {
        case 'rewind':
        case 'forward': {
          loop = null
          const target = Math.max(0, element.currentTime + (command === 'rewind' ? -10 : 10))
          element.currentTime = Number.isFinite(element.duration) ? Math.min(target, element.duration) : target
          break
        }
        case 'markA':
          if (!Number.isFinite(element.duration) || element.currentTime >= element.duration - 0.1) return { error: 'Placez A avant la fin d’un média de durée finie.' }
          loop = { a: element.currentTime, b: null }
          break
        case 'markB':
          if (!loop || element.currentTime <= loop.a + 0.1) return { error: 'Placez B après le point A.' }
          loop = { a: loop.a, b: element.currentTime }
          break
        case 'loopRange':
          if (typeof a !== 'number' || typeof b !== 'number' || !Number.isFinite(a) || !Number.isFinite(b)
            || !Number.isFinite(element.duration) || a < 0 || b <= a + 0.1 || b > element.duration) {
            return { error: 'Choisissez deux points valides, avec B après A.' }
          }
          loop = { a, b }
          element.currentTime = a
          break
        case 'clearLoop': loop = null; break
        case 'togglePlay':
          if (element.paused) void element.play().catch(() => errors.set(element, 'Le navigateur a refusé la lecture.'))
          else element.pause()
          break
        default: return { error: 'Commande de lecture inconnue.' }
      }
      return snapshot()
    } catch { return { error: 'Ce lecteur ne prend pas en charge cette commande.' } }
  }
  function keyName(event: KeyboardEvent): string {
    const key = event.key === ' ' ? 'SPACE' : event.key.toUpperCase()
    return [event.ctrlKey && 'CTRL', event.altKey && 'ALT', event.shiftKey && 'SHIFT', event.metaKey && 'META', key].filter(Boolean).join('+')
  }
  document.addEventListener('keydown', event => {
    if (!context || event.repeat || event.isComposing || event.defaultPrevented) return
    if (event.composedPath().some(node => node instanceof HTMLElement && (node.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(node.tagName)))) return
    const key = keyName(event)
    const action = (Object.keys(context.settings.keys) as PlaybackAction[]).find(name => context?.settings.keys[name] === key)
    if (!action || (!context.settings.enabled && action !== 'suspend')) return
    const element = choose()
    if (!element && action !== 'suspend') return
    event.preventDefault()
    if (action === 'suspend') {
      void send({ action: 'rg:settings', settings: { enabled: !context.settings.enabled } })
    } else if (action === 'boost' && element) {
      boostKey = event.code
      applyRate(element, boostRate())
    } else if (action === 'slower' || action === 'faster') {
      void send({ action: 'rg:rate', delta: (action === 'slower' ? -1 : 1) * context.settings.step })
    } else if (action === 'reset' || action === 'favorite') {
      void send({ action: 'rg:rate', rate: action === 'reset' ? 1 : context.settings.favorite })
    } else control(action)
  }, true)
  document.addEventListener('keyup', event => { if (event.code === boostKey) stopBoost() }, true)
  window.addEventListener('blur', stopBoost)
  window.addEventListener('pagehide', () => { if (selected) saveResume(selected, true) })
  document.addEventListener('visibilitychange', () => { if (document.hidden) stopBoost() })
  window.addEventListener('popstate', resetNavigation)
  window.addEventListener('hashchange', resetNavigation)
  chrome.runtime.onMessage.addListener((message, sender, respond) => {
    if (sender.id !== chrome.runtime.id) return
    if (message.action === 'rg:apply') {
      setContext(message.context as PlaybackContext)
      respond({ success: true })
    } else if (message.action === 'resume:seek' && typeof message.position === 'number' && Number.isFinite(message.position) && message.position >= 0) {
      const element = choose()
      if (element?.tagName === 'VIDEO') { element.currentTime = Math.min(message.position, Number.isFinite(element.duration) ? element.duration : message.position); respond({ success: true }) }
      else respond({ error: 'Aucune vidéo accessible.' })
    } else if (message.action === 'rg:snapshot') respond(snapshot())
    else if (message.action === 'rg:control') respond(control(message.command, message.a, message.b))
  })
  discover()
  // MutationObserver cannot see a shadow root attached to an existing host.
  // Check likely hosts frequently and retain a slower fallback for unusual hosts.
  let nextFullDiscovery = Date.now() + 60000
  setInterval(() => {
    if (document.hidden) { resetNavigation(); return }
    if (Date.now() >= nextFullDiscovery) {
      nextFullDiscovery = Date.now() + 60000
      discover()
    } else discoverLateShadowRoots()
  }, 10000)
  void send({ action: 'rg:register' }).then(result => {
    if (result && typeof result === 'object' && 'settings' in result) setContext(result as PlaybackContext)
  })
})()

