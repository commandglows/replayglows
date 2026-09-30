(function () {
  const params = new URLSearchParams(window.location.search);
  const nonce = params.get('rg_capture');
  if (!nonce || !window.opener) return;

  const YOUTUBE_ORIGIN = 'https://www.youtube.com';
  let completed = false;

  function send(type, detail) {
    window.opener?.postMessage({ type, nonce, ...detail }, YOUTUBE_ORIGIN);
  }

  async function waitForAuthAndConfig() {
    const deadline = Date.now() + 10 * 60 * 1000;
    while (!completed && Date.now() < deadline) {
      const bridge = window.replayGlowsClerkBridge;
      const convexUrl = window.__replayGlowsCaptureConvexUrl;
      if (bridge && convexUrl) {
        try {
          if (!(await bridge.isSignedIn())) {
            send('RG_CAPTURE_AUTH_REQUIRED', {});
            return null;
          }
          const token = await bridge.getConvexToken(false);
          if (token) {
            send('RG_CAPTURE_READY', {});
            return { token, convexUrl };
          }
        } catch (_) {}
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    return null;
  }

  async function uploadCapture(message, auth) {
    if (message.type !== 'RG_FRAME_CAPTURE' || message.nonce !== nonce ||
        !(message.image instanceof Blob) || message.image.type !== 'image/jpeg' ||
        message.image.size <= 0 || message.image.size > 10 * 1024 * 1024 ||
        !/^[A-Za-z0-9_-]{11}$/.test(message.youtubeVideoId) ||
        !Number.isFinite(message.timestamp) || message.timestamp < 0) return;

    completed = true;
    try {
      const convex = window.replayGlowsConvexBridge;
      const uploadUrl = JSON.parse(await convex.mutate(
        auth.convexUrl,
        auth.token,
        'notes:createCaptureUploadUrl',
        '{}',
      ));
      const uploadResponse = await fetch(uploadUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'image/jpeg' },
        body: message.image,
      });
      if (!uploadResponse.ok) throw new Error('Image upload failed');
      const { storageId } = await uploadResponse.json();
      const noteId = JSON.parse(await convex.mutate(
        auth.convexUrl,
        auth.token,
        'notes:createYouTubeCaptureNote',
        JSON.stringify({
          youtubeVideoId: message.youtubeVideoId,
          timestamp: message.timestamp,
          imageStorageId: storageId,
        }),
      ));
      send('RG_CAPTURE_DONE', { noteId });
      setTimeout(() => window.location.assign(`/notes/${encodeURIComponent(noteId)}`), 150);
    } catch (_) {
      send('RG_CAPTURE_ERROR', {});
      completed = false;
    }
  }

  window.addEventListener('message', async (event) => {
    if (event.origin !== YOUTUBE_ORIGIN || event.source !== window.opener) return;
    if (event.data?.nonce !== nonce || event.data?.type !== 'RG_FRAME_CAPTURE') return;
    const auth = await waitForAuthAndConfig();
    if (auth) await uploadCapture(event.data, auth);
  });

  void waitForAuthAndConfig();
})();
