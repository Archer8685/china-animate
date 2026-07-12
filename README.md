# 曙光動畫社熱門影片排行

響應式 YouTube 熱門影片排行，支援每日、每週、每月、每季、每年與影片名稱搜尋。排行規則為「期間內上架的影片，依目前觀看數排序」。

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

## 建置

```bash
npm run build
```

產物位於 `dist/`，可部署到任何靜態網站服務。
