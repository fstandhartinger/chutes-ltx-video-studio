export const PIPELINE_TYPES = {
  TWO_STAGE: 'two_stage',
  DISTILLED: 'distilled',
  IC_LORA: 'ic_lora',
  KEYFRAME_INTERP: 'keyframe_interp',
};

export const PIPELINE_LABELS = {
  [PIPELINE_TYPES.TWO_STAGE]: 'Two-stage (full fidelity)',
  [PIPELINE_TYPES.DISTILLED]: 'Distilled (fast)',
  [PIPELINE_TYPES.IC_LORA]: 'IC LoRA (video-to-video)',
  [PIPELINE_TYPES.KEYFRAME_INTERP]: 'Keyframe interpolation',
};

export const MAX_IMAGE_CONDITIONS = 8;
export const MAX_NUM_FRAMES = 121;
export const MAX_WORK_UNITS = 10000;
export const MAX_INPUT_BYTES = 10 * 1024 * 1024;
export const MAX_BASE64_CHARS = Math.floor((MAX_INPUT_BYTES * 4) / 3) + 4;

export const DEFAULTS = {
  prompt: '',
  negativePrompt: '',
  height: 512,
  width: 768,
  numFrames: 121,
  frameRate: 25,
  numInferenceSteps: 40,
  cfgGuidanceScale: 3.0,
  seed: 42,
  enhancePrompt: false,
  videoStrength: 1.0,
  imageStrength: 1.0,
};
