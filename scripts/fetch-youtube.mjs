import { mkdir, readFile, writeFile } from 'node:fs/promises';

const API_KEY = process.env.YOUTUBE_API_KEY;
const CHANNEL_HANDLE = 'DawnAnimeClub';
const OUTPUT = new URL('../public/data/videos.json', import.meta.url);
const DAY = 86400000;

if (!API_KEY) {
  console.error('缺少 YOUTUBE_API_KEY 環境變數');
  process.exit(1);
}

async function youtube(resource, params) {
  const url = new URL(`https://www.googleapis.com/youtube/v3/${resource}`);
  Object.entries({ ...params, key: API_KEY }).forEach(([key, value]) => url.searchParams.set(key, value));
  const response = await fetch(url);
  if (!response.ok) throw new Error(`YouTube API ${response.status}: ${await response.text()}`);
  return response.json();
}

async function loadCache() {
  try {
    return JSON.parse(await readFile(OUTPUT, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return { videos: [] };
    throw error;
  }
}

async function getUploadsPlaylistId() {
  const data = await youtube('channels', { part: 'contentDetails', forHandle: CHANNEL_HANDLE });
  if (!data.items?.length) throw new Error(`找不到頻道 @${CHANNEL_HANDLE}`);
  return data.items[0].contentDetails.relatedPlaylists.uploads;
}

async function getNewUploads(playlistId, cachedIds) {
  const cutoff = Date.now() - 366 * DAY;
  const uploads = [];
  let pageToken = '';

  do {
    const page = await youtube('playlistItems', {
      part: 'snippet,contentDetails', playlistId, maxResults: '50', ...(pageToken && { pageToken }),
    });
    for (const item of page.items ?? []) {
      const id = item.contentDetails.videoId;
      if (cachedIds.has(id) || new Date(item.contentDetails.videoPublishedAt).getTime() < cutoff) return uploads;
      uploads.push(item);
    }
    pageToken = page.nextPageToken ?? '';
  } while (pageToken);
  return uploads;
}

function toVideo(item) {
  const id = item.contentDetails.videoId;
  return {
    id,
    title: item.snippet.title,
    publishedAt: item.contentDetails.videoPublishedAt,
    viewCount: 0,
    thumbnail: item.snippet.thumbnails?.medium?.url ?? `https://i.ytimg.com/vi/${id}/mqdefault.jpg`,
    url: `https://www.youtube.com/watch?v=${id}`,
  };
}

function refreshInterval(video) {
  const age = Date.now() - new Date(video.publishedAt).getTime();
  if (age <= 30 * DAY) return 20 * 60 * 60 * 1000;
  if (age <= 90 * DAY) return 7 * DAY;
  return 30 * DAY;
}

async function refreshStatistics(videos, ids, fetchedAt) {
  const statistics = new Map();
  const targets = videos.filter((video) => ids.has(video.id));
  for (let i = 0; i < targets.length; i += 50) {
    const batch = targets.slice(i, i + 50).map((video) => video.id).join(',');
    const page = await youtube('videos', { part: 'statistics', id: batch });
    page.items?.forEach((item) => statistics.set(item.id, Number(item.statistics.viewCount ?? 0)));
  }
  return videos.map((video) => statistics.has(video.id)
    ? { ...video, viewCount: statistics.get(video.id), lastStatsFetchedAt: fetchedAt }
    : video);
}

const cache = await loadCache();
const migratedVideos = (cache.videos ?? []).map((video) => ({
  ...video,
  lastStatsFetchedAt: video.lastStatsFetchedAt ?? cache.updatedAt,
}));
const cachedIds = new Set(migratedVideos.map((video) => video.id));
const playlistId = cache.uploadsPlaylistId ?? await getUploadsPlaylistId();
const newUploads = await getNewUploads(playlistId, cachedIds);
const newVideos = newUploads.map(toVideo);
const newIds = new Set(newVideos.map((video) => video.id));
const cutoff = Date.now() - 366 * DAY;
let videos = [...newVideos, ...migratedVideos]
  .filter((video) => new Date(video.publishedAt).getTime() >= cutoff)
  .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));

const now = new Date().toISOString();
const statsIds = new Set(videos
  .filter((video) => newIds.has(video.id)
    || !video.lastStatsFetchedAt
    || Date.now() - new Date(video.lastStatsFetchedAt).getTime() >= refreshInterval(video))
  .map((video) => video.id));
videos = await refreshStatistics(videos, statsIds, now);

await mkdir(new URL('../public/data/', import.meta.url), { recursive: true });
await writeFile(OUTPUT, `${JSON.stringify({ updatedAt: now, uploadsPlaylistId: playlistId, videos }, null, 2)}\n`);
console.log(`新增 ${newVideos.length} 部，更新觀看數 ${statsIds.size} 部，沿用快取 ${videos.length - statsIds.size} 部`);
