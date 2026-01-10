import {
  PIPELINE_TYPES,
  MAX_IMAGE_CONDITIONS,
  MAX_NUM_FRAMES,
  MAX_WORK_UNITS,
} from './constants.js';
import { IC_LORA_NAMES, canonicalLoraName } from './loras.js';

export function validateGenerationInput(payload) {
  const errors = [];

  const prompt = (payload.prompt || '').trim();
  if (!prompt) {
    errors.push('Prompt is required.');
  }

  const width = Number(payload.width);
  const height = Number(payload.height);
  if (!Number.isInteger(width) || width < 128 || width > 1536) {
    errors.push('Width must be an integer between 128 and 1536.');
  }
  if (!Number.isInteger(height) || height < 128 || height > 1536) {
    errors.push('Height must be an integer between 128 and 1536.');
  }
  if (Number.isInteger(width) && width % 64 !== 0) {
    errors.push('Width must be divisible by 64.');
  }
  if (Number.isInteger(height) && height % 64 !== 0) {
    errors.push('Height must be divisible by 64.');
  }

  const numFrames = Number(payload.num_frames);
  const numInferenceSteps = Number(payload.num_inference_steps);
  if (!Number.isInteger(numFrames) || numFrames < 1 || numFrames > MAX_NUM_FRAMES) {
    errors.push(`num_frames must be between 1 and ${MAX_NUM_FRAMES}.`);
  }
  if (!Number.isInteger(numInferenceSteps) || numInferenceSteps < 1 || numInferenceSteps > 80) {
    errors.push('num_inference_steps must be between 1 and 80.');
  }
  if (Number.isInteger(numFrames) && Number.isInteger(numInferenceSteps)) {
    const workUnits = numFrames * numInferenceSteps;
    if (workUnits > MAX_WORK_UNITS) {
      errors.push('num_frames * num_inference_steps exceeds runtime limits.');
    }
  }

  const baseImageProvided = Boolean(payload.image_b64 || payload.image_url);
  const images = Array.isArray(payload.images) ? payload.images : [];
  const totalImages = (baseImageProvided ? 1 : 0) + images.length;
  if (totalImages > MAX_IMAGE_CONDITIONS) {
    errors.push(`A maximum of ${MAX_IMAGE_CONDITIONS} images is allowed.`);
  }

  const pipeline = payload.pipeline || null;
  const videoProvided = Boolean(payload.video_b64 || payload.video_url);
  const loras = Array.isArray(payload.loras) ? payload.loras : [];

  if (videoProvided && pipeline && pipeline !== PIPELINE_TYPES.IC_LORA) {
    errors.push('Video conditioning requires pipeline=ic_lora.');
  }

  if (pipeline === PIPELINE_TYPES.IC_LORA) {
    if (!videoProvided) {
      errors.push('ic_lora pipeline requires video_b64 or video_url.');
    }
    if (!loras.length) {
      errors.push('ic_lora pipeline requires at least one IC LoRA.');
    }
    const invalid = loras
      .map((spec) => spec.name)
      .filter((name) => name && !IC_LORA_NAMES.has(canonicalLoraName(name)));
    if (invalid.length) {
      errors.push(`ic_lora pipeline only supports IC LoRAs: ${invalid.join(', ')}`);
    }
  }

  if (pipeline === PIPELINE_TYPES.KEYFRAME_INTERP) {
    const imageCount = totalImages;
    if (imageCount < 2) {
      errors.push('keyframe_interp pipeline requires at least two images.');
    }
  }

  const loraNames = loras.map((spec) => canonicalLoraName(spec.name)).filter(Boolean);
  const uniqueLoras = new Set(loraNames);
  if (uniqueLoras.size !== loraNames.length) {
    errors.push('Duplicate LoRA names are not allowed.');
  }

  const seenFrames = new Set();
  const frameEntries = [];
  if (baseImageProvided) {
    frameEntries.push({ frame_index: payload.image_frame_index ?? 0, source: 'image' });
  }
  for (const entry of images) {
    frameEntries.push({ frame_index: entry.frame_index ?? 0, source: 'images[]' });
  }
  for (const entry of frameEntries) {
    const frameIndex = Number(entry.frame_index);
    if (!Number.isInteger(frameIndex) || frameIndex < 0) {
      errors.push('Image frame_index values must be non-negative integers.');
      break;
    }
    if (Number.isInteger(numFrames) && frameIndex >= numFrames) {
      errors.push('Image frame_index must be less than num_frames.');
      break;
    }
    if (pipeline === PIPELINE_TYPES.KEYFRAME_INTERP) {
      if (seenFrames.has(frameIndex)) {
        errors.push('Duplicate image frame_index values are not allowed for keyframe_interp.');
        break;
      }
      seenFrames.add(frameIndex);
    }
  }

  return errors;
}
