import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf-parse bundles pdfjs-dist, which loads its worker via a relative chunk
  // path that Turbopack/webpack can't resolve once bundled. Keeping it
  // external makes Next require() it straight from node_modules at runtime.
  //
  // @napi-rs/canvas (dependência do pdf-parse, usada só por getImage/
  // getScreenshot) é um binário nativo por plataforma — deixá-lo de fora do
  // bundle evita que o rastreamento de arquivos do Vercel tente empacotar/
  // resolver estaticamente um require condicional por plataforma, que é
  // exatamente o tipo de coisa que trava a função em produção mesmo quando
  // só se usa getText() (que nunca toca canvas).
  serverExternalPackages: ["pdf-parse", "@napi-rs/canvas"],
};

export default nextConfig;
