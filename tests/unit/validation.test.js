import test from 'node:test';
import assert from 'node:assert/strict';

import { validateGenerationInput } from '../../src/core/validation.js';
import { PIPELINE_TYPES } from '../../src/core/constants.js';

const basePayload = {
  prompt: 'A cinematic sunrise',
  negative_prompt: '',
  height: 512,
  width: 768,
  num_frames: 24,
  frame_rate: 24,
  num_inference_steps: 10,
  cfg_guidance_scale: 3,
  seed: 42,
  enhance_prompt: false,
  pipeline: PIPELINE_TYPES.TWO_STAGE,
  loras: [],
  images: [],
};

test('validateGenerationInput rejects missing prompt', () => {
  const errors = validateGenerationInput({ ...basePayload, prompt: '   ' });
  assert.ok(errors.some((err) => err.toLowerCase().includes('prompt')));
});

test('validateGenerationInput enforces width divisibility', () => {
  const errors = validateGenerationInput({ ...basePayload, width: 770 });
  assert.ok(errors.some((err) => err.toLowerCase().includes('width')));
});

test('validateGenerationInput enforces ic_lora video requirement', () => {
  const errors = validateGenerationInput({
    ...basePayload,
    pipeline: PIPELINE_TYPES.IC_LORA,
    loras: [{ name: 'canny-control', strength: 1 }],
  });
  assert.ok(errors.some((err) => err.toLowerCase().includes('video')));
});

test('validateGenerationInput enforces keyframe count', () => {
  const errors = validateGenerationInput({
    ...basePayload,
    pipeline: PIPELINE_TYPES.KEYFRAME_INTERP,
    image_b64: 'data:image/png;base64,AA',
    image_frame_index: 0,
    images: [],
  });
  assert.ok(errors.some((err) => err.toLowerCase().includes('keyframe')));
});

test('validateGenerationInput enforces work unit limit', () => {
  const errors = validateGenerationInput({
    ...basePayload,
    num_frames: 121,
    num_inference_steps: 100,
  });
  assert.ok(errors.some((err) => err.toLowerCase().includes('runtime')));
});
