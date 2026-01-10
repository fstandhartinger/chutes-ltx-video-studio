import test from 'node:test';
import assert from 'node:assert/strict';

import { listLoras, getLoraByName, isIcLora, IC_LORA_NAMES } from '../../src/core/loras.js';

test('listLoras exposes all adapters', () => {
  const loras = listLoras();
  assert.equal(loras.length, 11);
  const names = loras.map((lora) => lora.name);
  assert.ok(names.includes('canny-control'));
  assert.ok(names.includes('camera-static'));
});

test('getLoraByName resolves repo IDs', () => {
  const lora = getLoraByName('Lightricks/LTX-2-19b-IC-LoRA-Depth-Control');
  assert.ok(lora);
  assert.equal(lora.name, 'depth-control');
});

test('isIcLora returns true for IC adapters', () => {
  assert.ok(isIcLora('pose-control'));
  assert.ok(!isIcLora('camera-dolly-in'));
  assert.ok(IC_LORA_NAMES.has('detailer'));
});
