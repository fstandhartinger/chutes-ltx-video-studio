const MAX_IMAGE_CONDITIONS = 8;
const MAX_NUM_FRAMES = 121;
const MAX_WORK_UNITS = 10000;

const state = {
  loras: [],
  selectedLoras: new Map(),
  keyframes: [],
  primaryImage: null,
  video: null,
  auth: {
    authenticated: false,
    user: null,
    hasInvokeScope: false,
  },
  history: [],
};

const elements = {
  prompt: document.getElementById('promptInput'),
  negativePrompt: document.getElementById('negativePromptInput'),
  pipeline: document.getElementById('pipelineSelect'),
  seed: document.getElementById('seedInput'),
  width: document.getElementById('widthInput'),
  height: document.getElementById('heightInput'),
  frames: document.getElementById('framesInput'),
  fps: document.getElementById('fpsInput'),
  steps: document.getElementById('stepsInput'),
  cfg: document.getElementById('cfgInput'),
  enhance: document.getElementById('enhanceToggle'),
  durationLabel: document.getElementById('durationLabel'),
  workUnits: document.getElementById('workUnits'),
  generateBtn: document.getElementById('generateBtn'),
  validateBtn: document.getElementById('validateBtn'),
  statusText: document.getElementById('statusText'),
  loraSearch: document.getElementById('loraSearch'),
  loraLibrary: document.getElementById('loraLibrary'),
  loraSelected: document.getElementById('loraSelected'),
  keyframeList: document.getElementById('keyframeList'),
  addKeyframeBtn: document.getElementById('addKeyframeBtn'),
  keyframeInput: document.getElementById('keyframeInput'),
  primaryImageFile: document.getElementById('primaryImageFile'),
  primaryImageUrl: document.getElementById('primaryImageUrl'),
  primaryFrame: document.getElementById('primaryFrame'),
  primaryStrength: document.getElementById('primaryStrength'),
  primaryPreview: document.getElementById('primaryPreview'),
  videoFile: document.getElementById('videoFile'),
  videoUrl: document.getElementById('videoUrl'),
  videoStrength: document.getElementById('videoStrength'),
  videoPreview: document.getElementById('videoPreview'),
  previewVideo: document.getElementById('previewVideo'),
  previewPlaceholder: document.getElementById('previewPlaceholder'),
  downloadBtn: document.getElementById('downloadBtn'),
  outputStatus: document.getElementById('outputStatus'),
  validationErrors: document.getElementById('validationErrors'),
  historyList: document.getElementById('historyList'),
  authScope: document.getElementById('authScope'),
  authUser: document.getElementById('authUser'),
  loginBtn: document.getElementById('loginBtn'),
  logoutBtn: document.getElementById('logoutBtn'),
};

function setStatus(message) {
  elements.statusText.textContent = message;
}

function setOutputStatus(message, isActive = false) {
  elements.outputStatus.textContent = message;
  elements.outputStatus.style.color = isActive ? '#63d297' : '#d1d5db';
}

function updateMetrics() {
  const frames = Number(elements.frames.value || 0);
  const fps = Number(elements.fps.value || 1);
  const steps = Number(elements.steps.value || 0);
  const duration = fps ? frames / fps : 0;
  elements.durationLabel.textContent = `${duration.toFixed(2)}s`;
  elements.workUnits.textContent = String(frames * steps);
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function renderAuthStatus() {
  if (state.auth.authenticated) {
    elements.authScope.textContent = state.auth.hasInvokeScope ? 'Chutes invoke active' : 'Signed in';
    elements.authScope.style.background = state.auth.hasInvokeScope
      ? 'rgba(99,210,151,0.15)'
      : 'rgba(250,93,25,0.2)';
    elements.authScope.style.color = state.auth.hasInvokeScope ? '#63d297' : '#fa5d19';
    elements.authUser.textContent = state.auth.user?.username || 'Chutes user';
    elements.loginBtn.hidden = true;
    elements.logoutBtn.hidden = false;
  } else {
    elements.authScope.textContent = 'Signed out';
    elements.authScope.style.background = 'rgba(99,210,151,0.1)';
    elements.authScope.style.color = '#63d297';
    elements.authUser.textContent = 'Guest';
    elements.loginBtn.hidden = false;
    elements.logoutBtn.hidden = true;
  }
}

async function syncAuthStatus() {
  try {
    const response = await fetch('/api/auth/me');
    const data = await response.json();
    state.auth = data;
  } catch (error) {
    state.auth = { authenticated: false };
  }
  renderAuthStatus();
}

function renderLoraLibrary() {
  const search = elements.loraSearch.value.toLowerCase();
  elements.loraLibrary.innerHTML = '';

  const filtered = state.loras.filter((lora) =>
    lora.name.toLowerCase().includes(search) || lora.label.toLowerCase().includes(search)
  );

  for (const lora of filtered) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'lora-card';
    card.dataset.lora = lora.name;
    if (state.selectedLoras.has(lora.name)) {
      card.classList.add('active');
    }

    const title = document.createElement('h5');
    title.textContent = `${lora.label}`;
    const meta = document.createElement('p');
    meta.textContent = `${lora.type.toUpperCase()} · ${lora.description}`;

    card.appendChild(title);
    card.appendChild(meta);

    card.addEventListener('click', () => toggleLora(lora));

    elements.loraLibrary.appendChild(card);
  }
}

