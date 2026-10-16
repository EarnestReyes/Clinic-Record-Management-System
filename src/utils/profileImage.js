const maxUpload = 2 * 1024 * 1024;

export async function prepareProfileImage(file) {
  if (file.size > 20 * 1024 * 1024) throw new Error('Choose a photo up to 20 MB. Large photos are resized automatically.');
  if (!file.type.startsWith('image/') && !/\.(png|jpe?g|webp|gif|bmp|avif|heic|heif|tiff?|svg)$/i.test(file.name)) throw new Error('Choose an image from your gallery or files.');
  const url = URL.createObjectURL(file);
  try {
    const photo = await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('This browser cannot open this photo. For HEIC/HEIF or other unsupported formats, export it as JPEG or PNG and try again.'));
      image.src = url;
    });
    if (!photo.naturalWidth || !photo.naturalHeight) throw new Error('This image has no readable dimensions. Choose another photo.');
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Image processing is unavailable in this browser. Try another browser.');
    const png = /image\/(png|webp)/i.test(file.type) || /\.(png|webp)$/i.test(file.name);
    const mime = png ? 'image/png' : 'image/jpeg';
    let scale = Math.min(1, 1600 / Math.max(photo.naturalWidth, photo.naturalHeight));
    for (let attempt = 0; attempt < 7; attempt++) {
      canvas.width = Math.max(1, Math.round(photo.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(photo.naturalHeight * scale));
      if (!png) { context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height); }
      context.drawImage(photo, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise(resolve => canvas.toBlob(resolve, mime, 0.88));
      if (!blob) throw new Error('This photo could not be prepared. Try a JPEG or PNG.');
      if (blob.size <= maxUpload) return new File([blob], png ? 'profile-photo.png' : 'profile-photo.jpg', { type: mime });
      scale *= 0.75;
    }
    throw new Error('This photo is still too large. Choose a smaller photo.');
  } finally { URL.revokeObjectURL(url); }
}
