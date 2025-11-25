const sharp = require('sharp');
const path = require('path');
const fs = require('fs-extra');

/**
 * Compress image to under 1MB and save to public folder
 * @param {Buffer} imageBuffer - Image buffer
 * @param {string} filename - Original filename
 * @returns {Promise<{filename: string, path: string, size: number}>}
 */
async function compressAndSaveImage(imageBuffer, filename) {
  const maxSizeBytes = 1024 * 1024; // 1MB
  const publicDir = path.join(__dirname, '..', 'public', 'images');
  
  // Ensure public/images directory exists
  await fs.ensureDir(publicDir);

  // Generate unique filename
  const ext = path.extname(filename).toLowerCase() || '.jpg';
  const uniqueFilename = `${Date.now()}_${Math.random().toString(36).substring(2, 15)}${ext}`;
  const outputPath = path.join(publicDir, uniqueFilename);

  let quality = 85;
  let width = null;
  let height = null;

  // Get image metadata
  const metadata = await sharp(imageBuffer).metadata();
  width = metadata.width;
  height = metadata.height;

  // If image is very large, resize it first
  if (width > 1920 || height > 1920) {
    const ratio = Math.min(1920 / width, 1920 / height);
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
  }

  // Try to compress with decreasing quality until under 1MB
  let attempts = 0;
  const maxAttempts = 20;
  let compressedBuffer;

  while (attempts < maxAttempts) {
    try {
      let sharpInstance = sharp(imageBuffer);

      // Resize if needed
      if (width && height && (width !== metadata.width || height !== metadata.height)) {
        sharpInstance = sharpInstance.resize(width, height, {
          fit: 'inside',
          withoutEnlargement: true
        });
      }

      // Compress to JPEG
      compressedBuffer = await sharpInstance
        .jpeg({ quality, progressive: true })
        .toBuffer();

      const sizeInBytes = compressedBuffer.length;

      if (sizeInBytes <= maxSizeBytes) {
        // Save the compressed image
        await fs.writeFile(outputPath, compressedBuffer);
        
        console.log(`Image compressed: ${(sizeInBytes / 1024).toFixed(2)}KB (quality: ${quality}, size: ${width}x${height})`);
        
        return {
          filename: uniqueFilename,
          path: outputPath,
          url: `/images/${uniqueFilename}`,
          size: sizeInBytes
        };
      }

      // Reduce quality for next attempt
      if (quality > 30) {
        quality -= 10;
      } else if (width > 400 && height > 400) {
        // Reduce dimensions if quality is already low
        width = Math.round(width * 0.9);
        height = Math.round(height * 0.9);
        quality = 70; // Reset quality when reducing size
      } else {
        quality -= 5;
      }

      attempts++;
    } catch (error) {
      console.error(`Compression attempt ${attempts} failed:`, error);
      throw error;
    }
  }

  // If still too large after all attempts, save anyway with lowest quality
  const finalBuffer = await sharp(imageBuffer)
    .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 30 })
    .toBuffer();

  await fs.writeFile(outputPath, finalBuffer);
  
  console.warn(`Image saved at minimum quality: ${(finalBuffer.length / 1024).toFixed(2)}KB`);
  
  return {
    filename: uniqueFilename,
    path: outputPath,
    url: `/images/${uniqueFilename}`,
    size: finalBuffer.length
  };
}

/**
 * Delete image file
 * @param {string} filenameOrUrl - Image filename or URL path
 */
async function deleteImage(filenameOrUrl) {
  try {
    if (!filenameOrUrl) {
      return;
    }

    // Extract filename from URL if it's a full path
    // Handles both "/images/filename.jpg" and "filename.jpg"
    let filename = filenameOrUrl;
    if (filenameOrUrl.includes('/')) {
      filename = path.basename(filenameOrUrl);
    }

    // Remove query parameters if any
    filename = filename.split('?')[0];

    if (!filename || filename === '.' || filename === '..') {
      console.warn(`Invalid filename: ${filenameOrUrl}`);
      return;
    }

    const imagePath = path.join(__dirname, '..', 'public', 'images', filename);
    
    // Check if file exists before trying to delete
    const exists = await fs.pathExists(imagePath);
    if (exists) {
      await fs.remove(imagePath);
      console.log(`Deleted image: ${filename}`);
    } else {
      console.warn(`Image file not found: ${filename} (from: ${filenameOrUrl})`);
    }
  } catch (error) {
    console.error(`Error deleting image ${filenameOrUrl}:`, error);
    // Don't throw - file might not exist or already deleted
  }
}

module.exports = {
  compressAndSaveImage,
  deleteImage
};

