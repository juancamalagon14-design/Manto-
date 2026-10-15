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
