'use client';

import { useEffect, useMemo, useState } from 'react';

type CropperOptions = {
  title?: string;
  aspect?: number;
};

type CropperRequest = {
  file: File;
  title: string;
  aspect: number;
  resolve: (value: File | null) => void;
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = src;
  });

const cropImageFile = async (
  file: File,
  { aspect, zoom, offsetX, offsetY }: { aspect: number; zoom: number; offsetX: number; offsetY: number }
) => {
  const sourceUrl = URL.createObjectURL(file);
  try {
    const image = await loadImage(sourceUrl);
    const imageW = image.naturalWidth || image.width;
    const imageH = image.naturalHeight || image.height;
    const viewportW = 960;
    const viewportH = Math.round(viewportW / aspect);
    const baseScale = Math.max(viewportW / imageW, viewportH / imageH);
    const scale = baseScale * zoom;
    const displayW = imageW * scale;
    const displayH = imageH * scale;
    const left = (viewportW - displayW) / 2 + offsetX;
    const top = (viewportH - displayH) / 2 + offsetY;

    const srcX = clamp((-left) / scale, 0, imageW);
    const srcY = clamp((-top) / scale, 0, imageH);
    const srcW = clamp(viewportW / scale, 1, imageW - srcX);
    const srcH = clamp(viewportH / scale, 1, imageH - srcY);

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(srcW));
    canvas.height = Math.max(1, Math.round(srcH));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas is not available');

    ctx.drawImage(image, srcX, srcY, srcW, srcH, 0, 0, canvas.width, canvas.height);
    const targetType = /image\/(png|webp|jpeg|jpg)/i.test(file.type) ? file.type : 'image/jpeg';
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, targetType, 0.92)
    );
    if (!blob) throw new Error('Failed to crop image');

    const extension = targetType.includes('png')
      ? 'png'
      : targetType.includes('webp')
        ? 'webp'
        : 'jpg';
    const baseName = (file.name || 'image').replace(/\.[^.]+$/, '');
    return new File([blob], `${baseName}-cropped.${extension}`, {
      type: targetType,
      lastModified: Date.now(),
    });
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
};

export const useImageCropper = () => {
  const [request, setRequest] = useState<CropperRequest | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);

  const previewUrl = useMemo(
    () => (request ? URL.createObjectURL(request.file) : ''),
    [request]
  );

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const resetControls = () => {
    setZoom(1);
    setOffsetX(0);
    setOffsetY(0);
  };

  const closeWith = (value: File | null) => {
    if (!request) return;
    request.resolve(value);
    setRequest(null);
    resetControls();
  };

  const openImageCropper = (file: File, options: CropperOptions = {}) =>
    new Promise<File | null>((resolve) => {
      setRequest({
        file,
        title: options.title || 'Обрезать изображение',
        aspect: options.aspect && options.aspect > 0 ? options.aspect : 1,
        resolve,
      });
      resetControls();
    });

  const applyCrop = async () => {
    if (!request) return;
    try {
      const cropped = await cropImageFile(request.file, {
        aspect: request.aspect,
        zoom,
        offsetX,
        offsetY,
      });
      closeWith(cropped);
    } catch {
      closeWith(request.file);
    }
  };

  const cropperModal = request ? (
    <div className="image-cropper-backdrop" role="presentation" onClick={() => closeWith(null)}>
      <div
        className="image-cropper-modal"
        role="dialog"
        aria-modal="true"
        aria-label={request.title}
        onClick={(event) => event.stopPropagation()}
      >
        <h3 className="image-cropper-title">{request.title}</h3>
        <div
          className="image-cropper-stage"
          style={{ aspectRatio: `${request.aspect}` }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt="crop-preview"
            className="image-cropper-preview"
            style={{ transform: `translate(${offsetX}px, ${offsetY}px) scale(${zoom})` }}
          />
        </div>
        <div className="image-cropper-controls">
          <label className="field">
            <span>Масштаб</span>
            <input
              type="range"
              min={1}
              max={3}
              step={0.01}
              value={zoom}
              onChange={(event) => setZoom(Number(event.target.value))}
            />
          </label>
          <label className="field">
            <span>Смещение по X</span>
            <input
              type="range"
              min={-220}
              max={220}
              step={1}
              value={offsetX}
              onChange={(event) => setOffsetX(Number(event.target.value))}
            />
          </label>
          <label className="field">
            <span>Смещение по Y</span>
            <input
              type="range"
              min={-220}
              max={220}
              step={1}
              value={offsetY}
              onChange={(event) => setOffsetY(Number(event.target.value))}
            />
          </label>
        </div>
        <div className="image-cropper-actions">
          <button type="button" className="button secondary" onClick={() => closeWith(null)}>
            Отмена
          </button>
          <button type="button" className="button secondary" onClick={() => closeWith(request.file)}>
            Без обрезки
          </button>
          <button type="button" className="button" onClick={applyCrop}>
            Применить
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return { openImageCropper, cropperModal };
};
