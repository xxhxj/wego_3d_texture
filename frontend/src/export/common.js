export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function downloadDataUrl(url, filename) {
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
}

export function longEdgeSize(longEdge, aspect) {
  const safeAspect = aspect > 0 ? aspect : 1;
  if (safeAspect >= 1) {
    return {
      width: Math.round(longEdge),
      height: Math.max(2, Math.round(longEdge / safeAspect)),
    };
  }
  return {
    width: Math.max(2, Math.round(longEdge * safeAspect)),
    height: Math.round(longEdge),
  };
}
