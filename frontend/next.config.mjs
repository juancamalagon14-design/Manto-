/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  async rewrites() {
    /**
     * El backend corre en 3003 y este servidor de Next en 3002.
     *
     * Los puertos han cambiado dos veces y conviene que quede escrito por qué.
     * Al principio el backend usaba 3000, el mismo que Next por defecto, y el
     * que arrancaba segundo no podía abrir; y como este proxy apuntaba a
     * `localhost:3000`, cuando ganaba el frontend terminaba reenviándose las
     * peticiones a sí mismo y `/v1/*` devolvía 404 en bucle. Se movió el
     * backend a 3001 — pero el frontend estaba fijado a 3001 en su propio
     * `package.json`, así que quedaron otra vez encima. Ahora son dos puertos
     * que nadie más usa, y el 3000 y el 3001 se dejan libres.
     */
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3003';
    return [
      {
        source: '/v1/:path*',
        destination: `${backendUrl}/v1/:path*`,
      },
      {
        source: '/api/v1/:path*',
        destination: `${backendUrl}/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
