import type { MetadataRoute } from "next";
import { absoluteSiteUrl, publicCharacterIds, publicHallIds, publicPeriodIds } from "../lib/public-museum";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date("2026-07-29T00:00:00.000Z");
  const fixed = [
    { path: "/", priority: 1, changeFrequency: "weekly" as const },
    { path: "/about", priority: 0.8, changeFrequency: "monthly" as const },
    { path: "/people", priority: 0.9, changeFrequency: "weekly" as const },
    { path: "/periods", priority: 0.9, changeFrequency: "weekly" as const },
  ];
  return [
    ...fixed.map((item) => ({ url: absoluteSiteUrl(item.path), lastModified, changeFrequency: item.changeFrequency, priority: item.priority })),
    ...publicPeriodIds().map((id) => ({ url: absoluteSiteUrl(`/periods/${id}`), lastModified, changeFrequency: "monthly" as const, priority: 0.8 })),
    ...publicHallIds().map((id) => ({ url: absoluteSiteUrl(`/halls/${id}`), lastModified, changeFrequency: "monthly" as const, priority: 0.75 })),
    ...publicCharacterIds().map((id) => ({ url: absoluteSiteUrl(`/people/${id}`), lastModified, changeFrequency: "monthly" as const, priority: 0.8 })),
  ];
}
