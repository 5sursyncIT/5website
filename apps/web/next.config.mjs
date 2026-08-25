/** @type {import('next').NextConfig} */
const nextConfig = {
  // Les paquets de l'atelier livrent du .jsx et des CSS Modules bruts :
  // Next doit les compiler comme s'ils faisaient partie de l'application.
  transpilePackages: ['@5sync/ui', '@5sync/tokens'],

  // Sortie autonome : l'image Docker n'embarque pas node_modules entier.
  output: 'standalone',

  poweredByHeader: false,
};

export default nextConfig;
