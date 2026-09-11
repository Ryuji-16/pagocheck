/**
 * Redimensiona y comprime una imagen en el navegador mediante HTML Canvas.
 * Genera un Data URL ligero (JPEG) de ~25-45 KB ideal para almacenamiento
 * en base de datos sin sobrecargar red ni memoria.
 *
 * @param {File|Blob} file - Archivo de imagen original
 * @param {number} [maxWidth=900] - Ancho máximo permitido
 * @param {number} [maxHeight=900] - Alto máximo permitido
 * @param {number} [quality=0.75] - Calidad JPEG (0.1 a 1.0)
 * @returns {Promise<string>} Data URL comprimido en formato base64
 */
export function compressImageToDataUrl(file, maxWidth = 900, maxHeight = 900, quality = 0.75) {
  return new Promise((resolve) => {
    if (!file || !(file instanceof Blob)) {
      resolve('')
      return
    }

    const reader = new FileReader()

    reader.onerror = () => resolve('')

    reader.onload = (event) => {
      const img = new Image()

      img.onerror = () => resolve('')

      img.onload = () => {
        let width = img.width
        let height = img.height

        // Escalar proporcionalmente si excede los límites
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height)
          width = Math.round(width * ratio)
          height = Math.round(height * ratio)
        }

        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height

        const ctx = canvas.getContext('2d')
        if (!ctx) {
          resolve(event.target.result || '')
          return
        }

        // Fondo blanco para evitar fondos negros en PNG transparentes al convertir a JPEG
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, width, height)
        ctx.drawImage(img, 0, 0, width, height)

        try {
          const compressedDataUrl = canvas.toDataURL('image/jpeg', quality)
          resolve(compressedDataUrl)
        } catch {
          resolve(event.target.result || '')
        }
      }

      img.src = event.target.result
    }

    reader.readAsDataURL(file)
  })
}
