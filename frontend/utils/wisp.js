// Browser-side Wisp v1 client.
//
// Connects to wss://<worker>/wisp/, multiplexes TCP streams over a single
// WebSocket, and exposes:
//
//   const wisp = await connectWisp()
//   const sock = await wisp.openTcp('p25-buy.itunes.apple.com', 443)
//   sock.write(bytes); sock.onData(cb); sock.close()
//
// We *don't* implement TLS here. Apple protocol layers on top need TLS, so
// we delegate that to a separate module (`appleTls.js`) that uses
// libcurl.js + mbedTLS WASM as a wrapper around this raw TCP stream.

const PACKET_CONNECT = 0x01
const PACKET_DATA = 0x02
const PACKET_CONTINUE = 0x03
const PACKET_CLOSE = 0x04
const STREAM_TYPE_TCP = 0x01

function le32(n) {
  return [n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff]
}

function readLE32(arr, off) {
  return arr[off] | (arr[off + 1] << 8) | (arr[off + 2] << 16) | ((arr[off + 3] << 24) >>> 0)
}

class WispStream {
  constructor(wisp, streamId) {
    this.wisp = wisp
    this.id = streamId
    this.closed = false
    this.dataCallbacks = []
    this.closeCallbacks = []
    this._connectResolve = null
    this._connectReject = null
  }

  onData(cb) { this.dataCallbacks.push(cb) }
  onClose(cb) { this.closeCallbacks.push(cb) }

  write(bytes) {
    if (this.closed) throw new Error('stream closed')
    const buf = new Uint8Array(5 + bytes.byteLength)
    buf[0] = PACKET_DATA
    buf.set(le32(this.id), 1)
    buf.set(bytes, 5)
    this.wisp._ws.send(buf)
  }

  close(reason = 0x02) {
    if (this.closed) return
    this.closed = true
    const buf = new Uint8Array(6)
    buf[0] = PACKET_CLOSE
    buf.set(le32(this.id), 1)
    buf[5] = reason
    try { this.wisp._ws.send(buf) } catch {}
    this._fireClose(reason)
  }

  _fireData(bytes) {
    for (const cb of this.dataCallbacks) {
      try { cb(bytes) } catch (err) { console.warn('wisp stream onData error:', err) }
    }
  }

  _fireClose(reason) {
    if (!this._closeFired) {
      this._closeFired = true
      for (const cb of this.closeCallbacks) {
        try { cb(reason) } catch {}
      }
    }
  }
}

class WispClient {
  constructor(ws) {
    this._ws = ws
    this._streams = new Map()
    this._nextId = 1
    this._connectPromises = new Map()
    ws.binaryType = 'arraybuffer'
    ws.addEventListener('message', (evt) => this._onMessage(evt))
    ws.addEventListener('close', () => this._onWsClose())
    ws.addEventListener('error', () => this._onWsClose())
  }

  _onMessage(evt) {
    if (typeof evt.data === 'string') return
    const buf = new Uint8Array(evt.data)
    if (buf.byteLength < 5) return
    const type = buf[0]
    const streamId = readLE32(buf, 1)

    if (type === PACKET_CONTINUE) {
      // streamId 0 is the initial server-wide buffer advertisement; ignore.
      // Per-stream backpressure is handled by the WebSocket itself.
      // If this is the response to a CONNECT we sent (i.e. the server accepted
      // our connect), resolve any pending connect promise for this stream id.
      const pending = this._connectPromises.get(streamId)
      if (pending) {
        pending.resolve()
        this._connectPromises.delete(streamId)
      }
      return
    }

    if (type === PACKET_DATA) {
      const stream = this._streams.get(streamId)
      if (stream) stream._fireData(buf.subarray(5))
      return
    }

    if (type === PACKET_CLOSE) {
      const reason = buf[5] || 0
      const stream = this._streams.get(streamId)
      if (stream) {
        stream.closed = true
        stream._fireClose(reason)
        this._streams.delete(streamId)
      }
      const pending = this._connectPromises.get(streamId)
      if (pending) {
        pending.reject(new Error(`wisp connect rejected (reason=${reason.toString(16)})`))
        this._connectPromises.delete(streamId)
      }
      return
    }
  }

  _onWsClose() {
    for (const [, stream] of this._streams) {
      stream.closed = true
      stream._fireClose(0xff)
    }
    this._streams.clear()
    for (const [, pending] of this._connectPromises) {
      pending.reject(new Error('websocket closed'))
    }
    this._connectPromises.clear()
  }

  async openTcp(host, port) {
    const id = this._nextId++
    const hostBytes = new TextEncoder().encode(host)
    const buf = new Uint8Array(8 + hostBytes.byteLength)
    buf[0] = PACKET_CONNECT
    buf.set(le32(id), 1)
    buf[5] = STREAM_TYPE_TCP
    buf[6] = port & 0xff
    buf[7] = (port >>> 8) & 0xff
    buf.set(hostBytes, 8)

    const stream = new WispStream(this, id)
    this._streams.set(id, stream)
    const ack = new Promise((resolve, reject) => {
      this._connectPromises.set(id, { resolve, reject })
    })
    this._ws.send(buf)

    // Server sends a CONTINUE for streamId on accept. Some servers send no
    // explicit ack and just start passing data; race with a 1-tick timeout.
    try {
      await Promise.race([ack, new Promise((r) => setTimeout(r, 50))])
    } catch (err) {
      this._streams.delete(id)
      throw err
    }
    return stream
  }

  close() {
    try { this._ws.close() } catch {}
  }
}

export async function connectWisp(url = '/wisp') {
  const wsUrl = url.startsWith('ws')
    ? url
    : (location.protocol === 'https:' ? 'wss:' : 'ws:') + '//' + location.host + url
  const ws = new WebSocket(wsUrl)
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', () => resolve(), { once: true })
    ws.addEventListener('error', (e) => reject(e), { once: true })
  })
  return new WispClient(ws)
}
