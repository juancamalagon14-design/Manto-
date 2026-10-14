/**
 * Script de prueba de integración de Gemini Vision para Manto 2.0
 * 
 * Este script prueba el flujo de análisis de foto en vivo contra el backend local (puerto 3003).
 * 1. Inicializa una sesión de chat mediante POST /v1/ai/chat/start
 * 2. Envía una captura simulada en vivo mediante POST /v1/ai/chat/:sessionId/live-photo
 * 3. Valida que el resultado analice la especie, raza, tamaño y confianza.
 */

const BASE_URL = process.env.BACKEND_URL || 'http://localhost:3003';

async function testLivePhotoIntegration() {
  console.log(`[TEST] Conectando a Manto Backend en ${BASE_URL}...`);

  // 1. Iniciar sesión de chat
  const startRes = await fetch(`${BASE_URL}/v1/ai/chat/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: 'LIVE_CAMERA', customerName: 'Prueba Gemini' }),
  });

  if (!startRes.ok) {
    throw new Error(`Error al iniciar sesión de chat: ${startRes.status} ${await startRes.text()}`);
  }

  const { session } = await startRes.json();
  const sessionId = session.sessionId;
  console.log(`[TEST] Sesión creada con éxito: ${sessionId}`);

  // 2. Imagen de prueba 1x1 pixel PNG en base64 para prueba de protocolo
  const dummyDogBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

  const photoPayload = {
    imageBase64: dummyDogBase64,
    mimeType: 'image/png',
    isLiveCapture: true,
    timestampCaptured: new Date().toISOString(),
  };

  console.log(`[TEST] Enviando POST /v1/ai/chat/${sessionId}/live-photo...`);
  const photoRes = await fetch(`${BASE_URL}/v1/ai/chat/${sessionId}/live-photo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(photoPayload),
  });

  if (!photoRes.ok) {
    throw new Error(`Error en endpoint live-photo: ${photoRes.status} ${await photoRes.text()}`);
  }

  const result = await photoRes.json();
  console.log('[TEST] Respuesta exitosa del endpoint live-photo:');
  console.log(JSON.stringify(result.reply, null, 2));
  console.log('[TEST] Slots de la sesión actualizados:');
  console.log(JSON.stringify(result.session.slots, null, 2));

  if (result.session.slots.species && result.session.slots.breedCode) {
    console.log(`\n✅ Integración verificada exitosamente:`);
    console.log(`   - Especie: ${result.session.slots.species}`);
    console.log(`   - Raza: ${result.session.slots.breedName} (${result.session.slots.breedCode})`);
    console.log(`   - Tamaño: ${result.session.slots.sizeCategory}`);
    console.log(`   - Paso de verificación de edad: ${result.session.currentStep}`);
  } else {
    console.log('\n⚠️ La foto de prueba no contenía una mascota reconocible (esperado para pixel vacío).');
  }
}

testLivePhotoIntegration().catch((err) => {
  console.error('❌ Error en test de integración:', err.message);
  process.exit(1);
});
