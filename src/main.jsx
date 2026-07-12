import React, { useDeferredValue, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowUpRight, CirclePlay, Clock3, Eye, RotateCcw, ScanSearch, Search, Timer, X } from 'lucide-react';
import './styles.css';

const periods = [
  { id: 'day', label: '每天', days: 1 },
  { id: 'week', label: '每週', days: 7 },
  { id: 'month', label: '每月', days: 30 },
  { id: 'quarter', label: '每季', days: 90 },
  { id: 'year', label: '每年', days: 365 },
  { id: 'all', label: '全部', days: null },
];
const PAGE_SIZE = 30;

const number = new Intl.NumberFormat('zh-TW', { notation: 'compact', maximumFractionDigits: 1 });
const fullNumber = new Intl.NumberFormat('zh-TW');
const date = new Intl.DateTimeFormat('zh-TW', { year: 'numeric', month: 'short', day: 'numeric' });
const genericTerms = new Set(['動畫', '動漫', '影片', '完整', '完整版', '官方', '中文', '中字', '高清', '最新', '預告', '精華', '片段']);

function titleTerms(title) {
  const clean = title.normalize('NFKC').toLocaleLowerCase('zh-Hant')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/第\s*\d+\s*[集話期季部]/g, ' ')
    .replace(/\b(?:ep(?:isode)?|season|part)\.?\s*\d+\b/gi, ' ')
    .replace(/\b\d{1,4}\b/g, ' ');
  const terms = new Set(clean.match(/[a-z][a-z0-9]{1,}/g) ?? []);
  for (const chunk of clean.match(/[一-龥ぁ-んァ-ヶー]{2,}/g) ?? []) {
    if (chunk.length <= 12) terms.add(chunk);
    for (let size = 2; size <= Math.min(3, chunk.length); size += 1) {
      for (let index = 0; index <= chunk.length - size; index += 1) terms.add(chunk.slice(index, index + size));
    }
  }
  genericTerms.forEach((term) => terms.delete(term));
  return terms;
}

