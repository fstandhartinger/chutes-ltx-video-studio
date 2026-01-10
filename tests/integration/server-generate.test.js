import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import supertest from 'supertest';

import { createApp } from '../../src/server.js';

function binaryParser(res, callback) {
  res.setEncoding('binary');
  res.data = '';
  res.on('data', (chunk) => {
    res.data += chunk;
  });
  res.on('end', () => {
    callback(null, Buffer.from(res.data, 'binary'));
  });
}

function startMockChutesServer({ status = 200 } = {}) {
  let lastRequest = null;

  const server = http.createServer((req, res) => {
    if (req.url !== '/generate') {
      res.writeHead(404);
      res.end();
      return;
    }

    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      lastRequest = {
        headers: req.headers,
        body,
      };
      if (status !== 200) {
        res.writeHead(status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ detail: 'mock error' }));
        return;
      }
      const payload = Buffer.from('mock-video');
      res.writeHead(200, { 'Content-Type': 'video/mp4' });
      res.end(payload);
    });
  });

  return new Promise((resolve) => {
    server.listen(0, () => {
      const address = server.address();
      resolve({
        server,
        baseUrl: `http://127.0.0.1:${address.port}`,
        getLastRequest: () => lastRequest,
      });
    });
  });
}

test('POST /api/generate forwards to chutes and returns video', async () => {
  const mock = await startMockChutesServer();
  const app = createApp({
    chutesBaseUrl: mock.baseUrl,
    chutesApiKey: 'test-key',
    appUrl: 'http://localhost:3030',
  });

  const payload = {
    prompt: 'A cinematic skyline',
    negative_prompt: '',
    height: 512,
    width: 768,
    num_frames: 12,
    frame_rate: 24,
    num_inference_steps: 10,
    cfg_guidance_scale: 3,
    seed: 42,
    enhance_prompt: false,
    pipeline: 'two_stage',
    loras: [],
    images: [],
  };

  const response = await supertest(app)
    .post('/api/generate')
    .send(payload)
    .buffer(true)
    .parse(binaryParser)
    .expect(200);

  assert.equal(response.headers['content-type'], 'video/mp4');
  assert.equal(response.body.toString(), 'mock-video');

  const lastRequest = mock.getLastRequest();
  assert.ok(lastRequest);
  assert.equal(lastRequest.headers.authorization, 'Bearer test-key');

  mock.server.close();
});

test('POST /api/generate returns validation errors', async () => {
  const app = createApp({
    chutesBaseUrl: 'http://127.0.0.1:1',
    chutesApiKey: 'test-key',
    appUrl: 'http://localhost:3030',
  });

  const response = await supertest(app)
    .post('/api/generate')
    .send({ prompt: '', width: 770, height: 512, num_frames: 500, num_inference_steps: 1 })
    .expect(400);

  assert.equal(response.body.error, 'validation_error');
  assert.ok(Array.isArray(response.body.details));
});
