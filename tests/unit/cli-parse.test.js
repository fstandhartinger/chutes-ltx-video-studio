import test from 'node:test';
import assert from 'node:assert/strict';

import { parseLoraSpec, parseKeyframeSpec, parseUrlKeyframeSpec } from '../../src/cli.js';

test('parseLoraSpec parses strength', () => {
  const result = parseLoraSpec('camera-static:1.25');
  assert.equal(result.name, 'camera-static');
  assert.equal(result.strength, 1.25);
});

test('parseKeyframeSpec accepts colons in path', () => {
  const result = parseKeyframeSpec('/tmp/keyframe.png:12:0.5');
  assert.equal(result.path, '/tmp/keyframe.png');
  assert.equal(result.frameIndex, 12);
  assert.equal(result.strength, 0.5);
});

test('parseUrlKeyframeSpec keeps full URL', () => {
  const result = parseUrlKeyframeSpec('https://example.com/frame.png:8:1.1');
  assert.equal(result.url, 'https://example.com/frame.png');
  assert.equal(result.frameIndex, 8);
  assert.equal(result.strength, 1.1);
});
