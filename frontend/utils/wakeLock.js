// Acquire a screen wake lock during long-running ops.
// iOS 16.4+ supports navigator.wakeLock.request('screen').

let _lock = null

export async function acquire() {
  if (typeof navigator === 'undefined' || !navigator.wakeLock) return null
  try {
    if (_lock) return _lock
    _lock = await navigator.wakeLock.request('screen')
    _lock.addEventListener?.('release', () => {
      _lock = null
    })
    return _lock
  } catch (err) {
    console.warn('wakeLock acquire failed:', err)
    return null
  }
}

export async function release() {
  if (!_lock) return
  try {
    await _lock.release()
  } catch {}
  _lock = null
}

// Re-acquire on visibility change — iOS releases the lock when tab goes to bg.
export function installVisibilityHandler() {
  if (typeof document === 'undefined') return
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && _lock === null) {
      acquire()
    }
  })
}
