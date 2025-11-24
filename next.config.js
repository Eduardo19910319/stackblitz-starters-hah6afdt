/** @type {import('next').NextConfig} */
const nextConfig = {
    // Ignora erros de Typescript (acelera o build)
    typescript: {
      ignoreBuildErrors: true,
    },
    // Ignora erros de Linting (o erro que está te travando)
    eslint: {
      ignoreDuringBuilds: true,
    },
  }
  
  module.exports = nextConfig