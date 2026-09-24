import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Playwright loads these runtime assets dynamically, outside Next's static tracing.
  outputFileTracingIncludes: {
    '/api/cron/*': [
      './node_modules/playwright-core/browsers.json',
      './node_modules/playwright-core/lib/**/*',
      './node_modules/.pnpm/playwright-core@*/node_modules/playwright-core/browsers.json',
      './node_modules/.pnpm/playwright-core@*/node_modules/playwright-core/lib/**/*',
    ],
  },
};

export default nextConfig;

