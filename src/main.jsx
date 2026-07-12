import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowUpRight, CirclePlay, Clock3, Eye, Search } from 'lucide-react';
import './styles.css';

const periods = [
  { id: 'day', label: '每天', days: 1 },
  { id: 'week', label: '每週', days: 7 },
  { id: 'month', label: '每月', days: 30 },
  { id: 'quarter', label: '每季', days: 90 },
  { id: 'year', label: '每年', days: 365 },
];

const number = new Intl.NumberFormat('zh-TW', { notation: 'compact', maximumFractionDigits: 1 });
const fullNumber = new Intl.NumberFormat('zh-TW');
const date = new Intl.DateTimeFormat('zh-TW', { year: 'numeric', month: 'short', day: 'numeric' });

function formatAge(value) {
  const days = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 86400000));
  if (days === 0) return '今天上架';
  if (days < 7) return `${days} 天前`;
  if (days < 30) return `${Math.floor(days / 7)} 週前`;
  if (days < 365) return `${Math.floor(days / 30)} 個月前`;
  return `${Math.floor(days / 365)} 年前`;
}

function App() {
  const [payload, setPayload] = useState({ updatedAt: null, videos: [] });
  const [period, setPeriod] = useState('month');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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

  const activePeriod = periods.find((item) => item.id === period);
  const videos = useMemo(() => {
    const cutoff = Date.now() - activePeriod.days * 86400000;
    const keyword = query.trim().toLocaleLowerCase('zh-Hant');
    return payload.videos
      .filter((video) => new Date(video.publishedAt).getTime() >= cutoff)
      .filter((video) => !keyword || video.title.toLocaleLowerCase('zh-Hant').includes(keyword))
      .sort((a, b) => b.viewCount - a.viewCount);
  }, [payload.videos, activePeriod.days, query]);

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

      <section className="hero">
        <div>
          <p className="eyebrow">YOUTUBE VIEWERS' CHOICE</p>
          <h1>此刻，大家<br />都在看什麼？</h1>
        </div>
        <div className="hero-note">
          <span className="live-dot" /> 每日更新
          <p>依觀看次數整理頻道熱門作品，<br />快速找到本期最受注目的動畫。</p>
          {payload.updatedAt && <small>上次更新 {date.format(new Date(payload.updatedAt))}</small>}
        </div>
      </section>

      <section className="controls" aria-label="排行篩選">
        <div className="periods" role="tablist" aria-label="熱門期間">
          {periods.map((item) => (
            <button key={item.id} role="tab" aria-selected={period === item.id} onClick={() => setPeriod(item.id)}>
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

        {loading && <div className="status">正在整理放映清單…</div>}
        {error && <div className="status error">{error}</div>}
        {!loading && !error && videos.length === 0 && (
          <div className="status">這個期間沒有符合「{query || '目前條件'}」的影片，試試其他期間或關鍵字。</div>
        )}

        <div className="video-list">
          {videos.map((video, index) => (
            <article className="video-row" key={video.id}>
              <div className="rank" aria-label={`第 ${index + 1} 名`}>{String(index + 1).padStart(2, '0')}</div>
              <a className="thumb" href={video.url} target="_blank" rel="noreferrer" aria-label={`觀看 ${video.title}`}>
                <img src={video.thumbnail} alt="" loading="lazy" />
                <span className="play">▶</span>
              </a>
              <div className="video-info">
                <a href={video.url} target="_blank" rel="noreferrer"><h3>{video.title}</h3></a>
                <div className="meta">
                  <span title={`${fullNumber.format(video.viewCount)} 次觀看`}><Eye size={16} /> {number.format(video.viewCount)} 次觀看</span>
                  <span title={formatAge(video.publishedAt)}><Clock3 size={15} /> {date.format(new Date(video.publishedAt))}</span>
                </div>
              </div>
              <a className="watch" href={video.url} target="_blank" rel="noreferrer">觀看影片 <ArrowUpRight size={17} /></a>
            </article>
          ))}
        </div>
      </section>

      <footer><span>資料來源：YouTube Data API</span><span>排名依目前觀看次數計算</span></footer>
    </main>
  );
}

createRoot(document.getElementById('root')).render(<App />);
