import { lsGetJSON, lsSetJSON } from "./storage";

export type FeedItemType = "video_achievement" | "note";

export type FeedItem = {
  id: string;

  // "дата события" (привязка к тренировочному дню), в таймзоне Europe/Moscow.
  // Формат: YYYY-MM-DD
  date: string;

  type: FeedItemType;

  // кто опубликовал
  userId: string;

  // контент
  title: string;
  text?: string;

  // опционально: если это достижение по дисциплине
  disciplineSlug?: string;
  value?: number;

  // видео пока только ссылкой (на этапе local-dev)
  videoUrl?: string;

  // когда создано (UTC)
  createdAtUtc: string;
};

const LS_FEED_KEY = "trainingBaza:feed:v1";

export function loadFeed(): FeedItem[] {
  const data = lsGetJSON<unknown>(LS_FEED_KEY, []);
  return Array.isArray(data) ? (data as FeedItem[]) : [];
}

export function saveFeed(items: FeedItem[]) {
  lsSetJSON(LS_FEED_KEY, items);
}


export function addFeedItem(item: FeedItem) {
  const all = loadFeed();
  all.push(item);
  // новые сверху
  all.sort((a, b) => (a.createdAtUtc < b.createdAtUtc ? 1 : -1));
  saveFeed(all);
  return all;
}
