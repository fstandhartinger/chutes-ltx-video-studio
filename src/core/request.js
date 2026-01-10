import { DEFAULTS } from './constants.js';
import { validateGenerationInput } from './validation.js';

export class ValidationError extends Error {
  constructor(errors) {
    super(errors.join(' '));
    this.name = 'ValidationError';
    this.errors = errors;
  }
}

export function buildGenerationPayload(input) {
  const payload = {
    prompt: input.prompt ?? DEFAULTS.prompt,
    negative_prompt: input.negativePrompt ?? input.negative_prompt ?? DEFAULTS.negativePrompt,
    height: Number(input.height ?? DEFAULTS.height),
    width: Number(input.width ?? DEFAULTS.width),
    num_frames: Number(input.numFrames ?? input.num_frames ?? DEFAULTS.numFrames),
    frame_rate: Number(input.frameRate ?? input.frame_rate ?? DEFAULTS.frameRate),
    num_inference_steps: Number(
      input.numInferenceSteps ?? input.num_inference_steps ?? DEFAULTS.numInferenceSteps
    ),
    cfg_guidance_scale: Number(
      input.cfgGuidanceScale ?? input.cfg_guidance_scale ?? DEFAULTS.cfgGuidanceScale
    ),
    seed: Number(input.seed ?? DEFAULTS.seed),
    enhance_prompt: Boolean(input.enhancePrompt ?? input.enhance_prompt ?? DEFAULTS.enhancePrompt),
    pipeline: input.pipeline ?? null,
    loras: Array.isArray(input.loras)
      ? input.loras.map((spec) => ({
          name: spec.name,
          strength: Number(spec.strength ?? 1.0),
        }))
      : [],
    images: [],
  };

  if (input.image_b64 || input.image_url) {
    payload.image_b64 = input.image_b64 || undefined;
    payload.image_url = input.image_url || undefined;
    payload.image_frame_index = Number(input.image_frame_index ?? input.imageFrameIndex ?? 0);
    payload.image_strength = Number(input.image_strength ?? input.imageStrength ?? DEFAULTS.imageStrength);
  } else if (input.image) {
    payload.image_b64 = input.image.base64 || undefined;
    payload.image_url = input.image.url || undefined;
    payload.image_frame_index = Number(input.image.frameIndex ?? 0);
    payload.image_strength = Number(input.image.strength ?? DEFAULTS.imageStrength);
  }

  const imageEntries = input.images ?? [];
  payload.images = Array.isArray(imageEntries)
    ? imageEntries.map((entry) => ({
        image_b64: entry.image_b64 || entry.base64 || undefined,
        image_url: entry.image_url || entry.url || undefined,
        frame_index: Number(entry.frame_index ?? entry.frameIndex ?? 0),
        strength: Number(entry.strength ?? DEFAULTS.imageStrength),
      }))
    : [];

  if (input.video_b64 || input.video_url) {
    payload.video_b64 = input.video_b64 || undefined;
    payload.video_url = input.video_url || undefined;
    payload.video_strength = Number(input.video_strength ?? DEFAULTS.videoStrength);
  } else if (input.video) {
    payload.video_b64 = input.video.base64 || undefined;
    payload.video_url = input.video.url || undefined;
    payload.video_strength = Number(input.video.strength ?? DEFAULTS.videoStrength);
  }

  const errors = validateGenerationInput(payload);
  if (errors.length) {
    throw new ValidationError(errors);
  }

  return payload;
}
