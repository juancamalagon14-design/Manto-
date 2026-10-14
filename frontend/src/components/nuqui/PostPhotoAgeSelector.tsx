/**
 * ELIMINADO — este archivo se puede borrar.
 *
 * Quedó sin ningún consumidor cuando Nuquí pasó a ser el único cotizador.
 * `ModularCoverageSelector` era además lo único que mantenía viva la copia
 * local del catálogo de coberturas en `lib/constants.ts`, la que prometía
 * $1.500.000 en medicamentos cuando la póliza otorga $600.000.
 *
 * Se deja vacío en vez de borrarse porque las herramientas remotas no pueden
 * eliminar archivos en esta máquina (limitación de la actualización de Windows
 * del 8 de septiembre). Bórralo a mano:
 *
 *   Remove-Item "E:\Manto 2.0\frontend\src\components\pricing" -Recurse -Force
 *   Remove-Item "E:\Manto 2.0\frontend\src\components\nuqui\PostPhotoAgeSelector.tsx" -Force
 */
export {};
