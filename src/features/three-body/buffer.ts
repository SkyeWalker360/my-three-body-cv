/** Low-resolution buffer size for a viewport: about 480×270, upscaled by an integer factor. */
export function bufferSize(
  viewportWidth: number,
  viewportHeight: number,
  targetWidth = 480,
): { width: number; height: number; scale: number } {
  const scale = Math.max(1, Math.round(viewportWidth / targetWidth));
  return {
    width: Math.ceil(viewportWidth / scale),
    height: Math.ceil(viewportHeight / scale),
    scale,
  };
}
