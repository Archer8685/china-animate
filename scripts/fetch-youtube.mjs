import { mkdir, writeFile } from 'node:fs/promises';

const API_KEY = process.env.YOUTUBE_API_KEY;
const CHANNEL_HANDLE = 'DawnAnimeClub';
const OUTPUT = new URL('../public/data/videos.json', import.meta.url);

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

async function getChannel() {
  const data = await youtube('channels', { part: 'contentDetails', forHandle: CHANNEL_HANDLE });
  if (!data.items?.length) throw new Error(`找不到頻道 @${CHANNEL_HANDLE}`);
  return data.items[0];
}

async function getRecentUploads(playlistId) {
  const cutoff = Date.now() - 366 * 86400000;
  const videos = [];
  let pageToken = '';

  do {
    const page = await youtube('playlistItems', {
      part: 'snippet,contentDetails', playlistId, maxResults: '50', ...(pageToken && { pageToken }),
    });
    for (const item of page.items ?? []) {
      if (new Date(item.contentDetails.videoPublishedAt).getTime() < cutoff) return videos;
      videos.push(item);
    }
    pageToken = page.nextPageToken ?? '';
  } while (pageToken);
  return videos;
}

async function addStatistics(items) {
  const statistics = new Map();
  for (let i = 0; i < items.length; i += 50) {
    const ids = items.slice(i, i + 50).map((item) => item.contentDetails.videoId).join(',');
    const page = await youtube('videos', { part: 'statistics', id: ids });
    page.items?.forEach((item) => statistics.set(item.id, Number(item.statistics.viewCount ?? 0)));
  }
  return items.map((item) => {
    const id = item.contentDetails.videoId;
    return {
      id,
      title: item.snippet.title,
      publishedAt: item.contentDetails.videoPublishedAt,
      viewCount: statistics.get(id) ?? 0,
      thumbnail: item.snippet.thumbnails?.medium?.url ?? `https://i.ytimg.com/vi/${id}/mqdefault.jpg`,
      url: `https://www.youtube.com/watch?v=${id}`,
    };
  });
}

const channel = await getChannel();
const uploads = await getRecentUploads(channel.contentDetails.relatedPlaylists.uploads);
const videos = await addStatistics(uploads);
await mkdir(new URL('../public/data/', import.meta.url), { recursive: true });
await writeFile(OUTPUT, `${JSON.stringify({ updatedAt: new Date().toISOString(), videos }, null, 2)}\n`);
console.log(`已更新 ${videos.length} 部影片`);
