#!/usr/bin/env node
import { Command } from 'commander';
import fs from 'node:fs/promises';
import path from 'node:path';
import dotenv from 'dotenv';

import { listLoras, IC_LORA_NAMES } from './core/loras.js';
import { readFileAsBase64 } from './core/encoding.js';
import { buildGenerationPayload, ValidationError } from './core/request.js';
import { invokeLtx2 } from './core/client.js';
import { DEFAULTS, PIPELINE_TYPES } from './core/constants.js';


dotenv.config();

export function parseLoraSpec(value) {
  const [name, strengthRaw] = value.split(':');
  return {
    name: name.trim(),
    strength: strengthRaw ? Number(strengthRaw) : 1.0,
  };
}

export function parseKeyframeSpec(value) {
  const parts = value.split(':');
  if (parts.length < 2) {
    throw new Error('Keyframe format must be path:frame[:strength].');
  }
  const strengthRaw = parts.length > 2 ? parts.pop() : null;
  const frameRaw = parts.pop();
  const filePath = parts.join(':');
  return {
    path: filePath,
    frameIndex: Number(frameRaw),
    strength: strengthRaw ? Number(strengthRaw) : 1.0,
  };
}

export function parseUrlKeyframeSpec(value) {
  const parts = value.split(':');
  if (parts.length < 2) {
    throw new Error('Keyframe URL format must be url:frame[:strength].');
  }
  const strengthRaw = parts.length > 2 ? parts.pop() : null;
  const frameRaw = parts.pop();
  const url = parts.join(':');
  return {
    url,
    frameIndex: Number(frameRaw),
    strength: strengthRaw ? Number(strengthRaw) : 1.0,
  };
}

async function loadConfigFile(configPath) {
  const resolved = path.resolve(configPath);
  const raw = await fs.readFile(resolved, 'utf-8');
  return JSON.parse(raw);
}

async function resolveImages(primaryImagePath, primaryImageUrl, options) {
  let image = null;

  if (primaryImagePath) {
    const base64 = await readFileAsBase64(primaryImagePath);
    image = {
      base64,
      frameIndex: Number(options.imageFrame ?? 0),
      strength: Number(options.imageStrength ?? DEFAULTS.imageStrength),
    };
  } else if (primaryImageUrl) {
    image = {
      url: primaryImageUrl,
      frameIndex: Number(options.imageFrame ?? 0),
      strength: Number(options.imageStrength ?? DEFAULTS.imageStrength),
    };
  }

  const keyframes = [];
  const keyframeSpecs = options.keyframe || [];
  for (const spec of keyframeSpecs) {
    const parsed = parseKeyframeSpec(spec);
    const base64 = await readFileAsBase64(parsed.path);
    keyframes.push({
      base64,
      frameIndex: parsed.frameIndex,
      strength: parsed.strength,
    });
  }

  const keyframeUrls = options.keyframeUrl || [];
  for (const spec of keyframeUrls) {
    const parsed = parseUrlKeyframeSpec(spec);
    keyframes.push({
      url: parsed.url,
      frameIndex: parsed.frameIndex,
      strength: parsed.strength,
    });
  }

  return { image, keyframes };
}

async function resolveVideo(videoPath, videoUrl, options) {
  if (videoPath) {
    const base64 = await readFileAsBase64(videoPath);
    return {
      base64,
      strength: Number(options.videoStrength ?? DEFAULTS.videoStrength),
    };
  }
  if (videoUrl) {
    return {
      url: videoUrl,
      strength: Number(options.videoStrength ?? DEFAULTS.videoStrength),
    };
  }
  return null;
}

function buildInputFromOptions(options, overrides) {
  return {
    prompt: options.prompt ?? overrides.prompt,
    negativePrompt: options.negativePrompt ?? overrides.negativePrompt,
    height: options.height ?? overrides.height,
    width: options.width ?? overrides.width,
    numFrames: options.numFrames ?? overrides.numFrames,
    frameRate: options.frameRate ?? overrides.frameRate,
    numInferenceSteps: options.numInferenceSteps ?? overrides.numInferenceSteps,
    cfgGuidanceScale: options.cfgGuidanceScale ?? overrides.cfgGuidanceScale,
    seed: options.seed ?? overrides.seed,
    enhancePrompt: options.enhancePrompt ?? overrides.enhancePrompt,
    pipeline: options.pipeline ?? overrides.pipeline,
    loras: overrides.loras ?? [],
  };
}

const program = new Command();
program
  .name('ltx-studio')
  .description('CLI for the Chutes LTX-2 Video Studio')
  .version('1.0.0');

program
  .command('list-loras')
  .description('List available LTX-2 LoRA adapters')
  .action(() => {
    const grouped = {
      ic: [],
      camera: [],
    };
    for (const lora of listLoras()) {
      grouped[lora.type].push(lora);
    }

    console.log('IC LoRAs:');
    for (const lora of grouped.ic) {
      console.log(`- ${lora.name} (${lora.label})`);
    }

    console.log('\nCamera LoRAs:');
    for (const lora of grouped.camera) {
      console.log(`- ${lora.name} (${lora.label})`);
    }
  });

