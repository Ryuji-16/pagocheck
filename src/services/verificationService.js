export async function verifyPayment(data = {}) {
  // Simulamos el tiempo de respuesta del banco
  await new Promise((resolve) => {
    setTimeout(resolve, 2000)
  })

  let bankResponse

  // =====================================================
  // SIMULACIÓN TEMPORAL DE RESPUESTAS DEL BANCO
  // =====================================================

  if (data.reference === '111111111') {
    bankResponse = {
      status: 'not-found',
      message: 'La transacción no pudo ser localizada.'
    }
  } else if (data.reference === '999999999') {
    bankResponse = {
      status: 'error',
      message: 'Error al procesar la operación.'
    }
  } else {
    // ===================================================
    // RESPUESTA SIMULADA DEL BANCO
    // ===================================================

    const bankTransaction = {
      amount: 'Bs. 150,00',
      reference: data.reference,
      date: data.date,
      bank: data.bank,
      phone: data.phone
    }

    // ===================================================
    // ADAPTAMOS LA RESPUESTA DEL BANCO
    // AL FORMATO QUE UTILIZA PAGOCHECK
    // ===================================================

    bankResponse = {
      status: 'confirmed',
      amount: bankTransaction.amount,
      reference: bankTransaction.reference,
      date: bankTransaction.date,
      bank: bankTransaction.bank,
      phone: bankTransaction.phone
    }
  }

  // =====================================================
  // RESULTADO FINAL PARA PAGOCHECK
  // =====================================================

  return {
    ...data,
    ...bankResponse
  }
}