# inventory-management.skill.md - 在庫管理スキル v2.0

## スキル概要

カフェの在庫管理システムを構築・運用するためのスキル定義。
Google Spreadsheetの「在庫管理」シートと連携し、リアルタイムで在庫状況を確認できるUIを提供する。

## 対象領域

- Google Apps Script (GAS) によるAPI構築
- フロントエンドでの在庫表示
- **発注アラートセクション**の表示
- **在庫率バー**の視覚化
- **カテゴリ自動分類**
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

## 実装パターン v2.0

### GAS API実装（在庫管理シート参照）

```javascript
function doGet(e) {
  const spreadsheet = SpreadsheetApp.openById('SPREADSHEET_ID');

  // 在庫管理シートを主データソースとして使用
  const mainSheet = spreadsheet.getSheetByName('在庫管理');
  const mainData = mainSheet.getDataRange().getValues();

  const items = [];
  for (let i = 1; i < mainData.length; i++) {
    const row = mainData[i];
    const itemName = String(row[0] || '').trim();
    if (!itemName) continue;

    const remaining = parseFloat(row[2]) || 0;
    const ideal = parseFloat(row[3]) || 0;
    const orderLine = parseFloat(row[5]) || 0;

    // 発注判定
    const needsOrder = orderLine > 0 && remaining <= orderLine;

    // 在庫率計算
    const stockRatio = ideal > 0 ? Math.round((remaining / ideal) * 100) : 100;

    items.push({
      name: itemName,
      category: categorizeItem(itemName),
      remaining: remaining,
      ideal: ideal,
      orderLine: orderLine,
      purchaseStatus: String(row[1] || '').trim(),
      status: needsOrder ? '発注' : 'OK',
      needsOrder: needsOrder,
      stockRatio: stockRatio,
      unit: inferUnit(itemName, remaining)
    });
  }

  return ContentService
    .createTextOutput(JSON.stringify({
      success: true,
      version: '2.0',
      items: items,
      timestamp: new Date().toISOString()
    }))
    .setMimeType(ContentService.MimeType.JSON);
}
```

### カテゴリ自動分類

```javascript
const CATEGORY_RULES = {
  'コーヒー': ['コーヒー豆'],
  '乳製品': ['牛乳', 'ホイップクリーム', 'ミルク', '氷'],
  'シロップ・ソース': ['チョコソース', 'キャラメルソース', 'バニラシロップ'],
  'パウダー・茶葉': ['抹茶パウダー', 'ほうじ茶パウダー', 'アールグレイ'],
  '消耗品（容器）': ['紙カップ', 'フタ', 'プラカップ', 'マドラー', 'ストロー'],
  '消耗品（調味料）': ['シュガー', 'ガムシロップ'],
  '衛生用品': ['手袋', '消毒液', 'アルコール', 'ペーパータオル']
};

function categorizeItem(itemName) {
  const name = String(itemName).toLowerCase();
  for (const [category, keywords] of Object.entries(CATEGORY_RULES)) {
    for (const keyword of keywords) {
      if (name.includes(keyword.toLowerCase())) {
        return category;
      }
    }
  }
  return 'その他';
}
```

### フロントエンド実装 v2.0

```javascript
async function fetchInventoryData() {
  updateApiStatus('checking', '接続確認中...');

  try {
    const response = await fetch(GAS_API_URL);
    const data = await response.json();
    updateApiStatus('connected', 'API接続中');
    return data;
  } catch (error) {
    updateApiStatus('offline', '接続エラー');
    // フォールバックデータを返す
    return fallbackInventoryData;
  }
}
```

### 発注アラートセクション

```javascript
// 発注が必要なアイテムを先に表示
if (data.orderList && data.orderList.length > 0) {
  html += `
    <div class="order-alert-section">
      <h3 class="order-alert-title">
        <i class="fas fa-exclamation-triangle"></i>
        発注が必要なアイテム（${data.orderList.length}件）
      </h3>
      <div class="order-list">
        ${data.orderList.map(item => `
          <div class="order-item">
            <span class="order-item-name">${item.name}</span>
            <span class="order-item-info">
              残数: <strong>${item.remaining}</strong>${item.unit}
              （発注ライン: ${item.orderLine}${item.unit}）
            </span>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}
```

### 在庫率バー表示

```javascript
// 在庫率に応じた色分け
let barClass = 'bar-ok';
if (needsOrder) {
  barClass = 'bar-danger';
} else if (stockRatio < 50) {
  barClass = 'bar-warning';
}

html += `
  <div class="stock-bar-container">
    <div class="stock-bar ${barClass}" style="width: ${Math.min(100, stockRatio)}%"></div>
  </div>
`;
```

### API接続ステータス実装

```javascript
function updateApiStatus(status, message) {
    const statusContainer = document.getElementById('apiConnectionStatus');
    if (!statusContainer) return;

    const indicator = statusContainer.querySelector('.status-indicator');
    const text = statusContainer.querySelector('.status-text');

    indicator.className = 'status-indicator status-' + status;
    statusContainer.className = 'api-status status-' + status + '-wrapper';
    text.textContent = message;
}
```

## 品質基準

### パフォーマンス
- API応答時間: 3秒以内
- ローディングインジケーター表示
- エラー時のリトライ機能

### UX
- **発注アラートセクション**を最上部に表示
- **在庫率バー**で視覚的に残量を表示
- **3段階ステータス**: OK（緑）、残少（黄）、要発注（赤）
- カテゴリ別グループ表示
- カテゴリごとの要発注数バッジ
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
| ネットワークエラー | リトライボタン表示、フォールバックデータ使用 |
| API応答エラー | エラーメッセージ表示、キャッシュデータ使用 |
| データ形式エラー | フォールバック表示 |
| スプレッドシート非公開 | 設定案内メッセージ |

## 更新フロー

```
スプレッドシート「在庫管理」シート更新
    ↓
GAS API 呼び出し（ページ更新/手動更新）
    ↓
JSONデータ取得（v2.0形式）
    ↓
カテゴリ別グループ化・発注優先ソート
    ↓
フロントエンドでレンダリング
    ↓
ユーザーに表示
```

## 制限事項

- 編集機能なし（読み取り専用）
- リアルタイム自動更新なし（手動更新）
- オフライン時は最後のキャッシュデータを表示

## バージョン履歴

| バージョン | 日付 | 変更内容 |
|-----------|------|----------|
| 2.0 | 2025-12-30 | 在庫管理シート参照に変更、カテゴリ自動分類、在庫率表示、発注アラートセクション |
| 1.0 | 2025-12-29 | 初版 |
