import type { MetadataRoute } from "next";
import { absoluteSiteUrl } from "../lib/public-museum";

const protectedPaths = ["/api/", "/admin", "/account", "/museum", "/memories", "/learning", "/agents", "/studio"];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: protectedPaths },
      { userAgent: "OAI-SearchBot", allow: ["/", "/about", "/people/", "/periods/", "/halls/"], disallow: protectedPaths },
    ],
    sitemap: absoluteSiteUrl("/sitemap.xml"),
    host: absoluteSiteUrl("/"),
  };
}
