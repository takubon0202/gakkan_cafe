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

### カテゴリ自動分類 v2.1

```javascript
const CATEGORY_RULES = {
  'コーヒー': ['コーヒー豆', 'エスプレッソ'],
  '乳製品・冷蔵': ['牛乳', 'ホイップクリーム', 'ミルク', '氷'],
  'シロップ・ソース': ['チョコソース', 'キャラメルソース', 'バニラシロップ', 'チャイシロップ', 'ホワイトチョコソース'],
  'パウダー・茶葉': ['抹茶パウダー', 'ほうじ茶パウダー', 'アールグレイ'],
  '消耗品（容器）': ['紙カップ', 'フタ', 'プラカップ', 'プラフタ', 'マドラー', 'ストロー'],
  '消耗品（調味料）': ['シュガー', 'ガムシロップ'],
  '衛生・清掃用品': ['手袋', '消毒液', 'アルコール', 'ペーパータオル', 'スポンジ', '洗剤']
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

### v2.3 仕入れ状況ベースの表示セクション

```javascript
// v2.3: 未申請アイテムを赤で表示
if (data.orderList && data.orderList.length > 0) {
  html += `
    <div class="order-alert-section status-pending-section">
      <h3 class="order-alert-title">
        <i class="fas fa-exclamation-circle"></i>
        未申請（${data.orderList.length}件）
      </h3>
      <div class="order-list">
        ${data.orderList.map(item => `
          <div class="order-item">
            <span class="order-item-name">${item.name}</span>
            <span class="order-item-info">
              残数: <strong>${item.remaining}</strong>${item.unit}
            </span>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

// v2.3: 仕入れ申請中アイテムをオレンジで表示
if (data.inProgressList && data.inProgressList.length > 0) {
  html += `
    <div class="in-progress-section status-in-progress-section">
      <h3 class="in-progress-title">
        <i class="fas fa-clock"></i>
        仕入れ申請中（${data.inProgressList.length}件）
      </h3>
      <div class="in-progress-list">
        ${data.inProgressList.map(item => `
          <div class="in-progress-item">
            <span class="in-progress-item-name">${item.name}</span>
            <span class="in-progress-item-info">
              残数: <strong>${item.remaining}</strong>${item.unit}
            </span>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}
```

### 在庫率バー表示（v2.3）

```javascript
// v2.3: 仕入れ状況に応じた色分け
let barClass = 'bar-completed';  // 緑（完了）
if (item.statusType === 'pending' || item.needsOrder) {
  barClass = 'bar-pending';       // 赤（未申請）
} else if (item.statusType === 'in_progress' || item.inProgress) {
  barClass = 'bar-in-progress';   // オレンジ（仕入れ申請中）
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

### UX（v2.3）
- **未申請アラートセクション**を最上部に赤で表示
- **仕入れ申請中セクション**をオレンジで表示
- **在庫率バー**で視覚的に残量を表示
- **仕入れ状況に応じた3段階ステータス**:
  - 完了（緑）: 仕入れ完了
  - 未申請（赤）: 発注申請が必要
  - 仕入れ申請中（オレンジ）: 申請済み・到着待ち
- カテゴリ別グループ表示
- カテゴリごとの未申請/申請中数バッジ
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

## 拡張性設計 v2.4

### 設計原則

1. **Single Source of Truth**: スプレッドシートが唯一の真実の源
2. **自動推測**: カテゴリと単位は商品名から自動判定
3. **テーブル駆動**: ルールは配列/オブジェクトで管理（if-else 排除）
4. **派生データ自動生成**: orderList, inProgressList, summary は items から生成

### 拡張ポイント

| 操作 | 変更場所 | 備考 |
|------|----------|------|
| 商品追加 | スプレッドシートのみ | コード変更不要 |
| カテゴリ追加 | CATEGORY_RULES (GAS + data.js) | 2ファイル同期必要 |
| 単位ルール追加 | UNIT_RULES (GAS + data.js) | 2ファイル同期必要 |
| フォールバック更新 | items 配列のみ | 派生データは自動生成 |

## バージョン履歴

| バージョン | 日付 | 変更内容 |
|-----------|------|----------|
| 2.4 | 2025-12-30 | **拡張性改善**: フォールバックデータ自動生成、UNIT_RULESテーブル化、拡張性ドキュメント追加 |
| 2.3 | 2025-12-30 | **仕入れ状況ベース判定**に変更（完了=緑、未申請=赤、仕入れ申請中=オレンジ）、statusType/inProgressフィールド追加、inProgressList追加 |
| 2.2 | 2025-12-30 | 単位推測ロジック修正（商品名のg/mlではなく商品タイプで判定: ソース→本、パウダー→袋など） |
| 2.1 | 2025-12-30 | カテゴリ分類ルール最適化（乳製品・冷蔵、衛生・清掃用品）、スポンジ・洗剤対応 |
| 2.0 | 2025-12-30 | 在庫管理シート参照に変更、カテゴリ自動分類、在庫率表示、発注アラートセクション |
| 1.0 | 2025-12-29 | 初版 |
