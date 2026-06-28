import { AuthConfig } from "convex/server";

const providers: AuthConfig["providers"] = [
  {
    domain: process.env.CLERK_JWT_ISSUER_DOMAIN!,
    applicationID: "convex",
  },
];

const replayGlowzProductJwtIssuer =
  process.env.REPLAYGLOWZ_PRODUCT_JWT_ISSUER?.trim();
const replayGlowzProductJwtJwks =
  process.env.REPLAYGLOWZ_PRODUCT_JWT_JWKS_URL?.trim();
const replayGlowzProductJwtAudience =
  process.env.REPLAYGLOWZ_PRODUCT_JWT_AUDIENCE?.trim() ?? "replayglowz-convex";

if (replayGlowzProductJwtIssuer && replayGlowzProductJwtJwks) {
  providers.push({
    type: "customJwt",
    issuer: replayGlowzProductJwtIssuer,
    jwks: replayGlowzProductJwtJwks,
    applicationID: replayGlowzProductJwtAudience,
    algorithm: "RS256",
  });
}

export default {
  providers,
} satisfies AuthConfig;