function renderSelectedLoras() {
  elements.loraSelected.innerHTML = '';

  if (state.selectedLoras.size === 0) {
    const empty = document.createElement('p');
    empty.textContent = 'No LoRAs selected yet.';
    empty.style.color = '#9ca3af';
    elements.loraSelected.appendChild(empty);
    return;
  }

  for (const [name, entry] of state.selectedLoras.entries()) {
    const card = document.createElement('div');
    card.className = 'lora-card active';

    const title = document.createElement('h5');
    title.textContent = entry.label;

    const meta = document.createElement('p');
    meta.textContent = `${entry.type.toUpperCase()} · ${entry.description}`;

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = '0';
    slider.max = '2';
    slider.step = '0.05';
    slider.value = String(entry.strength);
    slider.className = 'lora-strength';

    slider.addEventListener('input', () => {
      entry.strength = Number(slider.value);
    });

    const remove = document.createElement('button');
    remove.className = 'btn ghost';
    remove.textContent = 'Remove';
    remove.style.marginTop = '8px';
    remove.addEventListener('click', () => {
      state.selectedLoras.delete(name);
      renderLoraLibrary();
      renderSelectedLoras();
    });

    card.appendChild(title);
    card.appendChild(meta);
    card.appendChild(slider);
    card.appendChild(remove);

    elements.loraSelected.appendChild(card);
  }
}

function toggleLora(lora) {
  if (state.selectedLoras.has(lora.name)) {
    state.selectedLoras.delete(lora.name);
  } else {
    state.selectedLoras.set(lora.name, {
      ...lora,
      strength: 1.0,
    });
  }
  renderLoraLibrary();
  renderSelectedLoras();
}

function renderKeyframes() {
  elements.keyframeList.innerHTML = '';

  if (state.keyframes.length === 0) {
    const empty = document.createElement('p');
    empty.textContent = 'No keyframes yet. Add at least two for interpolation.';
    empty.style.color = '#9ca3af';
    elements.keyframeList.appendChild(empty);
    return;
  }

  for (const frame of state.keyframes) {
    const card = document.createElement('div');
    card.className = 'timeline-card';

    const img = document.createElement('img');
    img.src = frame.previewUrl;

    const controls = document.createElement('div');

    const frameInput = document.createElement('input');
    frameInput.type = 'number';
    frameInput.value = frame.frameIndex;
    frameInput.placeholder = 'Frame index';
    frameInput.addEventListener('input', () => {
      frame.frameIndex = Number(frameInput.value);
    });

    const strengthInput = document.createElement('input');
    strengthInput.type = 'number';
    strengthInput.step = '0.1';
    strengthInput.value = frame.strength;
    strengthInput.placeholder = 'Strength';
    strengthInput.addEventListener('input', () => {
      frame.strength = Number(strengthInput.value);
    });

    const remove = document.createElement('button');
    remove.className = 'btn ghost';
    remove.textContent = 'Remove';
    remove.addEventListener('click', () => {
      state.keyframes = state.keyframes.filter((item) => item.id !== frame.id);
      renderKeyframes();
    });

    controls.appendChild(frameInput);
    controls.appendChild(strengthInput);
    controls.appendChild(remove);

    card.appendChild(img);
    card.appendChild(controls);

    elements.keyframeList.appendChild(card);
  }
}

function renderPrimaryPreview() {
  elements.primaryPreview.innerHTML = '';
  if (!state.primaryImage) {
    elements.primaryPreview.textContent = 'No image selected.';
    return;
  }
  const img = document.createElement('img');
  img.src = state.primaryImage.previewUrl;
  elements.primaryPreview.appendChild(img);
}

