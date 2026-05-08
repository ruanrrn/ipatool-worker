// Frontend auth wrapper for the new private Worker.
// Single-user; cookie-based session. Worker enforces rate limits + bcrypt.

import { apiFetch } from './api.js'

export async function login(username, password) {
  const { response, data } = await apiFetch('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  })
  if (!response.ok) {
    const err = new Error(data?.error || '登录失败')
    err.status = response.status
    err.retryAfter = data?.retryAfter
    throw err
  }
  return data
}

export async function logout() {
  await apiFetch('/auth/logout', { method: 'POST' })
}

export async function whoami() {
  const { response, data } = await apiFetch('/auth/whoami', { method: 'GET' })
  if (!response.ok) return null
  return data
}
