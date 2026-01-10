import fs from 'node:fs/promises';
import path from 'node:path';
import { MAX_INPUT_BYTES } from './constants.js';

export async function readFileAsBase64(filePath, maxBytes = MAX_INPUT_BYTES) {
  const resolved = path.resolve(filePath);
  const stats = await fs.stat(resolved);
  if (stats.size > maxBytes) {
    throw new Error(`File exceeds ${maxBytes} bytes: ${filePath}`);
  }
  const buffer = await fs.readFile(resolved);
  return buffer.toString('base64');
}

export function toDataUrl(base64, mimeType = 'application/octet-stream') {
  return `data:${mimeType};base64,${base64}`;
}
