export async function extractPaymentData(file) {
  // Simulamos el tiempo que tomaría analizar la imagen
  await new Promise((resolve) => {
    setTimeout(resolve, 1500)
  })

  // Por ahora verificamos que exista un archivo
  if (!file) {
    throw new Error('No se recibió ningún comprobante.')
  }

  /*
   * SIMULACIÓN TEMPORAL DEL OCR
   *
   * Más adelante aquí conectaremos un OCR real
   * que analizará la imagen del comprobante.
   */

  return {
    reference: '123456789',
    date: '10/08/2026',
    bank: 'Banesco',
    amount: 'Bs. 150,00',
    phone: null,
  }
}