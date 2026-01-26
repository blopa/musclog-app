export async function resizeImage(photoUri: string, width: number = 256): Promise<string> {
  try {
    const image = new Image();
    image.src = photoUri;

    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = (err) => reject(err);
    });

    const aspectRatio = image.height / image.width;
    const newHeight = Math.round(width * aspectRatio);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = newHeight;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('Failed to get 2D context');
    }

    ctx.drawImage(image, 0, 0, width, newHeight);

    return canvas.toDataURL();
  } catch (error) {
    console.error('Failed to resize image:', error);
    throw new Error('Failed to resize image');
  }
}