program
  .command('generate')
  .description('Generate a video using LTX-2')
  .requiredOption('-p, --prompt <text>', 'Prompt')
  .option('-n, --negative-prompt <text>', 'Negative prompt')
  .option('--height <number>', 'Height', Number)
  .option('--width <number>', 'Width', Number)
  .option('--num-frames <number>', 'Number of frames', Number)
  .option('--frame-rate <number>', 'Frame rate', Number)
  .option('--num-inference-steps <number>', 'Inference steps', Number)
  .option('--cfg-guidance-scale <number>', 'CFG guidance scale', Number)
  .option('--seed <number>', 'Seed', Number)
  .option('--enhance-prompt', 'Enable prompt enhancement')
  .option('--pipeline <type>', `Pipeline (${Object.values(PIPELINE_TYPES).join(', ')})`)
  .option('--image <path>', 'Primary image path')
  .option('--image-url <url>', 'Primary image URL')
  .option('--image-frame <number>', 'Primary image frame index', Number)
  .option('--image-strength <number>', 'Primary image strength', Number)
  .option('--keyframe <spec>', 'Keyframe path:frame[:strength]', (value, prev) => prev.concat(value), [])
  .option('--keyframe-url <spec>', 'Keyframe url:frame[:strength]', (value, prev) => prev.concat(value), [])
  .option('--video <path>', 'Video conditioning path')
  .option('--video-url <url>', 'Video conditioning URL')
  .option('--video-strength <number>', 'Video strength', Number)
  .option('--lora <spec>', 'LoRA name:strength', (value, prev) => prev.concat(value), [])
  .option('--config <path>', 'Load config JSON')
  .option('--dry-run', 'Validate and print request without calling the API')
  .option('--out <path>', 'Output file path', 'output.mp4')
  .option('--base-url <url>', 'Override Chutes LTX-2 base URL')
  .option('--api-key <key>', 'Override CHUTES_API_KEY')
  .action(async (options) => {
    let overrides = {
      prompt: options.prompt,
      negativePrompt: options.negativePrompt,
      height: options.height ?? DEFAULTS.height,
      width: options.width ?? DEFAULTS.width,
      numFrames: options.numFrames ?? DEFAULTS.numFrames,
      frameRate: options.frameRate ?? DEFAULTS.frameRate,
      numInferenceSteps: options.numInferenceSteps ?? DEFAULTS.numInferenceSteps,
      cfgGuidanceScale: options.cfgGuidanceScale ?? DEFAULTS.cfgGuidanceScale,
      seed: options.seed ?? DEFAULTS.seed,
      enhancePrompt: options.enhancePrompt ?? DEFAULTS.enhancePrompt,
      pipeline: options.pipeline ?? null,
      loras: [],
    };

    if (options.config) {
      const configData = await loadConfigFile(options.config);
      overrides = { ...overrides, ...configData };
    }

    if (options.lora?.length) {
      overrides.loras = options.lora.map(parseLoraSpec);
    }

    if (overrides.pipeline === PIPELINE_TYPES.IC_LORA && overrides.loras.length) {
      const invalid = overrides.loras
        .map((spec) => spec.name)
        .filter((name) => !IC_LORA_NAMES.has(name));
      if (invalid.length) {
        throw new Error(`ic_lora only supports IC LoRAs: ${invalid.join(', ')}`);
      }
    }

    const { image, keyframes } = await resolveImages(options.image, options.imageUrl, options);
    const video = await resolveVideo(options.video, options.videoUrl, options);

    const input = buildInputFromOptions(options, overrides);
    input.image = image;
    input.images = keyframes;
    input.video = video;

    try {
      const payload = buildGenerationPayload(input);

      if (options.dryRun) {
        console.log(JSON.stringify(payload, null, 2));
        return;
      }

      const baseUrl = options.baseUrl || process.env.CHUTES_LTX2_BASE_URL || 'https://chutes-ltx-2.chutes.ai';
      const apiKey = options.apiKey || process.env.CHUTES_API_KEY;

      const result = await invokeLtx2({
        payload,
        baseUrl,
        apiKey,
        accessToken: null,
        idpHost: 'https://idp.chutes.ai',
        chuteHost: new URL(baseUrl).host,
      });

      await fs.writeFile(options.out, result.buffer);
      console.log(`Saved video to ${options.out}`);
    } catch (error) {
      if (error instanceof ValidationError) {
        console.error('Validation errors:');
        for (const detail of error.errors) {
          console.error(`- ${detail}`);
        }
        process.exit(1);
      }
      console.error(`Error: ${error.message}`);
      process.exit(1);
    }
  });

const isDirectRun = process.argv[1] && new URL(import.meta.url).pathname === path.resolve(process.argv[1]);
if (isDirectRun) {
  program.parseAsync(process.argv);
}
