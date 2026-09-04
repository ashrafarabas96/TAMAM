/* eslint-disable */
/**
 * TAMAM — live-tracking load test (spec §120).
 *
 * Opens N Socket.IO WebSocket connections against the `/tracking` namespace and
 * streams location batches at the configured cadence, which is what the partner
 * app does while on a job. It measures the ingest acknowledgement latency and
 * the fan-out the customer app would receive.
 *
 * Run:
 *   k6 run -e API_WS=ws://localhost:3000 -e TOKENS_FILE=tokens.json \
 *          -e VUS=200 -e DURATION=5m scripts/load-test/k6-tracking.js
 *
 * `TOKENS_FILE` is a JSON array of partner access tokens; generate it with the
 * helper documented in docs/TESTING.md. Without it the script runs in
 * "anonymous" mode and only measures the handshake rejection path.
 */
import ws from 'k6/ws';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';
import { SharedArray } from 'k6/data';

const API_WS = __ENV.API_WS || 'ws://localhost:3000';
const VUS = Number(__ENV.VUS || 100);
const DURATION = __ENV.DURATION || '2m';
/** Location send interval while on an active job (tracking.interval.active_s default). */
const SAMPLE_INTERVAL_MS = Number(__ENV.SAMPLE_INTERVAL_MS || 4000);
const SAMPLES_PER_BATCH = Number(__ENV.SAMPLES_PER_BATCH || 1);
const CENTER = {
  lat: Number(__ENV.CENTER_LAT || 31.9038),
  lng: Number(__ENV.CENTER_LNG || 35.2034),
};

const tokens = new SharedArray('partner tokens', () => {
  const file = __ENV.TOKENS_FILE;
  if (!file) return [];
  try {
    return JSON.parse(open(file));
  } catch (err) {
    return [];
  }
});

const ingestLatency = new Trend('tamam_ingest_latency_ms', true);
const acceptedSamples = new Counter('tamam_samples_accepted');
const rejectedSamples = new Counter('tamam_samples_rejected');
const connectSuccess = new Rate('tamam_ws_connect_success');

export const options = {
  vus: VUS,
  duration: DURATION,
  thresholds: {
    // A partner's location must be acknowledged well inside one send interval.
    tamam_ingest_latency_ms: ['p(95)<500', 'p(99)<1500'],
    tamam_ws_connect_success: ['rate>0.99'],
    tamam_samples_rejected: ['count<10'],
  },
};

/** Socket.IO v4 packet helpers — k6 has no Socket.IO client, the protocol is tiny. */
const SIO = {
  open: '0',
  connectNamespace: (ns) => `40${ns},`,
  event: (ns, id, name, payload) => `42${ns},${id}${JSON.stringify([name, payload])}`,
  isAck: (msg) => msg.startsWith('43'),
  isEvent: (msg) => msg.startsWith('42'),
};

/** Deterministic wander around the zone centre so PostGIS sees realistic movement. */
function nextPoint(vu, tick) {
  const angle = (vu * 37 + tick * 11) % 360;
  const radius = 0.002 + (vu % 7) * 0.0004;
  return {
    lat: CENTER.lat + radius * Math.cos((angle * Math.PI) / 180),
    lng: CENTER.lng + radius * Math.sin((angle * Math.PI) / 180),
  };
}

export default function () {
  const token = tokens.length ? tokens[(__VU - 1) % tokens.length] : '';
  const url = `${API_WS}/socket.io/?EIO=4&transport=websocket`;
  const params = { headers: token ? { Authorization: `Bearer ${token}` } : {} };

  const res = ws.connect(url, params, (socket) => {
    let tick = 0;
    let ackId = 0;
    const pending = new Map();

    socket.on('open', () => {
      socket.send(SIO.connectNamespace('/tracking'));
    });

    socket.on('message', (msg) => {
      if (msg === SIO.open || msg.startsWith('0{')) return;
      if (msg.startsWith('40')) {
        connectSuccess.add(1);
        return;
      }
      if (SIO.isAck(msg)) {
        const idMatch = msg.match(/^43[^,]*,(\d+)/);
        const id = idMatch ? Number(idMatch[1]) : null;
        const startedAt = id !== null ? pending.get(id) : undefined;
        if (startedAt !== undefined) {
          ingestLatency.add(Date.now() - startedAt);
          pending.delete(id);
        }
        const body = msg.slice(msg.indexOf('['));
        try {
          const parsed = JSON.parse(body)[0];
          if (parsed && parsed.ok) {
            acceptedSamples.add(parsed.accepted || 0);
            rejectedSamples.add(parsed.rejected || 0);
          } else {
            rejectedSamples.add(1);
          }
        } catch (err) {
          rejectedSamples.add(1);
        }
      }
      if (SIO.isEvent(msg) && msg.includes('error')) {
        connectSuccess.add(0);
        socket.close();
      }
    });

    socket.setInterval(() => {
      tick += 1;
      const now = new Date();
      const samples = [];
      for (let i = 0; i < SAMPLES_PER_BATCH; i += 1) {
        const point = nextPoint(__VU, tick + i);
        samples.push({
          lat: Number(point.lat.toFixed(6)),
          lng: Number(point.lng.toFixed(6)),
          accuracy: 8,
          heading: (tick * 13) % 360,
          speed: 8.5,
          timestamp: new Date(now.getTime() - (SAMPLES_PER_BATCH - 1 - i) * 1000).toISOString(),
        });
      }
      ackId += 1;
      pending.set(ackId, Date.now());
      socket.send(SIO.event('/tracking', ackId, 'partner:location', { samples }));
    }, SAMPLE_INTERVAL_MS);

    // Socket.IO keep-alive: reply to every server ping.
    socket.on('ping', () => socket.send('3'));
    socket.setTimeout(() => socket.close(), 60_000);
    socket.on('error', () => connectSuccess.add(0));
  });

  check(res, { 'handshake completed (101)': (r) => r && r.status === 101 });
  sleep(1);
}
