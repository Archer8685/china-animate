# 熱門中國動漫熱門影片排行

響應式 YouTube 熱門影片排行，支援每日、每週、每月、每季、每年與影片名稱搜尋。排行規則為「期間內上架的影片，依目前觀看數排序」。

影片列表每批顯示 30 部；點選「找相關」會依片名中的作品名、角色與主題詞推薦相似影片，並排除集數和常見宣傳詞。推薦結果可直接觀看，也可繼續作為下一輪探索起點。

手機與桌機皆可點縮圖前往 YouTube、點影片標題開啟相關影片面板；首頁標籤使用與相關影片相同的語意關聯詞，不顯示原始宣傳 hashtag。

手機與桌機接近片單底部時都會自動載入下一批 30 部影片。

YouTube 簡體中文標題會在每日資料更新時轉換為台灣繁體中文並寫入快取，因此顯示與搜尋皆使用繁體中文。

排行顯示觀看數、上傳日期與影片長度；影片長度屬於固定資訊，首次取得後會永久沿用快取。

線上網站：[https://archer8685.github.io/china-animate/](https://archer8685.github.io/china-animate/)

## 本機啟動

```bash
npm install
npm run dev
```

## 更新 YouTube 資料

1. 在 Google Cloud Console 啟用 **YouTube Data API v3** 並建立 API Key。
2. 設定環境變數後執行：

```powershell
$env:YOUTUBE_API_KEY="你的金鑰"
npm run fetch:videos
```

正式部署到 GitHub 後，在儲存庫的 `Settings → Secrets and variables → Actions` 新增 `YOUTUBE_API_KEY`。內建 GitHub Actions 會在台北時間每日 02:20 更新資料，也可手動執行。

更新採增量快取：影片基本資料只在首次發現時抓取；觀看數依影片新舊分級更新，30 天內每日、31–90 天每週、90 天以上每月，避免每天重抓完整頻道。

## 建置

```bash
npm run build
```

產物位於 `dist/`，可部署到任何靜態網站服務。