function displayTitle(title) {
  let clean = title.trim();
  const workTitle = clean.match(/《([^》]+)》(.*)/);
  if (workTitle) clean = `${workTitle[1]} ${workTitle[2]}`;
  clean = clean
    .replace(/#[^#\s]+/g, ' ')
    .replace(/^(?:MULTISUB\s*)?[📢🔥\s]*(?:新番上线|完结合集)[🔥📢\s]*/i, '')
    .replace(/\s+/g, ' ')
    .replace(/[丨|]\s*$/, '')
    .trim();
  return clean || title;
}

function videoTags(title) {
  const hidden = new Set(['#破晓动漫社', '#dawnanimeclub']);
  return [...new Set(title.match(/#[^#\s]+/g) ?? [])]
    .filter((tag) => !hidden.has(tag.toLocaleLowerCase()))
    .slice(0, 4);
}

function formatAge(value) {
  const days = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 86400000));
  if (days === 0) return '今天上架';
  if (days < 7) return `${days} 天前`;
  if (days < 30) return `${Math.floor(days / 7)} 週前`;
  if (days < 365) return `${Math.floor(days / 30)} 個月前`;
  return `${Math.floor(days / 365)} 年前`;
}

function formatDuration(value) {
  if (!Number.isFinite(value)) return null;
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  const seconds = value % 60;
  return hours
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    : `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function App() {
  const [payload, setPayload] = useState({ updatedAt: null, videos: [] });
  const [period, setPeriod] = useState('day');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [isPeriodPending, startPeriodTransition] = useTransition();
  const deferredQuery = useDeferredValue(query);
  const loadMoreRef = useRef(null);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/videos.json`, { cache: 'no-store' })
      .then((response) => {
        if (!response.ok) throw new Error('資料讀取失敗');
        return response.json();
      })
      .then(setPayload)
      .catch(() => setError('目前無法載入排行資料，請稍後再試。'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedVideo) return undefined;
    const close = (event) => event.key === 'Escape' && setSelectedVideo(null);
    document.body.classList.add('panel-open');
    window.addEventListener('keydown', close);
    return () => {
      document.body.classList.remove('panel-open');
      window.removeEventListener('keydown', close);
    };
  }, [selectedVideo]);

  const rankedVideos = useMemo(() => payload.videos
    .map((video) => ({
      ...video,
      publishedTime: new Date(video.publishedAt).getTime(),
      searchTitle: video.title.toLocaleLowerCase('zh-Hant'),
    }))
    .sort((a, b) => b.viewCount - a.viewCount), [payload.videos]);

  const relatedIndex = useMemo(() => {
    const rows = rankedVideos.map((video) => ({ video, terms: titleTerms(video.title) }));
    const frequency = new Map();
    const positions = new Map();
    const byId = new Map();
    rows.forEach(({ video, terms }, index) => {
      byId.set(video.id, index);
      terms.forEach((term) => {
        frequency.set(term, (frequency.get(term) ?? 0) + 1);
        if (!positions.has(term)) positions.set(term, []);
        positions.get(term).push(index);
      });
    });
    return { rows, frequency, positions, byId };
  }, [rankedVideos]);

  const relatedVideos = useMemo(() => {
    if (!selectedVideo) return [];
    const sourceIndex = relatedIndex.byId.get(selectedVideo.id);
    const source = relatedIndex.rows[sourceIndex];
    if (!source) return [];
    const maxFrequency = Math.max(30, relatedIndex.rows.length * 0.12);
    const sourceTerms = [...source.terms].filter((term) => {
      const count = relatedIndex.frequency.get(term) ?? 0;
      return count > 1 && count <= maxFrequency;
    });
    const sourceWeight = sourceTerms.reduce((sum, term) => {
      const idf = Math.log((relatedIndex.rows.length + 1) / (relatedIndex.frequency.get(term) + 1)) + 1;
      return sum + idf;
    }, 0);

    const candidates = new Map();
    sourceTerms.forEach((term) => {
      const weight = Math.log((relatedIndex.rows.length + 1) / (relatedIndex.frequency.get(term) + 1)) + 1;
      relatedIndex.positions.get(term).forEach((index) => {
        if (index === sourceIndex) return;
        if (!candidates.has(index)) candidates.set(index, []);
        candidates.get(index).push({ term, weight });
      });
    });

    return [...candidates.entries()]
      .map(([index, matches]) => {
        const score = matches.reduce((sum, match) => sum + match.weight, 0) / Math.max(1, sourceWeight);
        const reasons = matches.sort((a, b) => b.weight - a.weight || b.term.length - a.term.length)
          .filter((match, index, list) => !list.slice(0, index).some((item) => item.term.includes(match.term)))
          .slice(0, 3)
          .map((match) => match.term);
        return { video: relatedIndex.rows[index].video, score, reasons };
      })
      .filter((item) => item.score >= 0.08 && item.reasons.length)
      .sort((a, b) => b.score - a.score || b.video.viewCount - a.video.viewCount)
      .slice(0, 8);
  }, [relatedIndex, selectedVideo]);

  const activePeriod = periods.find((item) => item.id === period);
  const videos = useMemo(() => {
    const cutoff = activePeriod.days ? Date.now() - activePeriod.days * 86400000 : null;
    const keyword = deferredQuery.trim().toLocaleLowerCase('zh-Hant');
    return rankedVideos
      .filter((video) => !cutoff || video.publishedTime >= cutoff)
      .filter((video) => !keyword || video.searchTitle.includes(keyword));
  }, [rankedVideos, activePeriod.days, deferredQuery]);
  const visibleVideos = videos.slice(0, visibleCount);
  const filterPending = isPeriodPending || query !== deferredQuery;

  useEffect(() => setVisibleCount(PAGE_SIZE), [period, deferredQuery]);

  useEffect(() => {
    const target = loadMoreRef.current;
    if (!target || visibleCount >= videos.length || !window.matchMedia('(max-width: 760px)').matches) return undefined;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      observer.disconnect();
      setVisibleCount((count) => Math.min(count + PAGE_SIZE, videos.length));
    }, { rootMargin: '500px 0px' });
    observer.observe(target);
    return () => observer.disconnect();
  }, [visibleCount, videos.length]);

  return (
    <main>
      <header className="masthead">
        <a className="brand" href="https://www.youtube.com/@DawnAnimeClub" target="_blank" rel="noreferrer">
          <span className="brand-mark"><span>曙</span></span>
          <span><strong>曙光動畫社</strong><small>DAWN ANIME CLUB</small></span>
        </a>
        <a className="channel-link" href="https://www.youtube.com/@DawnAnimeClub" target="_blank" rel="noreferrer">
          <CirclePlay size={18} /> 前往頻道 <ArrowUpRight size={16} />
        </a>
      </header>
      {payload.updatedAt && <div className="update-stamp">上次更新 {date.format(new Date(payload.updatedAt))}</div>}

      <section className="controls" aria-label="排行篩選">
        <div className="periods" role="tablist" aria-label="熱門期間">
          {periods.map((item) => (
            <button key={item.id} role="tab" aria-selected={period === item.id} onClick={() => startPeriodTransition(() => setPeriod(item.id))}>
              {item.label}
            </button>
          ))}
        </div>
        <label className="search">
          <Search size={19} />
          <span className="sr-only">搜尋影片名稱</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜尋影片名稱" />
          {query && <button onClick={() => setQuery('')} aria-label="清除搜尋">清除</button>}
        </label>
      </section>

      <section className="ranking">
        <div className="section-heading">
          <div><span>RANKING</span><h2>{activePeriod.label}熱門影片</h2></div>
          <p>共 {videos.length} 部作品</p>
        </div>
        {filterPending && <div className="filter-progress" role="status"><span />正在整理排行…</div>}

        {loading && <div className="status">正在整理放映清單…</div>}
        {error && <div className="status error">{error}</div>}
        {!loading && !error && videos.length === 0 && (
          <div className="status">這個期間沒有符合「{query || '目前條件'}」的影片，試試其他期間或關鍵字。</div>
        )}

        <div className="video-list">
          {visibleVideos.map((video, index) => (
            <article className="video-row" key={video.id}>
              <div className="rank" aria-label={`第 ${index + 1} 名`}>{String(index + 1).padStart(2, '0')}</div>
              <a className="thumb" href={video.url} target="_blank" rel="noreferrer" aria-label={`觀看 ${displayTitle(video.title)}`}>
                <img src={video.thumbnail} alt="" loading="lazy" />
                <span className="play">▶</span>
              </a>
              <div className="video-info">
                <button className="title-button" onClick={() => setSelectedVideo(video)} aria-haspopup="dialog"><h3>{displayTitle(video.title)}</h3></button>
                {videoTags(video.title).length > 0 && (
                  <div className="video-tags" aria-label="影片標籤">
                    {videoTags(video.title).map((tag) => <span key={tag}>{tag}</span>)}
                  </div>
                )}
                <div className="meta">
                  <span title={`${fullNumber.format(video.viewCount)} 次觀看`}><Eye size={16} /> {number.format(video.viewCount)} 次觀看</span>
                  <span className="upload-date" title={formatAge(video.publishedAt)}><Clock3 size={15} /> {date.format(new Date(video.publishedAt))}</span>
                  {formatDuration(video.durationSeconds) && <span className="duration"><Timer size={15} /> {formatDuration(video.durationSeconds)}</span>}
                </div>
              </div>
              <div className="video-actions">
                <button className="related" onClick={() => setSelectedVideo(video)}><ScanSearch size={16} /> 找相關</button>
                <a className="watch" href={video.url} target="_blank" rel="noreferrer">觀看影片 <ArrowUpRight size={17} /></a>
              </div>
            </article>
          ))}
        </div>
        {visibleCount < videos.length && (
          <div className="load-more-wrap" ref={loadMoreRef}>
            <p>已顯示 {visibleVideos.length}／{videos.length} 部</p>
            <button className="load-more" onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}>
              再載入 {Math.min(PAGE_SIZE, videos.length - visibleCount)} 部
            </button>
            <div className="auto-load"><span />繼續往下滑，自動載入更多</div>
          </div>
        )}
      </section>

      {selectedVideo && (
        <div className="related-overlay" onMouseDown={(event) => event.target === event.currentTarget && setSelectedVideo(null)}>
          <aside className="related-panel" role="dialog" aria-modal="true" aria-labelledby="related-title">
            <div className="panel-head">
              <div><span>DISCOVER</span><h2 id="related-title">相關影片</h2></div>
              <button className="panel-close" onClick={() => setSelectedVideo(null)} aria-label="關閉相關影片"><X /></button>
            </div>

            <div className="selected-film">
              <img src={selectedVideo.thumbnail} alt="" />
              <div><small>因為你選了</small><h3>{displayTitle(selectedVideo.title)}</h3></div>
              <a href={selectedVideo.url} target="_blank" rel="noreferrer" aria-label={`觀看 ${displayTitle(selectedVideo.title)}`}><CirclePlay /></a>
            </div>

            <div className="match-note">依片名中的作品名、角色與主題詞推薦，已排除集數及常見宣傳詞。</div>
            {relatedVideos.length ? (
              <div className="related-results">
                {relatedVideos.map(({ video, reasons }, index) => (
                  <article className="related-card" key={video.id}>
                    <span className="related-rank">{String(index + 1).padStart(2, '0')}</span>
                    <a className="related-thumb" href={video.url} target="_blank" rel="noreferrer"><img src={video.thumbnail} alt="" loading="lazy" /></a>
                    <div>
                      <a href={video.url} target="_blank" rel="noreferrer"><h3>{displayTitle(video.title)}</h3></a>
                      <p>{reasons.map((reason) => <span key={reason}>{reason}</span>)}</p>
                      <small>{number.format(video.viewCount)} 次觀看</small>
                    </div>
                    <button className="pivot" onClick={() => setSelectedVideo(video)} title="以這部影片繼續找" aria-label={`以 ${displayTitle(video.title)} 繼續找相關影片`}><RotateCcw size={15} /></button>
                  </article>
                ))}
              </div>
            ) : (
              <div className="related-empty">目前找不到足夠相似的片名。試試片名中包含作品名稱或角色名稱的影片。</div>
            )}
          </aside>
        </div>
      )}

      <footer><span>資料來源：YouTube Data API</span><span>排名依目前觀看次數計算</span></footer>
    </main>
  );
}

createRoot(document.getElementById('root')).render(<App />);
