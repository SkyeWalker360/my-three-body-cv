/**
 * Low-resolution buffer size for a viewport: about 480×270, upscaled by an integer factor.
 * The scale grows until the buffer fits in maxPixels, so tall phones don't get a huge buffer.
 */
export function bufferSize(
  viewportWidth: number,
  viewportHeight: number,
  targetWidth = 480,
  maxPixels = Infinity,
): { width: number; height: number; scale: number } {
  let scale = Math.max(1, Math.round(viewportWidth / targetWidth));
  while (Math.ceil(viewportWidth / scale) * Math.ceil(viewportHeight / scale) > maxPixels) scale++;
  return {
    width: Math.ceil(viewportWidth / scale),
    height: Math.ceil(viewportHeight / scale),
    scale,
  };
}
