/**
 * Cafe Foam 在庫管理 API v2.4
 * Google Apps Script (GAS)
 *
 * =========================================
 * 拡張性ガイド
 * =========================================
 *
 * 【新しい商品を追加する場合】
 * → スプレッドシートに行を追加するだけでOK（コード変更不要）
 *
 * 【新しいカテゴリを追加する場合】
 * → CATEGORY_RULES に新しいカテゴリとキーワードを追加
 * → data.js の INVENTORY_CATEGORY_RULES にも同じ内容を追加
 *
 * 【新しい単位ルールを追加する場合】
 * → UNIT_RULES に新しいパターンと単位を追加
 * → data.js の INVENTORY_UNIT_RULES にも同じ内容を追加
 *
 * =========================================
 * バージョン履歴
 * =========================================
 *
 * v2.4 変更点:
 * - 拡張性を高めるためのリファクタリング
 * - UNIT_RULES をテーブル化（配列ベース）
 * - ドキュメントの充実
 *
 * v2.3 変更点:
 * - 発注判定を「仕入れ状況」列ベースに変更
 * - 完了（緑）、未申請（赤）、仕入れ申請中（オレンジ）の3段階表示
 * - statusType フィールドを追加（'completed', 'pending', 'in_progress'）
 * - inProgressList を追加
 *
 * v2.2 変更点:
 * - 単位推測ロジック（inferUnit）を完全に書き直し
 *
 * v2.1 変更点:
 * - カテゴリ分類ルールを最適化
 *
 * v2.0 変更点:
 * - 「在庫管理」シートを主データソースとして使用
 *
 * =========================================
 * デプロイ手順
 * =========================================
 * 1. https://script.google.com/ にアクセス
 * 2. 「新しいプロジェクト」を作成
 * 3. このコードを貼り付け
 * 4. 「デプロイ」→「新しいデプロイ」
 * 5. 種類: 「ウェブアプリ」
 * 6. 実行ユーザー: 「自分」
 * 7. アクセス: 「全員」
 * 8. デプロイして、ウェブアプリのURLをコピー
 * 9. data.js の INVENTORY_API_URL にURLを設定
 *
 * 更新時は「デプロイ」→「デプロイを管理」→「新しいバージョン」
 */

// =========================================
// 設定セクション
// =========================================

// スプレッドシートID
const SPREADSHEET_ID = '1iuTiIGV0Zz-AMx8aTcKZ0qSfI6kUSnZT4RZnWbgDCB8';

// =========================================
// カテゴリ分類ルール v2.4
// =========================================
// 新しいカテゴリを追加する場合:
// 1. 下記オブジェクトに 'カテゴリ名': ['キーワード1', 'キーワード2'] を追加
// 2. data.js の INVENTORY_CATEGORY_RULES にも同じ内容を追加
//
// 注意: 最初にマッチしたカテゴリが適用されるため、
// 特殊なキーワード（より限定的なもの）を先に定義すること
const CATEGORY_RULES = {
  'コーヒー': ['コーヒー豆', 'エスプレッソ'],
  '乳製品・冷蔵': ['牛乳', 'ホイップクリーム', 'ミルク', '氷'],
  'シロップ・ソース': ['チョコソース', 'キャラメルソース', 'バニラシロップ', 'チャイシロップ', 'ホワイトチョコソース'],
  'パウダー・茶葉': ['抹茶パウダー', 'ほうじ茶パウダー', 'アールグレイ'],
  '消耗品（容器）': ['紙カップ', 'フタ', 'プラカップ', 'プラフタ', 'マドラー', 'ストロー'],
  '消耗品（調味料）': ['シュガー', 'ガムシロップ'],
  '衛生・清掃用品': ['手袋', '消毒液', 'アルコール', 'ペーパータオル', 'スポンジ', '洗剤'],
  'その他': []  // フォールバック（キーワードなし）
};

