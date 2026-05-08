// Wisp v1 TCP relay over WebSocket.
//
// Wisp is a multiplexing protocol that lets a browser tunnel arbitrary TCP
// connections through a single WebSocket. The Worker is a "blind" relay -
// it speaks Wisp framing on the WS side and uses Cloudflare's `connect()`
// API to open outbound TCP. The browser does its own TLS via libcurl.js +
// mbedTLS, so Apple credentials are E2E-encrypted.
//
// Spec reference: https://github.com/MercuryWorkshop/wisp-protocol
//
// We implement a minimal subset of Wisp v1:
//   - PACKET type 0x01 CONNECT  (server reads streamId, type, port, host)
//   - PACKET type 0x02 DATA     (server pipes between WS and TCP socket)
//   - PACKET type 0x03 CONTINUE (we send back to grow the browser's send window)
//   - PACKET type 0x04 CLOSE    (either side, with reason byte)
//
// Header format:
//   uint8  type
//   uint32le streamId
//   ...payload
//
// The browser-side library (`@mercuryworkshop/wisp-client-js`) handles all
// TCP/UDP socket emulation; this server just multiplexes streams onto real
// outbound sockets.

import type { Env } from './types'
import { connect } from 'cloudflare:sockets'
import { compileHostAllowlist, isHostAllowed } from './wisp-allowlist'

export { isHostAllowed } from './wisp-allowlist'

const PACKET_CONNECT = 0x01
const PACKET_DATA = 0x02
const PACKET_CONTINUE = 0x03
const PACKET_CLOSE = 0x04

const STREAM_TYPE_TCP = 0x01

// Per-session concurrency: max 5 active streams.
const MAX_STREAMS = 5
// Initial buffer window we advertise to the client.
const INITIAL_BUFFER = 256

interface StreamState {
  socket: any // Cloudflare TCP socket
  writer: WritableStreamDefaultWriter<Uint8Array>
  closed: boolean
}

function le32(arr: Uint8Array, offset: number): number {
  return (
    arr[offset]! |
    (arr[offset + 1]! << 8) |
    (arr[offset + 2]! << 16) |
    ((arr[offset + 3]! << 24) >>> 0)
  )
}

function encodeContinue(streamId: number, bufferRemaining: number): Uint8Array {
  const buf = new Uint8Array(9)
  buf[0] = PACKET_CONTINUE
  buf[1] = streamId & 0xff
  buf[2] = (streamId >>> 8) & 0xff
  buf[3] = (streamId >>> 16) & 0xff
  buf[4] = (streamId >>> 24) & 0xff
  buf[5] = bufferRemaining & 0xff
  buf[6] = (bufferRemaining >>> 8) & 0xff
  buf[7] = (bufferRemaining >>> 16) & 0xff
  buf[8] = (bufferRemaining >>> 24) & 0xff
  return buf
}

function encodeClose(streamId: number, reason: number): Uint8Array {
  const buf = new Uint8Array(6)
  buf[0] = PACKET_CLOSE
  buf[1] = streamId & 0xff
  buf[2] = (streamId >>> 8) & 0xff
  buf[3] = (streamId >>> 16) & 0xff
  buf[4] = (streamId >>> 24) & 0xff
  buf[5] = reason & 0xff
  return buf
}

function encodeData(streamId: number, data: Uint8Array): Uint8Array {
  const buf = new Uint8Array(5 + data.byteLength)
  buf[0] = PACKET_DATA
  buf[1] = streamId & 0xff
  buf[2] = (streamId >>> 8) & 0xff
  buf[3] = (streamId >>> 16) & 0xff
  buf[4] = (streamId >>> 24) & 0xff
  buf.set(data, 5)
  return buf
}

