function normalizedBaseUrl(value: string) {
  const url = new URL(value.trim());
  if (url.username || url.password) {
    throw new Error("APP_BASE_URL must not contain credentials");
  }
  if (process.env.NODE_ENV === "production") {
    const localHost = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
    if (url.protocol !== "https:" || localHost) {
      throw new Error("APP_BASE_URL must be a public HTTPS origin in production");
    }
  } else if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error("APP_BASE_URL must use HTTP or HTTPS");
  }
  return url.origin;
}

export function applicationBaseUrl() {
  const configured = process.env.APP_BASE_URL?.trim();
  if (!configured) throw new Error("APP_BASE_URL is not configured");
  return normalizedBaseUrl(configured);
}

export function applicationUrl(pathname: string) {
  const path = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return new URL(path, `${applicationBaseUrl()}/`).toString();
}
