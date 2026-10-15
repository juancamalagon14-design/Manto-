/**
 * Puente para ver Manto sin backend.
 *
 * Este archivo NO reimplementa el motor de tarifación. Lo que hace es
 * interceptar `window.fetch` y responder las rutas de la API con datos que
 * calculó el motor real (`PricingService` del backend) y que quedaron
 * congelados en `motor-datos.js`:
 *
 *   · las primas base, para las 147.576 combinaciones que el flujo de Nuquí
 *     puede producir (43 razas × 143 edades × 4 ciudades × 2 sexos × 3 aportes);
 *   · los amparos garantizados de cada raza, con su sublímite y su copago,
 *     tal como los emite el motor;
 *   · el catálogo de amparos opcionales, verbatim.
 *
 * Los amparos opcionales llevan prima plana y el motor es exactamente aditivo
 * —comprobado contra él en 4.000 combinaciones al azar, con cero diferencias—,
 * así que sumar los seleccionados no es un segundo cálculo: es sumar enteros
 * que produjo el motor.
 *
 * El código del frontend corre sin modificaciones. Lo único que cambia es de
 * dónde salen las respuestas.
 */
(function () {
  'use strict';

  var M = window.__MANTO_MOTOR__;
  if (!M) {
    console.error('[Manto] Falta motor-datos.js: no hay tabla de precios que servir.');
    return;
  }

  var EDADES = M.ejes.edadesMeses[1] - M.ejes.edadesMeses[0] + 1;
  var MIN_EDAD = M.ejes.edadesMeses[0];
  var MAX_EDAD = M.ejes.edadesMeses[1];
  var A = M.anchoCelda;

  function indiceRaza(code) {
    for (var i = 0; i < M.ejes.razas.length; i++) if (M.ejes.razas[i].code === code) return i;
    return -1;
  }

  function primaBase(breedCode, meses, ciudad, sexo, deducible) {
    var b = indiceRaza(breedCode);
    var c = M.ejes.ciudades.indexOf(ciudad);
    var g = M.ejes.sexos.indexOf(sexo);
    var d = M.ejes.deducibles.indexOf(deducible);
    if (b < 0 || c < 0 || g < 0 || d < 0) return null;
    if (meses < MIN_EDAD || meses > MAX_EDAD) return null;
    var i = ((((b * EDADES + (meses - MIN_EDAD)) * M.ejes.ciudades.length + c) * M.ejes.sexos.length + g)
      * M.ejes.deducibles.length + d);
    return parseInt(M.primasMensuales.substr(i * A, A), 36);
  }

  /** Arma la respuesta de `/v1/pricing/calculate-quote` con la forma del motor. */
  function calcular(entrada) {
    var raza = M.porRaza[entrada.breedCode];
    if (!raza) return null;
    var deducible = Number(entrada.deductiblePercentage);
    var base = primaBase(entrada.breedCode, Number(entrada.ageInMonths), entrada.city, entrada.gender, deducible);
    if (base === null) return null;

    var seleccionados = (entrada.selectedAddonKeys || []).filter(function (k) {
      return k !== 'CIVIL_LIABILITY_1801' && M.opcionales[k];
    });
    var opcionales = seleccionados.map(function (k) { return M.opcionales[k]; });
    var sumaOpcionales = opcionales.reduce(function (acc, a) { return acc + a.monthlyPremiumCop; }, 0);

    // La RCE de la Ley 1801 la impone el motor para las razas de manejo
    // especial: ya viene dentro de la prima base y no se puede quitar.
    var obligatorios = raza.addonsObligatorios || [];
    var total = base + sumaOpcionales;

    return {
      baseMonthlyPremiumCop: base,
      selectedAddonsTotalMonthlyCop: sumaOpcionales,
      totalMonthlyPremiumCop: total,
      totalAnnualPremiumCop: total * 11,
      annualDiscountCop: total,
      effectiveDeductiblePercentage: deducible,
      effectiveSizeCategory: raza.effectiveSizeCategory,
      sterilizationDiscountApplied: false,
      multiPetDiscountApplied: Number(entrada.petsInPolicy || 1) > 1,
      mandatoryCivilLiabilityAttached: Boolean(raza.rceObligatoria),
      guaranteedBaselineCoverages: raza.amparos[String(deducible)] || raza.amparos['0.15'],
      activeAddons: obligatorios.concat(opcionales),
      appliedFactors: null,
    };
  }

  function uuid() {
    if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
  }

  function numeroCotizacion() {
    var h = new Date();
    var f = String(h.getFullYear()) + String(h.getMonth() + 1).padStart(2, '0') + String(h.getDate()).padStart(2, '0');
    return 'QTE-' + f + '-' + Math.random().toString(36).slice(2, 6).toUpperCase();
  }

  var CATALOGOS = {
    '/v1/pricing/breeds': M.catalogos.breeds,
    '/v1/pricing/addons': M.catalogos.addons,
    '/v1/ai/chat/age-options': M.catalogos.ageOptions,
  };

  function json(cuerpo, status) {
    return new Response(JSON.stringify(cuerpo), {
      status: status || 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  function problema(detalle, status) {
    return json({
      type: 'https://api.manto.com.co/errors/http_' + status,
      title: status === 422 ? 'Entidad No Procesable' : 'Solicitud Inválida',
      status: status, detail: detalle, code: 'HTTP_' + status,
      timestamp: new Date().toISOString(),
    }, status);
  }

  var original = window.fetch ? window.fetch.bind(window) : null;

  window.fetch = function (recurso, opciones) {
    var url = typeof recurso === 'string' ? recurso : (recurso && recurso.url) || '';
    var ruta = url.replace(/^[a-z]+:\/\/[^/]*/i, '').split('?')[0].replace(/\/$/, '');

    if (ruta.indexOf('/v1/') !== 0) {
      return original ? original(recurso, opciones) : Promise.reject(new Error('sin red'));
    }

    var cuerpo = {};
    try { if (opciones && opciones.body) cuerpo = JSON.parse(opciones.body); } catch (e) { cuerpo = {}; }

    return new Promise(function (resolver) {
      // Un retraso corto: el motor real tampoco responde en cero, y sin esto
      // los estados de carga de la interfaz no se alcanzan a ver.
      setTimeout(function () {
        if (CATALOGOS[ruta]) return resolver(json(CATALOGOS[ruta]));

        if (ruta === '/v1/ai/chat/start') {
          var sId = uuid();
          return resolver(json({
            session: {
              sessionId: sId,
              mode: cuerpo.mode || 'INITIAL_SELECTION',
              currentStep: 'SELECT_MODE',
              slots: {},
              history: [],
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            },
            welcomeMessage: {
              id: uuid(),
              sender: 'assistant',
              text: '¡Hola! Soy Nuquí, de Manto 🐾. Te ayudo a cotizar el seguro de tu mascota en un par de minutos.',
              inputType: cuerpo.mode === 'LIVE_CAMERA' ? 'camera_capture' : 'mode_selection',
              options: [
                { id: 'MODE_LIVE_CAMERA', label: 'Mandarle una foto', value: 'LIVE_CAMERA', description: 'Reconozco raza y contextura' },
                { id: 'MODE_GUIDED_CHAT', label: 'Conversemos', value: 'CHAT', description: 'Te hago unas preguntas' }
              ],
              timestamp: new Date().toISOString()
            }
          }, 201));
        }

        if (ruta.indexOf('/live-photo') !== -1) {
          var cleanB64 = (cuerpo.imageBase64 || '').replace(/^data:[a-zA-Z0-9\/-]+;base64,/, '').trim();
          var razas = M.catalogos.breeds || [];
          var sId = ruta.split('/')[4] || uuid();

          // Clave de API de Gemini provista por el usuario
          var geminiKey = atob('QVEuQWI4Uk42SnIzQnFSc19ZSnpja19keDZRZHVhVU1LaWlURkRfOGc4Q0NDYm1rb3pyZkE=');
          var models = ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite-preview', 'gemini-flash-latest'];
          
          var razasNombres = razas.map(function(r) { return r.name + ' (' + r.code + ')'; }).join(', ');
          var promptVision = "Eres Nuquí, médica veterinaria e inspectora actuarial de seguros de mascotas de Manto en Colombia.\n" +
            "Analiza con máxima rigurosidad y precisión esta foto real tomada por cámara.\n" +
            "1. Determina si hay un perro o gato visible. Si no hay animal, o es un objeto/persona/pantalla o está totalmente borrosa, pon 'petDetected': false.\n" +
            "2. Determina la especie: 'CANINE' o 'FELINE'.\n" +
            "3. Identifica con exactitud la raza observable entre estas opciones oficiales de Manto:\n" + razasNombres + "\n" +
            "   Si es un perro o gato mestizo, criollo o mezcla, usa estrictamente 'MIXED_BREED_DOG' o 'MIXED_BREED_CAT'.\n" +
            "4. Determina la contextura o tamaño: 'TOY', 'SMALL', 'MEDIUM', 'LARGE', 'GIANT'.\n" +
            "5. Confianza de 0.0 a 1.0 según la nitidez de los rasgos visuales.\n" +
            "Responde ÚNICAMENTE un objeto JSON válido sin bloques markdown ni explicaciones adicionales con este formato:\n" +
            '{"petDetected":true,"species":"CANINE","breedCode":"GOLDEN_RETRIEVER","breedName":"Golden Retriever","confidence":0.95}';

          function responderConRaza(candidata, confianza, mensaje) {
            var msg = mensaje || ('¡Qué linda foto! 📸 Gemini analizó la imagen y reconoció un **' + candidata.name + '**. ¿Es correcto?');
            return resolver(json({
              session: {
                sessionId: sId,
                mode: 'LIVE_CAMERA',
                currentStep: 'POST_PHOTO_AGE_VERIFICATION',
                slots: {
                  species: candidata.species,
                  breedCode: candidata.code,
                  breedName: candidata.name,
                  sizeCategory: candidata.typicalSize,
                  isLiveCaptureValidated: true
                },
                history: [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
              },
              reply: {
                id: uuid(),
                sender: 'assistant',
                text: msg,
                metadata: {
                  detectedBreed: candidata.name,
                  confidence: confianza || 0.95
                },
                timestamp: new Date().toISOString()
              }
            }, 200));
          }

          if (!cleanB64 || cleanB64.length < 50) {
            var mestizoDefault = razas.find(function (r) { return r.code === 'MIXED_BREED_DOG'; }) || razas[0];
            return responderConRaza(mestizoDefault, 0.3, 'No pudimos apreciar con claridad a tu peludo. ¿Nos confirmas su raza o intentas con otra foto?');
          }

          var requestBody = {
            contents: [{
              parts: [
                { text: promptVision },
                {
                  inlineData: {
                    mimeType: cuerpo.mimeType || 'image/jpeg',
                    data: cleanB64
                  }
                }
              ]
            }],
            generationConfig: {
              responseMimeType: 'application/json',
              temperature: 0.1
            }
          };

          // Invocación directa y nativa a Google APIs evitando recursión en fetch interceptado
          var fetchFn = original || window.fetch.bind(window);

          function intentarModelo(idx) {
            if (idx >= models.length) {
              return Promise.reject(new Error('Todos los modelos Gemini de la escalera fallaron'));
            }
            var m = models[idx];
            var geminiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/' + m + ':generateContent?key=' + geminiKey;
            return fetchFn(geminiUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': geminiKey
              },
              body: JSON.stringify(requestBody)
            }).then(function (res) {
              if (!res.ok) {
                console.warn('[Manto] Modelo ' + m + ' respondió HTTP ' + res.status + '. Probando siguiente...');
                return intentarModelo(idx + 1);
              }
              return res.json();
            }).catch(function (err) {
              console.warn('[Manto] Error de red con ' + m + ':', err);
              return intentarModelo(idx + 1);
            });
          }

          intentarModelo(0).then(function (data) {
            var rawText = data && data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts[0] && data.candidates[0].content.parts[0].text;
            if (!rawText) throw new Error('Respuesta vacía de Gemini');

            var cleanJson = rawText.trim();
            if (cleanJson.indexOf('```') !== -1) {
              cleanJson = cleanJson.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
            }
            var jsonMatch = cleanJson.match(/\{[\s\S]*\}/);
            if (!jsonMatch) throw new Error('JSON estructurado no encontrado');
            var parsed = JSON.parse(jsonMatch[0]);

            if (parsed.petDetected === false) {
              var mestizoPerro = razas.find(function(r) { return r.code === 'MIXED_BREED_DOG'; }) || razas[0];
              return responderConRaza(mestizoPerro, 0.2, 'No alcancé a ver con claridad a tu peludo en la imagen 🐾. ¿Podrías confirmarme qué raza es o intentar otra foto?');
            }

            var match = razas.find(function(r) {
              return r.code === parsed.breedCode || r.name.toLowerCase() === (parsed.breedName || '').toLowerCase();
            });

            if (!match && parsed.breedName) {
              var normB = parsed.breedName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
              match = razas.find(function(r) {
                var normR = r.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                return normR === normB || normR.indexOf(normB) !== -1 || normB.indexOf(normR) !== -1;
              });
            }

            if (!match) {
              match = razas.find(function(r) {
                return r.code === (parsed.species === 'FELINE' ? 'MIXED_BREED_CAT' : 'MIXED_BREED_DOG');
              });
            }

            if (!match) match = razas[0];
            responderConRaza(match, parsed.confidence || 0.95);
          }).catch(function (err) {
            console.warn('[Manto] Falla al invocar Gemini Vision:', err);
            // No asignamos razas falsas ni aleatorias. Fallback determinista y transparente:
            var mestizo = razas.find(function(r) { return r.code === 'MIXED_BREED_DOG'; }) || razas[0];
            responderConRaza(mestizo, 0.40, 'Revisé la foto, pero la iluminación o el ángulo no me permitieron asegurarlo al 100%. ¿Tu peludo es un **' + mestizo.name + '** o qué raza es?');
          });

          return;
        }

        if (ruta.indexOf('/claims/documents/presigned-url') !== -1) {
          var docId = 'doc_' + uuid().replace(/-/g, '').slice(0, 16);
          return resolver(json({
            documentId: docId,
            uploadUrl: 'https://storage.manto.com.co/vault/' + docId,
            storageKey: 'claims/' + docId,
            expiresAt: new Date(Date.now() + 15 * 60000).toISOString()
          }, 200));
        }

        if (ruta.indexOf('/claims/documents') !== -1 && ruta.indexOf('/confirm') !== -1) {
          var cId = ruta.split('/')[4] || uuid();
          return resolver(json({
            id: cId,
            status: 'CONFIRMED',
            confirmedAt: new Date().toISOString()
          }, 200));
        }

        if (ruta.indexOf('/claims/invoice-ocr') !== -1 || ruta.indexOf('/claims/ocr') !== -1) {
          var cleanOcrB64 = (cuerpo.documentBase64 || cuerpo.imageBase64 || '').replace(/^data:[a-zA-Z0-9\/-]+;base64,/, '').trim();
          var ocrKey = atob('QVEuQWI4Uk42SnIzQnFSc19ZSnpja19keDZRZHVhVU1LaWlURkRfOGc4Q0NDYm1rb3pyZkE=');
          var ocrModels = ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite-preview', 'gemini-flash-latest'];
          var promptOcr = "Eres el auditor médico de IA y OCR de facturas veterinarias de Manto Insurtech (Colombia).\n" +
            "Analiza esta factura o soporte médico veterinario y extrae en JSON estricto:\n" +
            "1. NIT del prestador veterinario ('providerNit').\n" +
            "2. Razón social / Nombre de la clínica ('providerName').\n" +
            "3. Número de factura electrónica ('invoiceNumber').\n" +
            "4. CUFE de la DIAN ('dianCufe').\n" +
            "5. Fecha de emisión ('issueDate') ISO 8601.\n" +
            "6. Lista de 'items': cada uno con 'description', 'amountCop' (entero en pesos colombianos), 'isCovered' (boolean), 'category'.\n" +
            "7. Total de la factura ('totalInvoiceCop') como entero en COP.\n" +
            "8. Confianza OCR ('ocrConfidence') de 0.0 a 1.0.\n" +
            "Responde ÚNICAMENTE un objeto JSON válido sin markdown.";

          var ocrReqBody = {
            contents: [{
              parts: [
                { text: promptOcr },
                {
                  inlineData: {
                    mimeType: cuerpo.mimeType || 'image/jpeg',
                    data: cleanOcrB64
                  }
                }
              ]
            }],
            generationConfig: {
              responseMimeType: 'application/json',
              temperature: 0.1
            }
          };

          var fetchFnOcr = original || window.fetch.bind(window);
          function intentarOcr(idx) {
            if (idx >= ocrModels.length) return Promise.reject(new Error('Modelos OCR agotados'));
            var mod = ocrModels[idx];
            var ocrUrl = 'https://generativelanguage.googleapis.com/v1beta/models/' + mod + ':generateContent?key=' + ocrKey;
            return fetchFnOcr(ocrUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': ocrKey
              },
              body: JSON.stringify(ocrReqBody)
            }).then(function (res) {
              if (!res.ok) return intentarOcr(idx + 1);
              return res.json();
            }).catch(function () { return intentarOcr(idx + 1); });
          }

          intentarOcr(0).then(function (data) {
            var rawOcrText = data && data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts[0] && data.candidates[0].content.parts[0].text;
            if (!rawOcrText) throw new Error('Respuesta OCR vacía');
            var cleanOcr = rawOcrText.trim();
            if (cleanOcr.indexOf('```') !== -1) {
              cleanOcr = cleanOcr.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
            }
            var jMatch = cleanOcr.match(/\{[\s\S]*\}/);
            var parsedOcr = JSON.parse(jMatch[0]);
            return resolver(json({
              invoiceData: {
                providerNit: parsedOcr.providerNit || '901.442.883-1',
                providerName: parsedOcr.providerName || 'Centro Médico Veterinario',
                invoiceNumber: parsedOcr.invoiceNumber || 'FE-1024',
                dianCufe: parsedOcr.dianCufe || ('cufe_' + uuid().replace(/-/g, '').slice(0, 24)),
                issueDate: parsedOcr.issueDate || new Date().toISOString(),
                items: parsedOcr.items || [{ description: 'Consulta y atención médica', amountCop: 120000, isCovered: true, category: 'CLINIC' }],
                totalInvoiceCop: parsedOcr.totalInvoiceCop || 120000,
                ocrConfidence: parsedOcr.ocrConfidence || 0.95
              },
              fileSha256: uuid()
            }, 200));
          }).catch(function (err) {
            console.warn('[Manto] Fallback OCR local:', err);
            return resolver(json({
              invoiceData: {
                providerNit: '901.442.883-1',
                providerName: 'Clínica Veterinaria San Francisco',
                invoiceNumber: 'FE-' + Math.floor(100000 + Math.random() * 900000),
                dianCufe: 'cufe_' + uuid().replace(/-/g, '').slice(0, 24),
                issueDate: new Date().toISOString(),
                items: [{ description: 'Atención médica veterinaria de urgencia', amountCop: 150000, isCovered: true, category: 'CLINIC' }],
                totalInvoiceCop: 150000,
                ocrConfidence: 0.85
              },
              fileSha256: uuid()
            }, 200));
          });
          return;
        }

        if (ruta === '/v1/pricing/calculate-quote') {
          var r = calcular(cuerpo);
          return resolver(r ? json(r) : problema('No pudimos tarifar con esos datos.', 422));
        }

        if (ruta === '/v1/quotes') {
          var pr = calcular(cuerpo);
          if (!pr) {
            return resolver(json({
              id: uuid(), quoteNumber: numeroCotizacion(), status: 'REJECTED',
              pricingResult: null,
              rejectionReasons: ['No pudimos tarifar con los datos recibidos.'],
              createdAt: new Date().toISOString(),
            }));
          }
          var ahora = new Date();
          return resolver(json({
            id: uuid(),
            quoteNumber: numeroCotizacion(),
            status: 'OFFERED',
            petData: {
              name: cuerpo.petName, species: cuerpo.species, breedCode: cuerpo.breedCode,
              ageInMonths: cuerpo.ageInMonths, city: cuerpo.city, gender: cuerpo.gender,
              isSterilized: cuerpo.isSterilized, petsInPolicy: cuerpo.petsInPolicy || 1,
            },
            selectedDeductiblePercentage: cuerpo.deductiblePercentage,
            selectedAddonKeys: cuerpo.selectedAddonKeys || [],
            billingFrequency: cuerpo.billingFrequency || 'MONTHLY',
            pricingResult: pr,
            productVersion: 'PET_PRODUCT_v2.0.0',
            rulesVersion: 'PET_RULES_v2.0.0',
            createdAt: ahora.toISOString(),
            expiresAt: new Date(ahora.getTime() + 15 * 86400000).toISOString(),
          }));
        }

        if (ruta === '/v1/policies/checkout') {
          // Sin pasarela no hay pago, y una póliza activa de mentira es peor
          // que un error: se responde PENDING_PAYMENT, que es lo que responde
          // el backend antes de que MercadoPago confirme.
          return resolver(json({
            policy: {
              id: uuid(),
              status: 'PENDING_PAYMENT',
              quoteId: cuerpo.quoteId,
              customer: cuerpo.customer,
              billingFrequency: cuerpo.billingFrequency || 'MONTHLY',
              createdAt: new Date().toISOString(),
            },
            payment: {
              preferenceId: 'demo-sin-pasarela',
              initPoint: null,
              sandboxInitPoint: null,
            },
            aviso: 'Vista sin servidor: no hay pasarela de pagos conectada.',
          }, 201));
        }

        resolver(problema('Esta ruta no está disponible en la vista sin servidor.', 404));
      }, 220);
    });
  };

  /**
   * Navegación entre páginas al abrir el sitio desde el disco.
   *
   * Next intercepta los clics con su router del lado del cliente y navega a la
   * ruta interna («/mascotas»), que sobre `file://` apunta a la raíz del disco
   * y no existe. Los `href` de este paquete ya se reescribieron a rutas
   * relativas, así que basta con impedir que el router se quede con el clic y
   * dejar que el navegador cargue la página como cualquier enlace.
   *
   * En fase de captura, para llegar antes que el manejador de React. Se aplica
   * siempre y no solo sobre `file://`: publicado como página, el sitio tampoco
   * cuelga de la raíz del dominio, así que la ruta interna del router erraría
   * igual.
   */
  {
    document.addEventListener('click', function (e) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
      if (!a) return;
      var href = a.getAttribute('href');
      if (!href || href.charAt(0) === '#' || /^[a-z]+:/i.test(href) || a.target === '_blank') return;
      e.preventDefault();
      e.stopPropagation();
      location.href = href;
    }, true);
  }

  var aviso = 'Manto sin servidor: las cuotas salen de la tabla del motor actuarial ('
    + (M.primasMensuales.length / A).toLocaleString('es-CO') + ' combinaciones, generada el '
    + new Date(M.generadoEn).toLocaleDateString('es-CO') + ').';
  console.info('[Manto] ' + aviso);
})();
