(function () {
  const CLERK_SCRIPT_VERSION = "6";
  let state = {
    configured: false,
    loading: null,
    publishableKey: "",
    signInUrl: "/sign-in",
    signUpUrl: "/sign-up",
    accountCenterUrl: "",
  };

  function decodeDomainFromPublishableKey(publishableKey) {
    try {
      const encoded = publishableKey.split("_")[2] || "";
      if (!encoded) return "";
      const base64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
      const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
      const decoded = atob(padded);
      return decoded.endsWith("$") ? decoded.slice(0, -1) : decoded;
    } catch (_) {
      return "";
    }
  }

  function loadScriptOnce(id, src, extraAttributes = {}) {
    return new Promise((resolve, reject) => {
      const existing = document.getElementById(id);
      if (existing) {
        if (existing.dataset.loaded === "true") {
          resolve();
          return;
        }
        existing.addEventListener("load", () => resolve(), { once: true });
        existing.addEventListener("error", () => reject(new Error(`failed_to_load_${id}`)), {
          once: true,
        });
        return;
      }

      const script = document.createElement("script");
      script.id = id;
      script.src = src;
      script.defer = true;
      script.crossOrigin = "anonymous";
      script.type = "text/javascript";
      for (const [key, value] of Object.entries(extraAttributes)) {
        script.setAttribute(key, value);
      }
      script.onload = () => {
        script.dataset.loaded = "true";
        resolve();
      };
      script.onerror = () => reject(new Error(`failed_to_load_${id}`));
      document.head.appendChild(script);
    });
  }

  function sanitizeConfig(config) {
    const value = config && typeof config === "object" ? config : {};
    return {
      publishableKey:
        typeof value.publishableKey === "string" ? value.publishableKey.trim() : "",
      signInUrl: typeof value.signInUrl === "string" && value.signInUrl.trim()
        ? value.signInUrl.trim()
        : "/sign-in",
      signUpUrl: typeof value.signUpUrl === "string" && value.signUpUrl.trim()
        ? value.signUpUrl.trim()
        : "/sign-up",
      accountCenterUrl:
        typeof value.accountCenterUrl === "string" ? value.accountCenterUrl.trim() : "",
    };
  }

  function toPublicUser(user) {
    if (!user) return null;
    const primaryEmail = user.primaryEmailAddress?.emailAddress || "";
    const firstName = typeof user.firstName === "string" ? user.firstName : "";
    const lastName = typeof user.lastName === "string" ? user.lastName : "";
    const displayName = `${firstName} ${lastName}`.trim();
    return {
      id: typeof user.id === "string" ? user.id : "",
      email: primaryEmail,
      displayName: displayName || primaryEmail || null,
      imageUrl: typeof user.imageUrl === "string" && user.imageUrl ? user.imageUrl : null,
    };
  }

  async function ensureClerkLoaded(config) {
    const nextConfig = sanitizeConfig(config);
    if (!nextConfig.publishableKey) {
      state = { ...state, configured: false };
      return { configured: false, isSignedIn: false, user: null };
    }

    state = { ...state, ...nextConfig, configured: true };
    if (window.Clerk && window.Clerk.loaded) {
      return {
        configured: true,
        isSignedIn: Boolean(window.Clerk.isSignedIn),
        user: toPublicUser(window.Clerk.user),
      };
    }

    if (!state.loading) {
      state.loading = (async () => {
        const frontendApiDomain = decodeDomainFromPublishableKey(state.publishableKey);
        if (!frontendApiDomain) {
          throw new Error("invalid_publishable_key");
        }

        const base = `https://${frontendApiDomain}/npm`;
        await loadScriptOnce(
          "replayglowz-clerk-ui",
          `${base}/@clerk/ui@1/dist/ui.browser.js`,
        );
        await loadScriptOnce(
          "replayglowz-clerk-js",
          `${base}/@clerk/clerk-js@${CLERK_SCRIPT_VERSION}/dist/clerk.browser.js`,
          { "data-clerk-publishable-key": state.publishableKey },
        );

        if (!window.Clerk || typeof window.Clerk.load !== "function") {
          throw new Error("clerk_not_available");
        }

        await window.Clerk.load({
          ui: { ClerkUI: window.__internal_ClerkUICtor },
          signInUrl: state.signInUrl,
          signUpUrl: state.signUpUrl,
        });
      })();
    }

    try {
      await state.loading;
      return {
        configured: true,
        isSignedIn: Boolean(window.Clerk?.isSignedIn),
        user: toPublicUser(window.Clerk?.user),
      };
    } catch (error) {
      state.loading = null;
      throw error;
    }
  }

  async function getToken(options) {
    const clerk = window.Clerk;
    const session = clerk?.session;
    if (!session || typeof session.getToken !== "function") {
      return "";
    }
    const token = await session.getToken(options || {});
    return typeof token === "string" ? token : "";
  }

  function currentSnapshot() {
    return JSON.stringify({
      configured: state.configured,
      isSignedIn: Boolean(window.Clerk?.isSignedIn),
      user: toPublicUser(window.Clerk?.user),
    });
  }

  window.replayGlowzClerkBridge = {
    async load(configJson) {
      const config = configJson ? JSON.parse(configJson) : {};
      await ensureClerkLoaded(config);
      return currentSnapshot();
    },

    async isSignedIn() {
      return Boolean(window.Clerk?.isSignedIn);
    },

    async getUser() {
      return JSON.stringify(toPublicUser(window.Clerk?.user));
    },

    async openSignIn(redirectTo) {
      const target = typeof redirectTo === "string" && redirectTo ? redirectTo : "/";
      const clerk = window.Clerk;
      if (clerk && typeof clerk.openSignIn === "function") {
        clerk.openSignIn({
          signInFallbackRedirectUrl: target,
          signUpFallbackRedirectUrl: target,
        });
        return;
      }
      window.location.assign(state.signInUrl || "/sign-in");
    },

    async openUserProfile() {
      const clerk = window.Clerk;
      if (clerk && typeof clerk.openUserProfile === "function") {
        clerk.openUserProfile();
        return;
      }
      if (state.accountCenterUrl) {
        window.location.assign(state.accountCenterUrl);
      }
    },

    async signOut(redirectTo) {
      const target = typeof redirectTo === "string" && redirectTo ? redirectTo : state.signInUrl;
      const clerk = window.Clerk;
      if (clerk && typeof clerk.signOut === "function") {
        await clerk.signOut({ redirectUrl: target });
        return;
      }
      if (target) {
        window.location.assign(target);
      }
    },

    async getConvexToken(template) {
      const name = typeof template === "string" && template ? template : "convex";
      return getToken({ template: name, skipCache: false });
    },

    async getSessionToken() {
      return getToken({ skipCache: false });
    },
  };
})();
