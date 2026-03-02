import { defaultTipsCollection } from "./content";
import type { Tip, TipsCollection } from "./types";

const STORE_KEY = "mltl_ignored_tips";
const EVENT_NAMESPACE_KEY = "mltl_tips";

function getKey(collection: string) {
  return `${STORE_KEY}:${collection}`;
}

export function getTipCollectionEvent(collection: string, event: string) {
  return `${EVENT_NAMESPACE_KEY}.${collection}.${event}`;
}

export function getTipEvent(collection: string, tip: Tip, event: string) {
  if (tip.link.params?.experiment && tip.link.params?.treatment) {
    return `${EVENT_NAMESPACE_KEY}.${collection}.${tip.link.params?.experiment}.${tip.link.params?.treatment}.${event}`;
  }
  if (tip.link.params?.experiment) {
    return `${EVENT_NAMESPACE_KEY}.${collection}.${tip.link.params?.experiment}.${event}`;
  }
  if (tip.link.params?.treatment) {
    return `${EVENT_NAMESPACE_KEY}.${collection}.${tip.link.params?.treatment}.${event}`;
  }

  return getTipCollectionEvent(collection, event);
}

export function getTipMetadata(tip: Tip) {
  const { experiment, treatment, ...rest } = tip.link.params ?? {};
  return {
    ...rest,
    content: tip.description ?? tip.content ?? "",
    title: tip.title,
    href: tip.link.url,
    label: tip.link.label,
  };
}

/**
 * White-labeled: no longer fetches live tips from external sources.
 * Returns empty collections.
 */
export const loadLiveTipsCollection = () => {
  return defaultTipsCollection;
};

export function getRandomTip(collection: keyof TipsCollection): Tip | null {
  return null;
}

export function dismissTip(collection: string) {
  // no-op
}

export function isTipDismissed(collection: string) {
  return true;
}

export function createURL(url: string, params?: Record<string, string>): string {
  const base = new URL(url);

  Object.entries(params ?? {}).forEach(([key, value]) => {
    base.searchParams.set(key, value);
  });

  return base.toString();
}
