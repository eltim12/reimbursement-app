// Compress image to Blob
export function compressImageToBlob(file, maxSizeMB = 2.0) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const maxSizeBytes = maxSizeMB * 1024 * 1024
        let width = img.width
        let height = img.height
        let quality = 0.85
        let maxDimension = 1920

        const compressWithSettings = () => {
          return new Promise((resolve) => {
            let targetWidth = width
            let targetHeight = height

            if (targetWidth > maxDimension || targetHeight > maxDimension) {
              if (targetWidth > targetHeight) {
                targetHeight = (targetHeight * maxDimension) / targetWidth
                targetWidth = maxDimension
              } else {
                targetWidth = (targetWidth * maxDimension) / targetHeight
                targetHeight = maxDimension
              }
            }

            const canvas = document.createElement('canvas')
            canvas.width = targetWidth
            canvas.height = targetHeight
            const ctx = canvas.getContext('2d')
            ctx.drawImage(img, 0, 0, targetWidth, targetHeight)

            canvas.toBlob(
              (blob) => {
                const sizeInBytes = blob.size
                resolve({ blob, sizeInBytes, targetWidth, targetHeight })
              },
              'image/jpeg',
              quality
            )
          })
        }

        compressWithSettings().then(async (result) => {
          let attempts = 0
          const maxAttempts = 15

          while (result.sizeInBytes > maxSizeBytes && attempts < maxAttempts) {
            attempts++

            if (quality > 0.4) {
              quality -= 0.1
            } else if (maxDimension > 800) {
              maxDimension -= 200
              quality = 0.7
            } else {
              quality -= 0.05
            }

            result = await compressWithSettings()
          }

          resolve(result.blob)
        }).catch(reject)
      }
      img.onerror = reject
      img.src = e.target.result
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// Convert blob to base64
export function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

