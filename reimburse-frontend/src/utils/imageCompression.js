/** Archive / receipt photos — target after compression. */
export const ARCHIVE_MAX_BYTES = 400 * 1024;

/** KTP / selfie / ID photos — clearer archive target. */
export const ID_PHOTO_MAX_BYTES = 700 * 1024;

/**
 * Compress an image File to a JPEG Blob under maxBytes.
 * @param {File} file
 * @param {number} [maxBytes]
 */
export function compressImageToBlob(file, maxBytes = ARCHIVE_MAX_BYTES) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const limit = Math.max(32 * 1024, Number(maxBytes) || ARCHIVE_MAX_BYTES);
        let quality = 0.85;
        let maxDimension = 1920;
        const width = img.width;
        const height = img.height;

        const compressWithSettings = () =>
          new Promise((res, rej) => {
            let targetWidth = width;
            let targetHeight = height;
            if (targetWidth > maxDimension || targetHeight > maxDimension) {
              if (targetWidth > targetHeight) {
                targetHeight = (targetHeight * maxDimension) / targetWidth;
                targetWidth = maxDimension;
              } else {
                targetWidth = (targetWidth * maxDimension) / targetHeight;
                targetHeight = maxDimension;
              }
            }
            const canvas = document.createElement("canvas");
            canvas.width = targetWidth;
            canvas.height = targetHeight;
            const ctx = canvas.getContext("2d");
            if (!ctx) {
              rej(new Error("Canvas unsupported"));
              return;
            }
            ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
            canvas.toBlob(
              (blob) => {
                if (!blob) {
                  rej(new Error("Compression failed"));
                  return;
                }
                res({ blob, sizeInBytes: blob.size });
              },
              "image/jpeg",
              quality,
            );
          });

        compressWithSettings()
          .then(async (result) => {
            let attempts = 0;
            while (result.sizeInBytes > limit && attempts < 20) {
              attempts += 1;
              if (quality > 0.4) quality -= 0.08;
              else if (maxDimension > 800) {
                maxDimension -= 200;
                quality = 0.72;
              } else quality -= 0.05;
              result = await compressWithSettings();
            }
            if (result.sizeInBytes > limit) {
              reject(new Error("Image is too large after compression"));
              return;
            }
            resolve(result.blob);
          })
          .catch(reject);
      };
      img.onerror = () => reject(new Error("Unable to read image"));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error("Unable to read file"));
    reader.readAsDataURL(file);
  });
}

export function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
