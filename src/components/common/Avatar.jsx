import React, { useEffect, useState } from "react";
import { initials } from "../../utils/helpers.js";
import { request } from '../../services/api.js';
export default function Avatar({
  name,
  src,
  size = '',
  index = 0
}) {
  const [loaded, setLoaded] = useState(null), [failedSource, setFailedSource] = useState('');
  const protectedImage = typeof src === 'string' && src.startsWith('/api/');
  useEffect(() => {
    if (!protectedImage) return;
    const controller = new AbortController();
    let objectUrl;
    // Use the same backend base URL, credentials and CORS handling as other API calls.
    request(src.slice(4), { binary: true, signal: controller.signal }).then(blob => {
      if (controller.signal.aborted) return;
      if (!blob.type?.startsWith('image/') || !blob.size) throw new Error('Image unavailable');
      objectUrl = URL.createObjectURL(blob);
      setFailedSource(''); setLoaded({ source: src, url: objectUrl });
    }).catch(() => { if (!controller.signal.aborted) setFailedSource(src); });
    return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [src, protectedImage]);
  const imageSource = failedSource === src ? '' : protectedImage ? loaded?.source === src ? loaded.url : '' : src;
  return <span className={`avatar ${size} tone-${index % 5}`}>
    {imageSource ? <img src={imageSource} alt="" onError={() => setFailedSource(src)} /> : initials(name)}
  </span>;
}
