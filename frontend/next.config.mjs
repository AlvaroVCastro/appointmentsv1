/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.public.blob.vercel-storage.com',
        pathname: '/**',
      },
    ],
  },
  webpack: (config, { isServer }) => {
    // Suppress the critical dependency warning from Supabase realtime
    config.module.exprContextCritical = false;
    
    // Suppress Supabase-related warnings
    config.ignoreWarnings = [
      {
        module: /node_modules\/@supabase\/realtime-js/,
        message: /Critical dependency: the request of a dependency is an expression/,
      },
      {
        module: /node_modules\/@supabase\/realtime-js/,
        message: /A Node.js API is used.*which is not supported in the Edge Runtime/,
      },
      {
        module: /node_modules\/@supabase\/supabase-js/,
        message: /A Node.js API is used.*which is not supported in the Edge Runtime/,
      },
    ];
    
    return config;
  },
};

export default nextConfig;
