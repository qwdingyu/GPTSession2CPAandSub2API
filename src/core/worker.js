importScripts('./converter.js');

self.addEventListener('message', (e) => {
  const { type, payload, requestId } = e.data;
  try {
    if (type !== 'parse-sessions') {
      self.postMessage({ type: 'error', requestId, error: `Unknown type: ${type}` });
      return;
    }
    const result = FlowPilotConverter.parseSessionPayload(payload.text, {
      sourceName: payload.sourceName,
      now: new Date(),
      onProgress: (pct, status) => self.postMessage({ type: 'progress', requestId, pct, status }),
    });
    self.postMessage({ type: 'result-parse', requestId, payload: result });
  } catch (err) {
    self.postMessage({ type: 'error', requestId, error: err.message || '转换失败' });
  }
});
