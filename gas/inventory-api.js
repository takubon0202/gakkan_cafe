/**
 * Cafe Foam 在庫管理 API v2.0
 * Google Apps Script (GAS)
 *
 * 主な変更点:
 * - 「在庫管理」シートを主データソースとして使用
 * - カテゴリ自動分類機能を追加
 * - 在庫率（残数/理想残数）の計算を追加
 *
 * デプロイ手順:
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

// スプレッドシートID
const SPREADSHEET_ID = '1iuTiIGV0Zz-AMx8aTcKZ0qSfI6kUSnZT4RZnWbgDCB8';

// カテゴリ分類ルール
const CATEGORY_RULES = {
  'コーヒー': ['コーヒー豆', 'エスプレッソ'],
  '乳製品': ['牛乳', 'ホイップクリーム', 'ミルク'],
  'シロップ・ソース': ['チョコソース', 'キャラメルソース', 'バニラシロップ', 'チャイシロップ', 'ホワイトチョコソース'],
  'パウダー・茶葉': ['抹茶パウダー', 'ほうじ茶パウダー', 'アールグレイ'],
  '消耗品（容器）': ['紙カップ', 'フタ', 'プラカップ', 'プラフタ', 'マドラー', 'ストロー'],
  '消耗品（調味料）': ['シュガー', 'ガムシロップ'],
  '衛生用品': ['手袋', '消毒液', 'アルコール', 'ペーパータオル'],
  'その他': []
};

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

  // 特殊ケース
  if (name.includes('氷')) return '乳製品';

  return 'その他';
}

/**
 * 単位を商品名から推測
 * @param {string} itemName - 商品名
 * @param {number} value - 数値
 * @returns {string} 単位
 */
function inferUnit(itemName, value) {
  const name = String(itemName).toLowerCase();

  if (name.includes('g)') || name.includes('g）')) return 'g';
  if (name.includes('ml)') || name.includes('ml）')) return 'ml';
  if (name.includes('l)') || name.includes('l）')) return 'L';
  if (name.includes('個入り')) return '箱';
  if (name.includes('本入り')) return '袋';
  if (name.includes('袋')) return '袋';
  if (name.includes('組')) return '組';

  // 数値から推測
  if (value >= 1000) return 'g';

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

      // 発注判定: 残数が仕入れライン以下なら発注が必要
      const needsOrder = orderLine > 0 && remaining <= orderLine;
      const status = needsOrder ? '発注' : 'OK';

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
        needsOrder: needsOrder,
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
    const needsOrderItems = items.filter(item => item.needsOrder);
    const lowStockItems = items.filter(item => item.stockRatio < 50 && !item.needsOrder);

    const summary = {
      totalItems: items.length,
      needsOrder: needsOrderItems.length,
      lowStock: lowStockItems.length,
      okItems: items.length - needsOrderItems.length - lowStockItems.length
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
    for (const category of Object.keys(categories)) {
      categories[category].sort((a, b) => {
        // 発注が必要なものを先に
        if (a.needsOrder && !b.needsOrder) return -1;
        if (!a.needsOrder && b.needsOrder) return 1;
        // 在庫率が低い順
        return a.stockRatio - b.stockRatio;
      });
    }

    // ===== 発注が必要なアイテムリスト =====
    const orderList = needsOrderItems.map(item => ({
      name: item.name,
      category: item.category,
      remaining: item.remaining,
      orderLine: item.orderLine,
      shortage: item.ideal - item.remaining,
      unit: item.unit
    }));

    const response = {
      success: true,
      timestamp: new Date().toISOString(),
      version: '2.0',
      summary: summary,
      items: items,
      categories: categories,
      orderList: orderList,
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