export async function handleWisp(req: Request, env: Env): Promise<Response> {
  if (req.headers.get('upgrade') !== 'websocket') {
    return new Response('expected websocket upgrade', { status: 426 })
  }
  const allowlist = compileHostAllowlist(env)

  const pair = new WebSocketPair()
  const [client, server] = Object.values(pair) as [WebSocket, WebSocket]
  ;(server as unknown as { accept(): void }).accept()

  const streams = new Map<number, StreamState>()

  const cleanup = (reason: string) => {
    for (const [id, st] of streams) {
      try {
        st.writer.close().catch(() => {})
      } catch {}
      try {
        st.socket.close()
      } catch {}
      streams.delete(id)
    }
    try {
      server.close(1000, reason)
    } catch {}
  }

  // Send the initial CONTINUE packet for streamId=0 (per Wisp v1 spec, this
  // advertises the server-wide buffer size for new streams).
  try {
    server.send(encodeContinue(0, INITIAL_BUFFER))
  } catch {}

  server.addEventListener('message', async (evt) => {
    const data = evt.data
    let buf: Uint8Array
    if (typeof data === 'string') return // ignore text frames
    if (data instanceof ArrayBuffer) {
      buf = new Uint8Array(data)
    } else {
      // Some runtimes pass Buffer-like objects.
      buf = new Uint8Array(data as ArrayBuffer)
    }
    if (buf.byteLength < 5) return
    const type = buf[0]!
    const streamId = le32(buf, 1)

    if (type === PACKET_CONNECT) {
      // payload: streamType(1), port(2 LE), hostname(rest, utf8)
      if (buf.byteLength < 8) {
        server.send(encodeClose(streamId, 0x03))
        return
      }
      const streamType = buf[5]!
      const port = buf[6]! | (buf[7]! << 8)
      const host = new TextDecoder().decode(buf.subarray(8))
      if (streamType !== STREAM_TYPE_TCP) {
        server.send(encodeClose(streamId, 0x41)) // unsupported
        return
      }
      if (streams.size >= MAX_STREAMS) {
        server.send(encodeClose(streamId, 0x47))
        return
      }
      if (!isHostAllowed(host, allowlist)) {
        console.warn(`wisp: blocked host ${host}:${port}`)
        server.send(encodeClose(streamId, 0x42))
        return
      }
      try {
        const sock = connect({ hostname: host, port })
        const writer = sock.writable.getWriter()
        const state: StreamState = { socket: sock, writer, closed: false }
        streams.set(streamId, state)
        // Pipe incoming TCP -> WS as DATA frames.
        ;(async () => {
          const reader = sock.readable.getReader()
          try {
            for (;;) {
              const { value, done } = await reader.read()
              if (done) break
              if (value && value.byteLength) {
                try {
                  server.send(encodeData(streamId, value))
                } catch {
                  break
                }
              }
            }
          } catch (err) {
            console.warn('wisp tcp read error:', err)
          } finally {
            try { reader.releaseLock() } catch {}
            const st = streams.get(streamId)
            if (st && !st.closed) {
              st.closed = true
              try {
                server.send(encodeClose(streamId, 0x02))
              } catch {}
              streams.delete(streamId)
            }
          }
        })()
      } catch (err) {
        console.warn('wisp connect failed:', err)
        try {
          server.send(encodeClose(streamId, 0x03))
        } catch {}
      }
      return
    }

    if (type === PACKET_DATA) {
      const st = streams.get(streamId)
      if (!st || st.closed) return
      try {
        await st.writer.write(buf.subarray(5))
      } catch (err) {
        st.closed = true
        streams.delete(streamId)
        try {
          server.send(encodeClose(streamId, 0x03))
        } catch {}
        return
      }
      // Re-grow the window so the client can keep sending.
      try {
        server.send(encodeContinue(streamId, INITIAL_BUFFER))
      } catch {}
      return
    }

    if (type === PACKET_CONTINUE) {
      // Browser-side flow control hint; ignored on server (we trust CF backpressure).
      return
    }

    if (type === PACKET_CLOSE) {
      const st = streams.get(streamId)
      if (st) {
        st.closed = true
        try { st.writer.close().catch(() => {}) } catch {}
        try { st.socket.close() } catch {}
        streams.delete(streamId)
      }
      return
    }
  })

  server.addEventListener('close', () => cleanup('client closed'))
  server.addEventListener('error', () => cleanup('client error'))

  return new Response(null, {
    status: 101,
    webSocket: client,
  } as ResponseInit & { webSocket: WebSocket })
}
