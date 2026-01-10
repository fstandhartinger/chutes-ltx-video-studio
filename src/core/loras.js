const LORA_DEFS = [
  {
    name: 'canny-control',
    repoId: 'Lightricks/LTX-2-19b-IC-LoRA-Canny-Control',
    type: 'ic',
    label: 'Canny Control',
    description: 'Edge-guided structure control for video conditioning.',
  },
  {
    name: 'depth-control',
    repoId: 'Lightricks/LTX-2-19b-IC-LoRA-Depth-Control',
    type: 'ic',
    label: 'Depth Control',
    description: 'Depth-aware guidance for video conditioning.',
  },
  {
    name: 'detailer',
    repoId: 'Lightricks/LTX-2-19b-IC-LoRA-Detailer',
    type: 'ic',
    label: 'Detailer',
    description: 'Detail enhancement for conditioned video.',
  },
  {
    name: 'pose-control',
    repoId: 'Lightricks/LTX-2-19b-IC-LoRA-Pose-Control',
    type: 'ic',
    label: 'Pose Control',
    description: 'Pose-driven structure control for video conditioning.',
  },
  {
    name: 'camera-dolly-in',
    repoId: 'Lightricks/LTX-2-19b-LoRA-Camera-Control-Dolly-In',
    type: 'camera',
    label: 'Camera Dolly In',
    description: 'Push-in camera motion.',
  },
  {
    name: 'camera-dolly-out',
    repoId: 'Lightricks/LTX-2-19b-LoRA-Camera-Control-Dolly-Out',
    type: 'camera',
    label: 'Camera Dolly Out',
    description: 'Pull-back camera motion.',
  },
  {
    name: 'camera-dolly-left',
    repoId: 'Lightricks/LTX-2-19b-LoRA-Camera-Control-Dolly-Left',
    type: 'camera',
    label: 'Camera Dolly Left',
    description: 'Leftward camera track.',
  },
  {
    name: 'camera-dolly-right',
    repoId: 'Lightricks/LTX-2-19b-LoRA-Camera-Control-Dolly-Right',
    type: 'camera',
    label: 'Camera Dolly Right',
    description: 'Rightward camera track.',
  },
  {
    name: 'camera-jib-down',
    repoId: 'Lightricks/LTX-2-19b-LoRA-Camera-Control-Jib-Down',
    type: 'camera',
    label: 'Camera Jib Down',
    description: 'Downward jib motion.',
  },
  {
    name: 'camera-jib-up',
    repoId: 'Lightricks/LTX-2-19b-LoRA-Camera-Control-Jib-Up',
    type: 'camera',
    label: 'Camera Jib Up',
    description: 'Upward jib motion.',
  },
  {
    name: 'camera-static',
    repoId: 'Lightricks/LTX-2-19b-LoRA-Camera-Control-Static',
    type: 'camera',
    label: 'Camera Static',
    description: 'Locked-off, static framing.',
  },
];

const LORA_BY_NAME = new Map();
const LORA_BY_REPO = new Map();

for (const def of LORA_DEFS) {
  LORA_BY_NAME.set(def.name, def);
  LORA_BY_REPO.set(def.repoId, def);
}

export function listLoras() {
  return [...LORA_DEFS];
}

export function getLoraByName(name) {
  return LORA_BY_NAME.get(name) || LORA_BY_REPO.get(name) || null;
}

export function isIcLora(name) {
  const def = getLoraByName(name);
  return def?.type === 'ic';
}

export function canonicalLoraName(name) {
  const def = getLoraByName(name);
  return def?.name || name;
}

export const IC_LORA_NAMES = new Set(
  LORA_DEFS.filter((lora) => lora.type === 'ic').map((lora) => lora.name)
);

export const CAMERA_LORA_NAMES = new Set(
  LORA_DEFS.filter((lora) => lora.type === 'camera').map((lora) => lora.name)
);
