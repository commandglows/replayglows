function allowedSender(sender: chrome.runtime.MessageSender): boolean {
  if (sender.id !== chrome.runtime.id || typeof sender.url !== 'string') return false
  if (sender.url.startsWith(chrome.runtime.getURL(''))) return true
  if (!sender.tab) return false
  if (sender.frameId !== 0) return false
  try {
    return new URL(sender.url).origin === 'https://www.youtube.com'
  } catch {
    return false
  }
}

export function registerAppNavigation() {
  chrome.runtime.onMessage.addListener((request: unknown, sender, sendResponse) => {
    if (!request || typeof request !== 'object' || !('action' in request) || request.action !== 'rg:openApp') return false
    const open = async () => {
      if (!allowedSender(sender)) throw new Error('unauthorized_sender')
      const data = request as Record<string, unknown>
      if (data.route !== 'watch' && data.route !== 'play') throw new Error('invalid_route')
      if (typeof data.videoId !== 'string' || !/^[a-zA-Z0-9_-]{11}$/.test(data.videoId)) throw new Error('invalid_video')
      if (typeof data.time !== 'number' || !Number.isFinite(data.time) || data.time < 0 || data.time > Number.MAX_SAFE_INTEGER) throw new Error('invalid_time')
      // Never accept a caller-provided URL: only these internal player routes can open.
      const query = new URLSearchParams({ v: data.videoId, t: String(Math.round(data.time)) })
      await chrome.tabs.create({ url: chrome.runtime.getURL(`src/app/index.html#/${data.route}?${query}`) })
      return { success: true }
    }
    void open().then(sendResponse, error => sendResponse({ success: false, error: error instanceof Error ? error.message : 'open_failed' }))
    return true
  })
}