function renderVideoPreview() {
  elements.videoPreview.innerHTML = '';
  if (!state.video) {
    elements.videoPreview.textContent = 'No video selected.';
    return;
  }
  const video = document.createElement('video');
  video.src = state.video.previewUrl;
  video.controls = true;
  elements.videoPreview.appendChild(video);
}

function addHistoryItem(url) {
  const entry = {
    id: crypto.randomUUID(),
    url,
    createdAt: new Date(),
  };
  state.history.unshift(entry);
  renderHistory();
}

function renderHistory() {
  elements.historyList.innerHTML = '';

  if (state.history.length === 0) {
    elements.historyList.textContent = 'No renders yet.';
    elements.historyList.style.color = '#9ca3af';
    return;
  }

  for (const item of state.history) {
    const card = document.createElement('div');
    card.className = 'history-card';

    const title = document.createElement('span');
    title.textContent = `Render ${item.createdAt.toLocaleTimeString()}`;

    const link = document.createElement('a');
    link.href = item.url;
    link.download = `ltx2-${item.id}.mp4`;
    link.textContent = 'Download';
    link.className = 'btn ghost';

    card.appendChild(title);
    card.appendChild(link);

    elements.historyList.appendChild(card);
  }
}

function buildPayload() {
  const loras = [...state.selectedLoras.values()].map((entry) => ({
    name: entry.name,
    strength: entry.strength,
  }));

  const payload = {
    prompt: elements.prompt.value,
    negative_prompt: elements.negativePrompt.value,
    height: Number(elements.height.value),
    width: Number(elements.width.value),
    num_frames: Number(elements.frames.value),
    frame_rate: Number(elements.fps.value),
    num_inference_steps: Number(elements.steps.value),
    cfg_guidance_scale: Number(elements.cfg.value),
    seed: Number(elements.seed.value),
    enhance_prompt: elements.enhance.checked,
    pipeline: elements.pipeline.value || null,
    loras,
    images: state.keyframes.map((frame) => ({
      image_b64: frame.dataUrl,
      frame_index: frame.frameIndex,
      strength: frame.strength,
    })),
  };

  if (state.primaryImage) {
    if (state.primaryImage.source === 'url') {
      payload.image_url = state.primaryImage.url;
    } else {
      payload.image_b64 = state.primaryImage.dataUrl;
    }
    payload.image_frame_index = Number(elements.primaryFrame.value || 0);
    payload.image_strength = Number(elements.primaryStrength.value || 1);
  }

  if (state.video) {
    if (state.video.source === 'url') {
      payload.video_url = state.video.url;
    } else {
      payload.video_b64 = state.video.dataUrl;
    }
    payload.video_strength = Number(elements.videoStrength.value || 1);
  }

  return payload;
}

function validatePayload(payload) {
  const errors = [];
  if (!payload.prompt.trim()) {
    errors.push('Prompt is required.');
  }
  if (payload.width % 64 !== 0 || payload.height % 64 !== 0) {
    errors.push('Width and height must be divisible by 64.');
  }
  if (payload.num_frames > MAX_NUM_FRAMES) {
    errors.push(`num_frames exceeds max ${MAX_NUM_FRAMES}.`);
  }
  if (payload.num_frames * payload.num_inference_steps > MAX_WORK_UNITS) {
    errors.push('num_frames * num_inference_steps exceeds runtime limits.');
  }
  const totalImages = (payload.image_b64 || payload.image_url ? 1 : 0) + payload.images.length;
  if (totalImages > MAX_IMAGE_CONDITIONS) {
    errors.push(`Only ${MAX_IMAGE_CONDITIONS} images allowed.`);
  }
  if (payload.pipeline === 'ic_lora') {
    if (!payload.video_b64 && !payload.video_url) {
      errors.push('ic_lora pipeline requires video input.');
    }
    if (!payload.loras.length) {
      errors.push('ic_lora pipeline requires at least one IC LoRA.');
    }
    const invalid = payload.loras.filter((lora) => {
      const entry = state.selectedLoras.get(lora.name);
      return entry && entry.type !== 'ic';
    });
    if (invalid.length) {
      errors.push('ic_lora pipeline only supports IC LoRAs.');
    }
  }
  if (payload.pipeline === 'keyframe_interp' && totalImages < 2) {
    errors.push('keyframe_interp requires at least two images.');
  }
  return errors;
}

