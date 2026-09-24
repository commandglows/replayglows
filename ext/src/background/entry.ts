import './background'
import { registerPlaybackBackground } from '../playback/background'
import { registerAppNavigation } from './app-navigation'
import { registerYouTubeEmbedReferrer } from './youtube-embed-referrer'
registerPlaybackBackground()
registerAppNavigation()
registerYouTubeEmbedReferrer()

chrome.runtime.onInstalled.addListener(async details => {
  if (details.reason !== 'install') return
  const state = await chrome.storage.local.get('welcomeOpened')
  if (state.welcomeOpened) return
  await chrome.storage.local.set({ welcomeOpened: true })
  await chrome.tabs.create({ url: chrome.runtime.getURL('src/app/index.html') })
})
