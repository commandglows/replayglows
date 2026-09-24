import './background'
import { registerPlaybackBackground } from '../playback/background'
import { registerAppNavigation } from './app-navigation'
import { registerYouTubeEmbedReferrer } from './youtube-embed-referrer'
registerPlaybackBackground()
registerAppNavigation()
registerYouTubeEmbedReferrer()

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request?.action !== 'rg:captureAuthState') return false
  if (!sender.url || new URL(sender.url).origin !== 'https://app.replayglows.com' || typeof request.authenticated !== 'boolean') return false
  void chrome.storage.local.set({ captureAuthState: { authenticated: request.authenticated, updatedAt: Date.now() } })
    .then(() => sendResponse({ success: true }), () => sendResponse({ success: false }))
  return true
})

chrome.runtime.onInstalled.addListener(async details => {
  if (details.reason !== 'install') return
  const state = await chrome.storage.local.get('welcomeOpened')
  if (state.welcomeOpened) return
  await chrome.storage.local.set({ welcomeOpened: true })
  await chrome.tabs.create({ url: chrome.runtime.getURL('src/app/index.html') })
})