async function handleGenerate() {
  elements.generateBtn.disabled = true;
  setStatus('Rendering in progress...');
  setOutputStatus('Rendering', true);
  elements.validationErrors.textContent = '';

  const payload = buildPayload();
  const errors = validatePayload(payload);
  if (errors.length) {
    elements.validationErrors.innerHTML = errors.map((err) => `• ${err}`).join('<br />');
    elements.generateBtn.disabled = false;
    setStatus('Validation failed.');
    setOutputStatus('Validation error');
    return;
  }

  try {
    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.detail || data.error || 'Generation failed.');
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);

    elements.previewVideo.src = url;
    elements.previewPlaceholder.style.display = 'none';

    elements.downloadBtn.href = url;
    elements.downloadBtn.hidden = false;

    addHistoryItem(url);
    setStatus('Render complete.');
    setOutputStatus('Complete', true);
  } catch (error) {
    elements.validationErrors.textContent = error.message;
    setStatus('Render failed.');
    setOutputStatus('Error');
  } finally {
    elements.generateBtn.disabled = false;
  }
}

function handleValidate() {
  const payload = buildPayload();
  const errors = validatePayload(payload);
  elements.validationErrors.innerHTML = errors.length
    ? errors.map((err) => `• ${err}`).join('<br />')
    : 'All checks passed.';
}

async function init() {
  updateMetrics();
  await syncAuthStatus();
  setStatus('Waiting for direction.');

  const lorasResponse = await fetch('/api/loras');
  const data = await lorasResponse.json();
  state.loras = data.loras || [];
  renderLoraLibrary();
  renderSelectedLoras();
  renderKeyframes();
  renderPrimaryPreview();
  renderVideoPreview();
  renderHistory();
}

// Event bindings
[elements.frames, elements.fps, elements.steps].forEach((input) => {
  input.addEventListener('input', updateMetrics);
});

if (elements.loraSearch) {
  elements.loraSearch.addEventListener('input', renderLoraLibrary);
}

elements.addKeyframeBtn.addEventListener('click', () => {
  if (state.keyframes.length + (state.primaryImage ? 1 : 0) >= MAX_IMAGE_CONDITIONS) {
    elements.validationErrors.textContent = `Max ${MAX_IMAGE_CONDITIONS} images reached.`;
    return;
  }
  elements.keyframeInput.click();
});

elements.keyframeInput.addEventListener('change', async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  const dataUrl = await readFileAsDataUrl(file);
  const id = crypto.randomUUID();
  state.keyframes.push({
    id,
    dataUrl,
    previewUrl: dataUrl,
    frameIndex: 0,
    strength: 1.0,
  });
  renderKeyframes();
  event.target.value = '';
});

elements.primaryImageFile.addEventListener('change', async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  const dataUrl = await readFileAsDataUrl(file);
  state.primaryImage = {
    source: 'file',
    dataUrl,
    previewUrl: dataUrl,
  };
  elements.primaryImageUrl.value = '';
  renderPrimaryPreview();
});

elements.primaryImageUrl.addEventListener('change', () => {
  const url = elements.primaryImageUrl.value.trim();
  if (!url) {
    state.primaryImage = null;
  } else {
    state.primaryImage = {
      source: 'url',
      url,
      previewUrl: url,
    };
  }
  elements.primaryImageFile.value = '';
  renderPrimaryPreview();
});

elements.videoFile.addEventListener('change', async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  const dataUrl = await readFileAsDataUrl(file);
  state.video = {
    source: 'file',
    dataUrl,
    previewUrl: dataUrl,
  };
  elements.videoUrl.value = '';
  renderVideoPreview();
});

elements.videoUrl.addEventListener('change', () => {
  const url = elements.videoUrl.value.trim();
  if (!url) {
    state.video = null;
  } else {
    state.video = {
      source: 'url',
      url,
      previewUrl: url,
    };
  }
  elements.videoFile.value = '';
  renderVideoPreview();
});

elements.generateBtn.addEventListener('click', handleGenerate);

elements.validateBtn.addEventListener('click', handleValidate);

elements.loginBtn.addEventListener('click', () => {
  window.location.href = `/auth/login?returnTo=${encodeURIComponent('/')}`;
});

elements.logoutBtn.addEventListener('click', async () => {
  await fetch('/api/auth/logout', { method: 'POST' });
  await syncAuthStatus();
});

init();
