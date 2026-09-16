import './background'
import { registerPlaybackBackground } from '../playback/background'
registerPlaybackBackground()

chrome.runtime.onInstalled.addListener(async details => {
  if (details.reason !== 'install') return
  const state = await chrome.storage.local.get('welcomeOpened')
  if (state.welcomeOpened) return
  await chrome.storage.local.set({ welcomeOpened: true })
  await chrome.tabs.create({ url: chrome.runtime.getURL('src/app/index.html') })
})
