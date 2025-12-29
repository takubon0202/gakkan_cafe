# inventory-management.skill.md - 在庫管理スキル

## スキル概要

カフェの在庫管理システムを構築・運用するためのスキル定義。
Google Spreadsheetと連携し、リアルタイムで在庫状況を確認できるUIを提供する。

## 対象領域

- Google Apps Script (GAS) によるAPI構築
- フロントエンドでの在庫表示
- 発注アラートの視覚化
- 保管場所情報の表示
- **API接続ステータスのリアルタイム表示**

## 必要な知識

### Google Apps Script
- doGet/doPost関数
- SpreadsheetApp API
- ContentService
- CORS対応

### フロントエンド
- Fetch API
- 非同期処理 (async/await)
- DOM操作
- ローディング状態管理

## 実装パターン

### GAS API実装

```javascript
function doGet(e) {
  const spreadsheet = SpreadsheetApp.openById('SPREADSHEET_ID');
  const sheet = spreadsheet.getSheetByName('在庫数・発注');
  const data = sheet.getDataRange().getValues();

  // ヘッダー行をスキップしてデータを整形
  const items = data.slice(1).map(row => ({
    category: row[0],
    name: row[1],
    supplier: row[2],
    orderPoint: row[3],
    stock: row[4],
    unit: row[5],
    status: row[4] <= row[3] ? '発注' : 'OK'
  })).filter(item => item.name);

  return ContentService
    .createTextOutput(JSON.stringify({ items, timestamp: new Date().toISOString() }))
    .setMimeType(ContentService.MimeType.JSON);
}
```

### フロントエンド実装

```javascript
async function fetchInventoryData() {
  const container = document.getElementById('inventoryContent');
  container.innerHTML = '<div class="loading">読み込み中...</div>';

  try {
    const response = await fetch(GAS_API_URL);
    const data = await response.json();
    renderInventory(data);
  } catch (error) {
    container.innerHTML = '<div class="error">データの取得に失敗しました</div>';
  }
}
```

### API接続ステータス実装

```javascript
/**
 * API接続ステータスを更新
 * @param {string} status - 'checking' | 'connected' | 'offline' | 'cached' | 'unconfigured'
 * @param {string} message - 表示メッセージ
 */
function updateApiStatus(status, message) {
    const statusContainer = document.getElementById('apiConnectionStatus');
    if (!statusContainer) return;

    const indicator = statusContainer.querySelector('.status-indicator');
    const text = statusContainer.querySelector('.status-text');

    // ステータスクラスをリセット
    indicator.className = 'status-indicator';
    statusContainer.className = 'api-status';

    // 新しいステータスを設定
    indicator.classList.add(`status-${status}`);
    statusContainer.classList.add(`status-${status}-wrapper`);
    text.textContent = message;
}
```

### ステータス表示HTML

```html
<div class="api-status" id="apiConnectionStatus">
    <span class="status-indicator status-checking"></span>
    <span class="status-text">接続確認中...</span>
</div>
```

### ステータス表示CSS

```css
.api-status {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 6px 14px;
    border-radius: 20px;
    font-size: 0.85rem;
}

.status-indicator {
    width: 10px;
    height: 10px;
    border-radius: 50%;
}

/* 接続成功 - 緑点滅 */
.status-indicator.status-connected {
    background: #10b981;
    animation: pulse-connected 2s ease-in-out infinite;
}

/* オフライン - 赤 */
.status-indicator.status-offline {
    background: #ef4444;
}
```

## 品質基準

### パフォーマンス
- API応答時間: 3秒以内
- ローディングインジケーター表示
- エラー時のリトライ機能

### UX
- 発注が必要なアイテムは視覚的に強調
- カテゴリ別フィルタリング
- 最終更新日時の表示
- **API接続ステータスのリアルタイム表示**
  - 緑点滅: API正常接続中
  - オレンジ点滅: 接続確認中
  - 青: キャッシュ使用中
  - 赤: 接続エラー
  - グレー: API未設定

### アクセシビリティ
- スクリーンリーダー対応
- キーボードナビゲーション
- コントラスト比の確保

## エラーハンドリング

| エラー | 対応 |
|--------|------|
| ネットワークエラー | リトライボタン表示 |
| API応答エラー | エラーメッセージ表示 |
| データ形式エラー | フォールバック表示 |
| スプレッドシート非公開 | 設定案内メッセージ |

## 更新フロー

```
スプレッドシート更新
    ↓
GAS API 呼び出し（ページ更新/手動更新）
    ↓
JSONデータ取得
    ↓
フロントエンドでレンダリング
    ↓
ユーザーに表示
```

## 制限事項

- 編集機能なし（読み取り専用）
- リアルタイム自動更新なし（手動更新）
- オフライン時は最後のキャッシュデータを表示
