/**
 * Background Script Entry Point
 * 
 * This is the TypeScript source for the Chrome extension's background service worker.
 * Currently implements basic installation logging.
 * 
 * Note: The main background script functionality is in /background.js,
 * which handles bookmark management and message routing.
 * This TypeScript version is for the Vite build process.
 */
chrome.runtime.onInstalled.addListener(() => {
  console.log('Extension installed')
}) 