// =========================================
// 単位推測ルール v2.4
// =========================================
// 新しい単位ルールを追加する場合:
// 1. 下記配列に { pattern: 'キーワード', unit: '単位' } を追加
// 2. data.js の INVENTORY_UNIT_RULES にも同じ内容を追加
//
// 注意: 配列の上から順に評価され、最初にマッチしたルールが適用される
// より限定的なパターンを上に配置すること
const UNIT_RULES = [
  // 優先度1: 商品タイプ（容器単位で数える商品）
  { pattern: 'ソース', unit: '本' },
  { pattern: 'シロップ', unit: '本' },
  { pattern: 'パウダー', unit: '袋' },
  { pattern: '牛乳', unit: '本' },
  { pattern: 'ホイップ', unit: '本' },
  { pattern: 'クリーム', unit: '本' },
  { pattern: '消毒', unit: '本' },
  { pattern: '洗剤', unit: '本' },
  { pattern: 'スプレー', unit: '本' },
  { pattern: '氷', unit: '袋' },
  { pattern: 'パック', unit: '袋' },
  { pattern: 'ティー', unit: '袋' },
  { pattern: 'アールグレイ', unit: '袋' },
  // 優先度2: 包装形態
  { pattern: '個入り', unit: '箱' },
  { pattern: '本入り', unit: '箱' },
  { pattern: '袋', unit: '袋' },
  { pattern: '組', unit: '組' },
  { pattern: '手袋', unit: '箱' },
  // 優先度3: コーヒー豆
  { pattern: 'コーヒー豆', unit: 'g' }
  // 新しいルールはここに追加
];

/**
 * 商品名からカテゴリを自動判定
 * @param {string} itemName - 商品名
 * @returns {string} カテゴリ名
 */
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

/**
 * 単位を商品名から推測 v2.4
 * UNIT_RULES テーブルを使用してパターンマッチング
 * 商品の数え方（本、袋、箱など）を適切に判定
 *
 * @param {string} itemName - 商品名
 * @param {number} value - 数値（現在未使用、将来の拡張用）
 * @returns {string} 単位
 */
function inferUnit(itemName, value) {
  const name = String(itemName).toLowerCase();

  // UNIT_RULES テーブルを上から順に評価
  for (const rule of UNIT_RULES) {
    if (name.includes(rule.pattern.toLowerCase())) {
      return rule.unit;
    }
  }

  // デフォルト単位
  return '個';
}

/**
 * GETリクエストを処理
 * @param {Object} e - リクエストパラメータ
 * @returns {TextOutput} JSON形式のレスポンス
 */
