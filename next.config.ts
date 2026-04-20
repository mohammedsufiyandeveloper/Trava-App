import type { NextConfig } from "next";

const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
})

const nextConfig: NextConfig = {
  experimental: {
    staleTimes: {
      dynamic: 30,  // Cache dynamic pages on client for 30 seconds
      static: 180,  // Cache static pages on client for 3 minutes
    },
    optimizePackageImports: [
      "@tabler/icons-react",
      "lucide-react",
      "date-fns",
      "@radix-ui/react-icons",
      "@radix-ui/react-dialog",
      "@radix-ui/react-dropdown-menu",
      "@radix-ui/react-popover",
      "@radix-ui/react-select",
      "@radix-ui/react-tooltip",
      "@radix-ui/react-tabs",
      "@radix-ui/react-slot",
      "@radix-ui/react-separator",
      "@radix-ui/react-avatar",
      "@radix-ui/react-badge",
      "@radix-ui/react-checkbox",
      "@radix-ui/react-label",
      "@dnd-kit/core",
      "@dnd-kit/sortable",
      "@dnd-kit/utilities",
      "@dnd-kit/modifiers"
    ]
  },
  serverExternalPackages: [
    '@prisma/client',
    'prisma',
    'xlsx-js-style',
    'nodemailer',
    '@aws-sdk/client-s3',
    '@aws-sdk/s3-request-presigner'
  ],

  cacheLife: {
    layout: {
      stale: 3600,
      revalidate: 86400,
      expire: 604800,
    },
    max: {
      stale: 3600,
      revalidate: 86400,
      expire: 604800,
    }
  },
  images: {
    remotePatterns: [{
      hostname: "lms-vamsi.t3.storage.dev",
      port: "",
      protocol: "https",
    }]
  },
};

export default withBundleAnalyzer(nextConfig);
