const YOUTUBE_EMBED_RULES = [
  { id: 100153, urlFilter: '||www.youtube.com/embed/' },
  { id: 100154, urlFilter: '||www.youtube-nocookie.com/embed/' },
]

export function registerYouTubeEmbedReferrer() {
  const extensionId = chrome.runtime.id
  // YouTube requires an HTTPS Referer; use the extension name + ID format described at:
  // https://support.google.com/youtube/answer/171780#zippy=%2Cprovide-a-http-referer-header-to-enable-video-playback
  const referrer = `https://replayglows.${extensionId}`
  const rules = YOUTUBE_EMBED_RULES.map(({ id, urlFilter }) => ({
    id,
    priority: 1,
    action: {
      type: 'modifyHeaders' as const,
      requestHeaders: [{ header: 'Referer', operation: 'set' as const, value: referrer }],
    },
    condition: {
      urlFilter,
      initiatorDomains: [extensionId],
      resourceTypes: ['sub_frame' as const],
    },
  }))

  void chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: rules.map(({ id }) => id),
    addRules: rules,
  }).catch(error => console.error('Unable to register YouTube embed referrer rules', error))
}
