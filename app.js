const allowedTypes = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
  'image/bmp'
];

const fileInput = document.getElementById('fileInput');
const dropZone = document.getElementById('dropZone');
const fileList = document.getElementById('fileList');
const resultList = document.getElementById('resultList');
const previewCanvas = document.getElementById('previewCanvas');
const applyCropButton = document.getElementById('applyCropButton');
const resetCropButton = document.getElementById('resetCropButton');
const compressAllButton = document.getElementById('compressAllButton');
const saveAllButton = document.getElementById('saveAllButton');
const outputFormat = document.getElementById('outputFormat');
const qualityRange = document.getElementById('qualityRange');
const qualityValue = document.getElementById('qualityValue');

const ctx = previewCanvas.getContext('2d');

let selectedImages = [];
let activeIndex = -1;
let cropSelection = null;
let isSelecting = false;
let dragStart = null;
let currentDisplayScale = 1;
let compressedResults = [];

function formatBytes(bytes) {
  return bytes < 1024
    ? `${bytes} B`
    : bytes < 1024 * 1024
    ? `${(bytes / 1024).toFixed(1)} KB`
    : `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function updateQualityLabel() {
  qualityValue.textContent = Number(qualityRange.value).toFixed(2);
}

function setActiveFile(index) {
  activeIndex = index;
  renderFileList();
  renderPreview();
  updateActionButtons();
}

function updateActionButtons() {
  const hasSelection = selectedImages.length > 0;
  const activeExists = activeIndex >= 0;
  compressAllButton.disabled = !hasSelection;
  saveAllButton.disabled = compressedResults.length === 0 || !('showDirectoryPicker' in window);
  applyCropButton.disabled = !activeExists;
  resetCropButton.disabled = !activeExists;
}

function loadFiles(files) {
  const incoming = Array.from(files).filter((file) => allowedTypes.includes(file.type));
  if (!incoming.length) {
    alert('Please load one or more supported image files (PNG, JPEG, WebP, GIF, BMP).');
    return;
  }

  incoming.forEach((file) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const image = new Image();
      image.onload = () => {
        selectedImages.push({
          file,
          originalUrl: event.target.result,
          displayUrl: event.target.result,
          name: file.name,
          type: file.type,
          size: file.size,
          width: image.naturalWidth,
          height: image.naturalHeight,
          cropRect: null,
          image
        });
        if (activeIndex === -1) {
          activeIndex = 0;
        }
        renderFileList();
        renderPreview();
        updateActionButtons();
      };
      image.src = event.target.result;
    };
    reader.readAsDataURL(file);
  });
}

function renderFileList() {
  fileList.innerHTML = '';
  selectedImages.forEach((item, index) => {
    const card = document.createElement('div');
    card.className = 'file-card';
    if (index === activeIndex) {
      card.classList.add('selected');
    }

    const preview = document.createElement('img');
    preview.src = item.displayUrl;
    preview.alt = item.name;

    const meta = document.createElement('div');
    meta.className = 'file-meta';
    meta.innerHTML = `<strong>${item.name}</strong>
      <span>${item.width} × ${item.height}</span>
      <span>${formatBytes(item.size)} • ${item.type}</span>`;

    const actions = document.createElement('div');
    const cropButton = document.createElement('button');
    cropButton.textContent = 'Select';
    cropButton.onclick = () => setActiveFile(index);
    actions.appendChild(cropButton);

    card.appendChild(preview);
    card.appendChild(meta);
    card.appendChild(actions);
    fileList.appendChild(card);
  });
}

function getActiveImage() {
  if (activeIndex < 0 || activeIndex >= selectedImages.length) {
    return null;
  }
  return selectedImages[activeIndex];
}

function renderPreview() {
  const active = getActiveImage();
  if (!active) {
    ctx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
    return;
  }

  const image = new Image();
  image.onload = () => {
    const maxWidth = 820;
    const maxHeight = 520;
    const ratio = Math.min(maxWidth / image.naturalWidth, maxHeight / image.naturalHeight, 1);
    const canvasWidth = Math.round(image.naturalWidth * ratio);
    const canvasHeight = Math.round(image.naturalHeight * ratio);

    previewCanvas.width = canvasWidth;
    previewCanvas.height = canvasHeight;
    currentDisplayScale = ratio;
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    ctx.drawImage(image, 0, 0, canvasWidth, canvasHeight);

    if (active.cropRect) {
      drawCropRect(active.cropRect);
    }
  };
  image.src = active.displayUrl;
}

function drawCropRect(rect) {
  if (!rect) {
    return;
  }

  ctx.save();
  ctx.strokeStyle = '#14b8a6';
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 4]);
  ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
  ctx.fillStyle = 'rgba(20, 184, 166, 0.16)';
  ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
  ctx.restore();
}

function normalizeSelection(selection) {
  const x = Math.min(selection.x0, selection.x1);
  const y = Math.min(selection.y0, selection.y1);
  const width = Math.abs(selection.x1 - selection.x0);
  const height = Math.abs(selection.y1 - selection.y0);
  return { x, y, width, height };
}

function startSelection(event) {
  const active = getActiveImage();
  if (!active) {
    return;
  }
  const rect = previewCanvas.getBoundingClientRect();
  dragStart = {
    x: clamp(event.clientX - rect.left, 0, previewCanvas.width),
    y: clamp(event.clientY - rect.top, 0, previewCanvas.height)
  };
  isSelecting = true;
  cropSelection = { x0: dragStart.x, y0: dragStart.y, x1: dragStart.x, y1: dragStart.y };
}

function updateSelection(event) {
  if (!isSelecting) {
    return;
  }
  const rect = previewCanvas.getBoundingClientRect();
  const x = clamp(event.clientX - rect.left, 0, previewCanvas.width);
  const y = clamp(event.clientY - rect.top, 0, previewCanvas.height);
  cropSelection.x1 = x;
  cropSelection.y1 = y;
  const normalized = normalizeSelection(cropSelection);
  const active = getActiveImage();
  const image = new Image();
  image.onload = () => {
    ctx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
    ctx.drawImage(image, 0, 0, previewCanvas.width, previewCanvas.height);
    drawCropRect(normalized);
  };
  image.src = active.displayUrl;
}

function finishSelection() {
  if (!isSelecting) {
    return;
  }
  isSelecting = false;
  const normalized = normalizeSelection(cropSelection);
  const active = getActiveImage();
  active.cropRect = normalized;
  renderPreview();
}

function applyCrop() {
  const active = getActiveImage();
  if (!active || !active.cropRect) {
    alert('Please select a crop region on the preview first.');
    return;
  }

  const sourceImage = new Image();
  sourceImage.onload = () => {
    const actualX = Math.round(active.cropRect.x / currentDisplayScale);
    const actualY = Math.round(active.cropRect.y / currentDisplayScale);
    const actualWidth = Math.round(active.cropRect.width / currentDisplayScale);
    const actualHeight = Math.round(active.cropRect.height / currentDisplayScale);

    const cropCanvas = document.createElement('canvas');
    cropCanvas.width = Math.max(actualWidth, 1);
    cropCanvas.height = Math.max(actualHeight, 1);
    const cropCtx = cropCanvas.getContext('2d');
    cropCtx.drawImage(
      sourceImage,
      actualX,
      actualY,
      actualWidth,
      actualHeight,
      0,
      0,
      cropCanvas.width,
      cropCanvas.height
    );

    active.displayUrl = cropCanvas.toDataURL(active.type);
    active.width = actualWidth;
    active.height = actualHeight;
    active.cropRect = null;
    renderFileList();
    renderPreview();
  };
  sourceImage.src = active.displayUrl;
}

function resetCrop() {
  const active = getActiveImage();
  if (!active) {
    return;
  }
  active.displayUrl = active.originalUrl;
  active.cropRect = null;
  renderFileList();
  renderPreview();
}

function compressAll() {
  if (!selectedImages.length) {
    return;
  }
  compressedResults = [];
  const outputType = outputFormat.value;
  const quality = Number(qualityRange.value);
  const tasks = selectedImages.map((item) => createCompressedBlob(item, outputType, quality));

  Promise.all(tasks)
    .then((results) => {
      compressedResults = results;
      renderResults();
      if ('showDirectoryPicker' in window) {
        saveAllButton.disabled = false;
      }
      alert('Compression finished. Scroll to the results section to download files.');
    })
    .catch((error) => {
      console.error(error);
      alert('Compression failed for one or more images. See the console for details.');
    });
}

function createCompressedBlob(item, format, quality) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext('2d');
      context.drawImage(image, 0, 0, canvas.width, canvas.height);

      const targetType = format === 'keep' ? item.type : format;
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Unable to create compressed image blob'));
            return;
          }
          const nameBase = item.name.replace(/\.[^/.]+$/, '');
          const extension = targetType === 'image/png' ? 'png' : targetType === 'image/webp' ? 'webp' : 'jpg';
          resolve({
            name: `${nameBase}-compressed.${extension}`,
            type: targetType,
            blob,
            originalName: item.name,
            originalSize: item.size,
            compressedSize: blob.size
          });
        },
        targetType,
        targetType === 'image/png' ? undefined : quality
      );
    };
    image.onerror = reject;
    image.src = item.displayUrl;
  });
}

function renderResults() {
  resultList.innerHTML = '';
  if (!compressedResults.length) {
    resultList.innerHTML = '<p>No compressed images yet.</p>';
    return;
  }

  compressedResults.forEach((result) => {
    const card = document.createElement('div');
    card.className = 'result-card';

    const preview = document.createElement('img');
    preview.src = URL.createObjectURL(result.blob);
    preview.alt = result.name;

    const meta = document.createElement('div');
    meta.className = 'result-meta';
    meta.innerHTML = `<strong>${result.name}</strong>
      <span>Original: ${formatBytes(result.originalSize)}</span>
      <span>Compressed: ${formatBytes(result.compressedSize)}</span>
      <span>Savings: ${formatBytes(result.originalSize - result.compressedSize)}</span>`;

    const actions = document.createElement('div');
    const downloadButton = document.createElement('button');
    downloadButton.textContent = 'Download';
    downloadButton.onclick = () => downloadBlob(result.blob, result.name);
    actions.appendChild(downloadButton);

    card.appendChild(preview);
    card.appendChild(meta);
    card.appendChild(actions);
    resultList.appendChild(card);
  });
}

function downloadBlob(blob, filename) {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(link.href);
}

async function saveAllToFolder() {
  if (!compressedResults.length) {
    return;
  }
  if (!('showDirectoryPicker' in window)) {
    alert('Saving to a local folder is not supported in this browser. Use the download buttons instead.');
    return;
  }
  try {
    const handle = await window.showDirectoryPicker();
    for (const result of compressedResults) {
      const fileHandle = await handle.getFileHandle(result.name, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(result.blob);
      await writable.close();
    }
    alert('All compressed files were saved to the selected folder.');
  } catch (error) {
    console.warn('Folder save cancelled or failed', error);
  }
}

fileInput.addEventListener('change', (event) => {
  loadFiles(event.target.files);
  event.target.value = null;
});

dropZone.addEventListener('dragover', (event) => {
  event.preventDefault();
  dropZone.classList.add('drag-over');
});

dropZone.addEventListener('dragleave', () => {
  dropZone.classList.remove('drag-over');
});

dropZone.addEventListener('drop', (event) => {
  event.preventDefault();
  dropZone.classList.remove('drag-over');
  loadFiles(event.dataTransfer.files);
});

previewCanvas.addEventListener('mousedown', (event) => {
  if (activeIndex < 0) return;
  startSelection(event);
});

window.addEventListener('mousemove', (event) => {
  if (isSelecting) {
    updateSelection(event);
  }
});

window.addEventListener('mouseup', () => {
  if (isSelecting) {
    finishSelection();
  }
});

applyCropButton.addEventListener('click', applyCrop);
resetCropButton.addEventListener('click', resetCrop);
compressAllButton.addEventListener('click', compressAll);
saveAllButton.addEventListener('click', saveAllToFolder);
qualityRange.addEventListener('input', () => {
  updateQualityLabel();
});

window.addEventListener('DOMContentLoaded', () => {
  updateQualityLabel();
  renderFileList();
  renderResults();
  updateActionButtons();
});