function doGet(e) {
  try {
    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);

    // ===== メインデータソース: 在庫管理シート =====
    const mainSheet = spreadsheet.getSheetByName('在庫管理');
    const mainData = mainSheet.getDataRange().getValues();

    // 在庫管理場所シートからデータを取得（オプション）
    let storageData = [];
    try {
      const storageSheet = spreadsheet.getSheetByName('在庫管理場所');
      if (storageSheet) {
        storageData = storageSheet.getDataRange().getValues();
      }
    } catch (e) {
      // シートが存在しない場合は空配列のまま
    }

    // ===== 在庫管理シートからアイテムを整形 =====
    // 列構造:
    // A(0): 仕入れ品（商品名）
    // B(1): 仕入れ状況（完了等）
    // C(2): 残数
    // D(3): 理想残数
    // E(4): 初期仕入れ数
    // F(5): 仕入れライン（発注点）

    const items = [];
    for (let i = 1; i < mainData.length; i++) {
      const row = mainData[i];
      const itemName = String(row[0] || '').trim();

      // 空行やヘッダー行をスキップ
      if (!itemName || itemName.includes('仕入れ品') || itemName === '') {
        continue;
      }

      const remaining = parseFloat(row[2]) || 0;
      const ideal = parseFloat(row[3]) || 0;
      const initial = parseFloat(row[4]) || 0;
      const orderLine = parseFloat(row[5]) || 0;
      const purchaseStatus = String(row[1] || '').trim();

      // v2.3: 仕入れ状況ベースの判定
      // 完了 → OK（緑）
      // 未申請 → 要発注（赤）
      // 仕入れ申請中 → 申請中（オレンジ）
      const needsOrder = purchaseStatus === '未申請';
      const inProgress = purchaseStatus === '仕入れ申請中';
      const isCompleted = purchaseStatus === '完了';

      // 表示用ステータス
      let status = 'OK';
      let statusType = 'completed'; // completed, pending, in_progress
      if (needsOrder) {
        status = '未申請';
        statusType = 'pending';
      } else if (inProgress) {
        status = '申請中';
        statusType = 'in_progress';
      } else {
        status = '完了';
        statusType = 'completed';
      }

      // 在庫率を計算（理想残数に対する割合）
      const stockRatio = ideal > 0 ? Math.round((remaining / ideal) * 100) : 100;

      // カテゴリを自動判定
      const category = categorizeItem(itemName);

      // 単位を推測
      const unit = inferUnit(itemName, remaining);

      items.push({
        name: itemName,
        category: category,
        remaining: remaining,
        ideal: ideal,
        initial: initial,
        orderLine: orderLine,
        purchaseStatus: purchaseStatus,
        status: status,
        statusType: statusType,      // 'completed', 'pending', 'in_progress'
        needsOrder: needsOrder,       // 未申請かどうか
        inProgress: inProgress,       // 仕入れ申請中かどうか
        stockRatio: stockRatio,
        unit: unit
      });
    }

    // ===== 保管場所情報を整形 =====
    const storage = [];
    for (let i = 1; i < storageData.length; i++) {
      const row = storageData[i];
      if (row[0]) {
        storage.push({
          name: String(row[0]).trim(),
          beforeOpen: String(row[1] || '').trim(),
          afterOpen: String(row[2] || '').trim(),
          location: String(row[3] || '').trim(),
          expiryDays: String(row[4] || '').trim(),
          notes: String(row[5] || '').trim()
        });
      }
    }

    // ===== サマリー情報 =====
    const needsOrderItems = items.filter(item => item.needsOrder);      // 未申請
    const inProgressItems = items.filter(item => item.inProgress);      // 仕入れ申請中
    const completedItems = items.filter(item => item.statusType === 'completed');  // 完了

    const summary = {
      totalItems: items.length,
      needsOrder: needsOrderItems.length,     // 未申請の数
      inProgress: inProgressItems.length,     // 仕入れ申請中の数
      completed: completedItems.length        // 完了の数
    };

    // ===== カテゴリ別にグループ化 =====
    const categories = {};
    items.forEach(item => {
      if (!categories[item.category]) {
        categories[item.category] = [];
      }
      categories[item.category].push(item);
    });

    // カテゴリ内を発注優先でソート
    // カテゴリ内を仕入れ状況優先でソート（未申請→申請中→完了）
    for (const category of Object.keys(categories)) {
      categories[category].sort((a, b) => {
        // 未申請を先に
        if (a.needsOrder && !b.needsOrder) return -1;
        if (!a.needsOrder && b.needsOrder) return 1;
        // 次に申請中
        if (a.inProgress && !b.inProgress) return -1;
        if (!a.inProgress && b.inProgress) return 1;
        // 在庫率が低い順
        return a.stockRatio - b.stockRatio;
      });
    }

    // ===== 未申請アイテムリスト（発注が必要なアイテム） =====
    const orderList = needsOrderItems.map(item => ({
      name: item.name,
      category: item.category,
      remaining: item.remaining,
      orderLine: item.orderLine,
      shortage: item.ideal - item.remaining,
      unit: item.unit,
      statusType: item.statusType
    }));

    // ===== 仕入れ申請中アイテムリスト =====
    const inProgressList = inProgressItems.map(item => ({
      name: item.name,
      category: item.category,
      remaining: item.remaining,
      unit: item.unit,
      statusType: item.statusType
    }));

    const response = {
      success: true,
      timestamp: new Date().toISOString(),
      version: '2.4',
      summary: summary,
      items: items,
      categories: categories,
      orderList: orderList,           // 未申請アイテム
      inProgressList: inProgressList, // 仕入れ申請中アイテム
      storage: storage
    };

    return ContentService
      .createTextOutput(JSON.stringify(response))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    const errorResponse = {
      success: false,
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    };

    return ContentService
      .createTextOutput(JSON.stringify(errorResponse))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * テスト用関数
 */
function testDoGet() {
  const result = doGet({});
  Logger.log(result.getContent());
}

/**
 * スプレッドシートの構造を確認するデバッグ関数
 */
function debugSheetStructure() {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheets = spreadsheet.getSheets();

  sheets.forEach(sheet => {
    Logger.log('Sheet: ' + sheet.getName());
    const data = sheet.getRange(1, 1, 2, 10).getValues();
    Logger.log('Headers: ' + JSON.stringify(data[0]));
    Logger.log('First row: ' + JSON.stringify(data[1]));
  });
}
