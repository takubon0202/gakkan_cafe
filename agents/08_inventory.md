# 08_inventory.md - 在庫管理エージェント

## エージェント概要

| 項目 | 内容 |
|------|------|
| 役割 | 在庫管理システムの構築・保守 |
| 入力 | スプレッドシートURL、在庫データ構造 |
| 出力 | GASスクリプト、在庫表示UI |
| 責任範囲 | Google Spreadsheet連携、在庫状況の可視化 |

## 対象スプレッドシート

- **URL**: https://docs.google.com/spreadsheets/d/1iuTiIGV0Zz-AMx8aTcKZ0qSfI6kUSnZT4RZnWbgDCB8/edit
- **シート構成**:
  - `在庫管理`: メイン在庫リスト（残数、仕入れライン等）
  - `入力確認１`: 入力履歴
  - `在庫数・発注`: 発注判定用（カテゴリ、商品名、仕入れ先、発注点、在庫数、単位、判定）
  - `在庫管理場所`: 保管場所情報

## 技術仕様

### GAS（Google Apps Script）

1. **doGet関数**: Web APIとしてJSONを返す
2. **読み取り専用**: 編集機能は提供しない
3. **CORSヘッダー**: フロントエンドからのアクセスを許可
4. **キャッシュ**: スプレッドシートの負荷軽減のため適切にキャッシュ

### フロントエンド

1. **在庫一覧表示**: カテゴリ別にグループ化
2. **発注アラート**: 発注点以下の商品をハイライト
3. **自動更新**: ページ読み込み時にAPI呼び出し
4. **ローディング表示**: データ取得中のUI
5. **エラーハンドリング**: API失敗時のフォールバック
6. **API接続ステータス表示**: リアルタイムで接続状態を視覚的に表示

### API接続ステータス機能

ページヘッダーに接続状態をリアルタイム表示:

| ステータス | インジケータ | 意味 |
|-----------|-------------|------|
| `connected` | 緑（点滅） | API正常接続中 |
| `checking` | オレンジ（点滅） | 接続確認中 |
| `cached` | 青 | キャッシュデータ使用中 |
| `offline` | 赤 | 接続エラー |
| `unconfigured` | グレー | API未設定（デモデータ） |

#### 実装パターン
```javascript
function updateApiStatus(status, message) {
    const statusContainer = document.getElementById('apiConnectionStatus');
    const indicator = statusContainer.querySelector('.status-indicator');
    const text = statusContainer.querySelector('.status-text');

    indicator.className = 'status-indicator status-' + status;
    statusContainer.className = 'api-status status-' + status + '-wrapper';
    text.textContent = message;
}
```

## データ構造

### 在庫アイテム
```javascript
{
  category: "ラテ",
  name: "チョコソース",
  supplier: "業務スーパー",
  orderPoint: 500,
  stock: 1000,
  unit: "g",
  status: "OK" // or "発注"
}
```

### 保管情報
```javascript
{
  name: "チョコソース",
  beforeOpen: "常温",
  afterOpen: "閉店時：冷蔵庫\n開店時：常温",
  location: "",
  expiryDays: "1か月",
  notes: "注ぎ口を清潔に"
}
```

## UI設計

### 在庫管理ページ構成

1. **ヘッダー**
   - ページタイトル
   - **API接続ステータスインジケータ**（緑＝接続中、赤＝エラー等）
   - スプレッドシートへのリンクボタン
   - 更新ボタン

2. **サマリーカード**
   - 総アイテム数
   - 発注が必要なアイテム数
   - 最終更新日時

3. **在庫一覧**
   - カテゴリ別タブ
   - 各アイテムのステータスバッジ
   - 発注が必要なアイテムは赤くハイライト

4. **保管場所一覧**
   - 品名ごとの保管方法
   - 消費期限の目安

## 制約事項

- **読み取り専用**: ページからスプレッドシートの編集は不可
- **更新間隔**: API呼び出しは手動更新またはページ読み込み時のみ
- **認証**: GASはウェブアプリとして公開（閲覧は誰でも可）
- **データ遅延**: スプレッドシート更新後、数秒でAPIに反映

## セキュリティ

- スプレッドシートのIDはGAS側で管理
- APIエンドポイントはHTTPS
- 編集権限はスプレッドシート側で制御
