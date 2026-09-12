export function sampleDominantColor(
  img: HTMLImageElement
): { r: number; g: number; b: number } {
  const canvas = document.createElement("canvas");
  const size = 32;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return { r: 124, g: 58, b: 237 };
  try {
    ctx.drawImage(img, 0, 0, size, size);
    const { data } = ctx.getImageData(0, 0, size, size);
    let r = 0,
      g = 0,
      b = 0,
      n = 0;
    for (let i = 0; i < data.length; i += 16) {
      const pr = data[i];
      const pg = data[i + 1];
      const pb = data[i + 2];
      const lum = (pr * 299 + pg * 587 + pb * 114) / 1000;
      if (lum < 20 || lum > 240) continue;
      r += pr;
      g += pg;
      b += pb;
      n++;
    }
    if (!n) return { r: 124, g: 58, b: 237 };
    return { r: Math.round(r / n), g: Math.round(g / n), b: Math.round(b / n) };
  } catch {
    return { r: 124, g: 58, b: 237 };
  }
}

export function rgbCss(c: { r: number; g: number; b: number }, a = 1): string {
  return `rgba(${c.r}, ${c.g}, ${c.b}, ${a})`;
}
