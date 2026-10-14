/**
 * Sin este archivo Tailwind no se ejecuta.
 *
 * El proyecto no lo tenía. Las directivas `@tailwind base/components/utilities`
 * de `globals.css` pasaban literales al CSS final y Next las descartaba, así que
 * ninguna clase de utilidad había funcionado nunca: el sitio se servía sin
 * estilos y con el logotipo a tamaño original. `tailwindcss` y `autoprefixer`
 * estaban instalados como devDependencies, pero nada los conectaba al pipeline
 * de PostCSS de Next.
 *
 * Se verifica así: `npm run build` y luego revisar `.next/static/css/*.css`.
 * Si ahí aparece el texto "@tailwind", Tailwind no corrió.
 */

/** @type {import('postcss-load-config').Config} */
const config = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};

export default config;
