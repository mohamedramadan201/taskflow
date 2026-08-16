import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: { "/api/email-connectors/apps-script/**": ["./integrations/google-apps-script/**"] },
};

export default nextConfig;
