import { AuthConfig } from "convex/server";

const providers: AuthConfig["providers"] = [
  {
    domain: process.env.CLERK_JWT_ISSUER_DOMAIN!,
    applicationID: "convex",
  },
];

const replayGlowsProductJwtIssuer =
  process.env.REPLAYGLOWS_PRODUCT_JWT_ISSUER?.trim();
const replayGlowsProductJwtJwks =
  process.env.REPLAYGLOWS_PRODUCT_JWT_JWKS_URL?.trim();
const replayGlowsProductJwtAudience =
  process.env.REPLAYGLOWS_PRODUCT_JWT_AUDIENCE?.trim() ?? "replayglows-convex";

if (replayGlowsProductJwtIssuer && replayGlowsProductJwtJwks) {
  providers.push({
    type: "customJwt",
    issuer: replayGlowsProductJwtIssuer,
    jwks: replayGlowsProductJwtJwks,
    applicationID: replayGlowsProductJwtAudience,
    algorithm: "RS256",
  });
}

export default {
  providers,
} satisfies AuthConfig;
