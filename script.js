// ===================================
// カフェマニュアル - メインスクリプト
// ===================================

// グローバル変数
let menuData = {};
let cleaningData = {};
let serviceData = {};
let airpayData = {};
let settings = {};

// ===================================
// 初期化
// ===================================

document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

function initializeApp() {
    // データの読み込み
    loadData();

    // イベントリスナーの設定
    setupEventListeners();

    // ナビゲーションの初期化（モバイルでは非表示）
    initializeNavigation();

    // ダッシュボードの更新
    updateDashboard();

    // 設定ページのカレンダー設定を読み込む
    loadCalendarSettings();
}

// ナビゲーションの初期化
function initializeNavigation() {
    const mainNav = document.getElementById('mainNav');
    const navOverlay = document.getElementById('navOverlay');

    // 初期状態では常に閉じている
    mainNav.classList.remove('open');
    navOverlay.classList.remove('active');
}

// ===================================
// データ管理
// ===================================

function loadData() {
    // データバージョンチェック（バージョンが変わったらキャッシュをクリア）
    const savedVersion = localStorage.getItem('DATA_VERSION');
    if (savedVersion !== DATA_VERSION) {
        // バージョンが異なる場合、古いデータをクリアして最新を使用
        localStorage.removeItem(STORAGE_KEYS.MENU_DATA);
        localStorage.removeItem(STORAGE_KEYS.SERVICE_DATA);
        localStorage.removeItem(STORAGE_KEYS.CLEANING_DATA);
        localStorage.setItem('DATA_VERSION', DATA_VERSION);
        console.log('データバージョン更新: ' + DATA_VERSION);
    }

    // メニューデータの読み込み
    const savedMenuData = localStorage.getItem(STORAGE_KEYS.MENU_DATA);
    if (savedMenuData) {
        const stored = JSON.parse(savedMenuData);
        // initialDataをベースにマージ（新しい項目を追加し、既存の編集は維持）
        menuData = {};
        Object.keys(initialData.menu).forEach(menuId => {
            menuData[menuId] = {
                ...initialData.menu[menuId],
                ...(stored[menuId] || {})
            };
        });
        localStorage.setItem(STORAGE_KEYS.MENU_DATA, JSON.stringify(menuData));
    } else {
        menuData = initialData.menu;
    }

    // 清掃データの読み込み
    const savedCleaningData = localStorage.getItem(STORAGE_KEYS.CLEANING_DATA);
    cleaningData = savedCleaningData ? JSON.parse(savedCleaningData) : initialData.cleaning;

    // 提供方法データの読み込み
    const savedServiceData = localStorage.getItem(STORAGE_KEYS.SERVICE_DATA);
    if (savedServiceData) {
        const storedService = JSON.parse(savedServiceData);
        serviceData = {};
        Object.keys(initialData.service).forEach(key => {
            serviceData[key] = {
                ...initialData.service[key],
                ...(storedService[key] || {})
            };
        });

        // 営業時間は最新の初期データを優先（上書き）
        if (initialData.service.hours) {
            serviceData.hours = initialData.service.hours;
        }

        // 重要フィールド（画像・レイアウト）は常に最新の初期データを優先
        if (initialData.service.layout?.image) {
            serviceData.layout.image = initialData.service.layout.image;
        }
        if (initialData.service.hours?.normal?.image) {
            serviceData.hours.normal.image = initialData.service.hours.normal.image;
        }
        if (initialData.service.hours?.holiday?.image) {
            serviceData.hours.holiday.image = initialData.service.hours.holiday.image;
        }
        if (initialData.service.staffing?.image) {
            serviceData.staffing.image = initialData.service.staffing.image;
        }

        localStorage.setItem(STORAGE_KEYS.SERVICE_DATA, JSON.stringify(serviceData));
    } else {
        serviceData = initialData.service;
    }

    // AirPayデータ
    airpayData = initialData.airpay;

    // 設定の読み込み
    const savedSettings = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    settings = savedSettings ? JSON.parse(savedSettings) : defaultSettings;

    // 日付が変わっていたらチェックリストをリセット
    resetDailyChecklist();

    // メニューページをレンダリング
    renderMenuPages();

    // 提供方法ページをレンダリング
    renderServicePage();
    renderCustomerServicePage();
    renderCustomerCautionsPage();

    // トラブルシューティングをレンダリング
    renderTroubleshooting();

    // 衛生マニュアルをレンダリング
    renderHygiene();

    // AirPayマニュアルをレンダリング
    renderAirpay();
}

function saveData() {
    localStorage.setItem(STORAGE_KEYS.MENU_DATA, JSON.stringify(menuData));
    localStorage.setItem(STORAGE_KEYS.CLEANING_DATA, JSON.stringify(cleaningData));
    localStorage.setItem(STORAGE_KEYS.SERVICE_DATA, JSON.stringify(serviceData));
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));

    // 更新履歴を記録
    addUpdateHistory('データを保存しました');
}

function resetDailyChecklist() {
    const today = new Date().toDateString();
    const lastReset = localStorage.getItem('lastChecklistReset');

    if (lastReset !== today) {
        // 日次清掃のチェックをリセット
        if (cleaningData.daily && cleaningData.daily.tasks) {
            cleaningData.daily.tasks.forEach(task => {
                task.completed = false;
                task.completedAt = null;
            });
            saveData();
        }
        localStorage.setItem('lastChecklistReset', today);
    }
}

// ===================================
// イベントリスナー
// ===================================

function setupEventListeners() {
    // ナビゲーションリンク
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const page = e.currentTarget.dataset.page;
            showPage(page);
            closeMenu();
        });
    });

    // メニューボタン
    document.querySelectorAll('.menu-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const page = e.currentTarget.dataset.page;
            showPage(page);
        });
    });

    // メニュートグル（サイドバー）
    const menuToggle = document.getElementById('menuToggle');
    const mainNav = document.getElementById('mainNav');
    const navOverlay = document.getElementById('navOverlay');

    // メニュー開閉関数
    function toggleMenu() {
        const isOpening = !mainNav.classList.contains('open');

        menuToggle.classList.toggle('active');
        mainNav.classList.toggle('open');
        navOverlay.classList.toggle('active');

        // アクセシビリティ対応
        menuToggle.setAttribute('aria-expanded', isOpening);
        menuToggle.setAttribute('aria-label', isOpening ? 'メニューを閉じる' : 'メニューを開く');
    }

    menuToggle.addEventListener('click', toggleMenu);

    // オーバーレイクリックで閉じる
    navOverlay.addEventListener('click', closeMenu);

    // ESCキーで閉じる
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && mainNav.classList.contains('open')) {
            closeMenu();
        }
    });

    // ヘッダータイトルクリックでホームに戻る
    const headerTitle = document.getElementById('headerTitle');
    if (headerTitle) {
        headerTitle.addEventListener('click', () => {
            showPage('dashboard');
            closeMenu();
        });
    }

    // タブ切り替え
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const tab = e.currentTarget.dataset.tab;
            switchTab(tab);
        });
    });

    // 画像モーダル
    const modal = document.getElementById('imageModal');
    const closeBtn = modal.querySelector('.close');
    closeBtn.addEventListener('click', () => {
        modal.style.display = 'none';
    });

    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    });

    // 編集モード
    const editModeToggle = document.getElementById('editMode');
    if (editModeToggle) {
        editModeToggle.checked = settings.editMode;
        editModeToggle.addEventListener('change', (e) => {
            settings.editMode = e.target.checked;
            saveData();
        });
    }
}

// メニュー閉じる関数（グローバル）
function closeMenu() {
    const menuToggle = document.getElementById('menuToggle');
    const mainNav = document.getElementById('mainNav');
    const navOverlay = document.getElementById('navOverlay');

    if (menuToggle) menuToggle.classList.remove('active');
    if (mainNav) mainNav.classList.remove('open');
    if (navOverlay) navOverlay.classList.remove('active');
    if (menuToggle) {
        menuToggle.setAttribute('aria-expanded', 'false');
        menuToggle.setAttribute('aria-label', 'メニューを開く');
    }
}

// ===================================
// ナビゲーション
// ===================================

// ナビゲーションカテゴリーの折りたたみ切り替え
function toggleNavCategory(header) {
    const category = header.parentElement;
    category.classList.toggle('collapsed');
}

function showPage(pageId) {
    // すべてのページを非表示
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });

    // 指定されたページを表示
    const targetPage = document.getElementById(pageId);
    if (targetPage) {
        targetPage.classList.add('active');
    }

    // ナビゲーションのアクティブ状態を更新
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
        if (link.dataset.page === pageId) {
            link.classList.add('active');
        }
    });

    // ページトップにスクロール
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// メニュー一覧ページを表示
function showMenuList() {
    showPage('menu-list');
}

// 後方互換性のためのnavigateToPage関数
function navigateToPage(pageId) {
    showPage(pageId);
}

// ===================================
// ダッシュボード
// ===================================

function updateDashboard() {
    const dailyTasks = cleaningData.daily?.tasks || [];
    const completedTasks = dailyTasks.filter(task => task.completed).length;
    const totalTasks = dailyTasks.length;

    const completedCountEl = document.getElementById('completedCount');
    const totalCountEl = document.getElementById('totalCount');

    if (completedCountEl) completedCountEl.textContent = completedTasks;
    if (totalCountEl) totalCountEl.textContent = totalTasks;
}

// ===================================
// メニューページのレンダリング
// ===================================

function renderMenuPages() {
    Object.keys(menuData).forEach(menuId => {
        const menu = menuData[menuId];
        const contentDiv = document.getElementById(`${menuId}Content`);

        if (!contentDiv) return;

        let html = '';

        // 注意事項セクション
        if (menu.warnings && menu.warnings.length > 0) {
            html += '<div class="warnings-section">';
            html += '<h3><i class="fas fa-exclamation-triangle"></i> 注意事項</h3>';
            html += '<ul class="warnings-list">';
            menu.warnings.forEach(warning => {
                html += `<li>${warning}</li>`;
            });
            html += '</ul>';
            html += '</div>';
        }

        // 材料セクション
        html += '<div class="ingredients-section">';
        html += '<h3><i class="fas fa-shopping-basket"></i> 材料</h3>';
        html += '<ul class="ingredients-list">';
        menu.ingredients.forEach(ingredient => {
            html += `<li>${ingredient}</li>`;
        });
        html += '</ul>';
        html += '</div>';

        // 器具セクション
        html += '<div class="equipment-section">';
        html += '<h3><i class="fas fa-tools"></i> 必要な器具</h3>';
        html += '<ul class="equipment-list">';
        menu.equipment.forEach(equipment => {
            html += `<li>${equipment}</li>`;
        });
        html += '</ul>';
        html += '</div>';

        // アレルゲンセクション
        if (menu.allergens && menu.allergens.length > 0) {
            html += '<div class="allergens-section">';
            html += '<h3><i class="fas fa-exclamation-circle"></i> アレルゲン</h3>';
            html += '<ul class="allergens-list">';
            menu.allergens.forEach(allergen => {
                html += `<li>${allergen}</li>`;
            });
            html += '</ul>';
            html += '</div>';
        }

        // ステップセクション
        html += '<div class="steps-section">';
        html += '<h3><i class="fas fa-list-ol"></i> 作り方</h3>';
        menu.steps.forEach(step => {
            html += renderStep(step);
        });
        html += '</div>';

        // トラブルシューティング
        if (menu.troubleshooting && menu.troubleshooting.length > 0) {
            html += '<div class="troubleshooting-section">';
            html += '<h3><i class="fas fa-question-circle"></i> よくある問題と対処法</h3>';
            menu.troubleshooting.forEach(item => {
                html += '<div class="troubleshooting-item">';
                html += `<div class="problem"><i class="fas fa-exclamation-circle"></i> ${item.problem}</div>`;
                html += `<div class="solution"><strong>解決策:</strong> ${item.solution}</div>`;
                html += '</div>';
            });
            html += '</div>';
        }

        // 品質基準セクション
        if (menu.qualityStandards && menu.qualityStandards.length > 0) {
            html += '<div class="quality-section">';
            html += '<h3><i class="fas fa-star"></i> 品質基準</h3>';
            html += '<ul class="quality-list">';
            menu.qualityStandards.forEach(standard => {
                html += `<li>${standard}</li>`;
            });
            html += '</ul>';
            html += '</div>';
        }

        // バリエーションセクション
        if (menu.variations && menu.variations.length > 0) {
            html += '<div class="variations-section">';
            html += '<h3><i class="fas fa-magic"></i> バリエーション</h3>';
            html += '<ul class="variations-list">';
            menu.variations.forEach(variation => {
                html += `<li>${variation}</li>`;
            });
            html += '</ul>';
            html += '</div>';
        }

        // 清掃セクション
        if (menu.cleaning && menu.cleaning.length > 0) {
            html += '<div class="cleaning-section">';
            html += '<h3><i class="fas fa-broom"></i> 清掃・お手入れ</h3>';
            html += '<ul class="cleaning-list">';
            menu.cleaning.forEach(cleanItem => {
                html += `<li>${cleanItem}</li>`;
            });
            html += '</ul>';
            html += '</div>';
        }

        // 参照セクション
        if (menu.references && menu.references.length > 0) {
            html += '<div class="references-section">';
            html += '<h3><i class="fas fa-book"></i> 参照</h3>';
            html += '<ul class="references-list">';
            menu.references.forEach(reference => {
                html += `<li>${reference}</li>`;
            });
            html += '</ul>';
            html += '</div>';
        }

        contentDiv.innerHTML = html;

        // 画像クリックイベントを追加
        contentDiv.querySelectorAll('.step-image').forEach(img => {
            img.addEventListener('click', () => {
                showImageModal(img.src, img.alt);
            });
        });
    });
}

function renderStep(step) {
    let html = '<div class="step">';
    html += '<div class="step-header">';
    html += `<div class="step-number">${step.number}</div>`;
    html += `<div class="step-title">${step.title}</div>`;
    html += '</div>';
    html += '<div class="step-content">';
    html += `<div class="step-description">${step.description}</div>`;

    // ヒント
    if (step.tips && step.tips.length > 0) {
        html += '<div class="step-tips">';
        html += '<h4><i class="fas fa-lightbulb"></i> ポイント</h4>';
        html += '<ul>';
        step.tips.forEach(tip => {
            html += `<li>${tip}</li>`;
        });
        html += '</ul>';
        html += '</div>';
    }

    html += '</div>';
    html += '</div>';
    return html;
}

// ===================================
// タブ切り替え
// ===================================

function switchTab(tabName) {
    // タブボタンのアクティブ状態を更新
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.tab === tabName) {
            btn.classList.add('active');
        }
    });

    // タブコンテンツの表示切り替え
    document.querySelectorAll('.tab-pane').forEach(pane => {
        pane.classList.remove('active');
    });
    const targetPane = document.getElementById(`${tabName}-tab`);
    if (targetPane) {
        targetPane.classList.add('active');
    }
}

// ===================================
// 画像表示
// ===================================

function showImageModal(src, alt) {
    const modal = document.getElementById('imageModal');
    const modalImg = document.getElementById('modalImage');
    const caption = document.getElementById('caption');

    modal.style.display = 'block';
    modalImg.src = src;
    caption.textContent = alt;
}

// ===================================
// トラブルシューティング
// ===================================

function renderTroubleshooting() {
    const container = document.getElementById('troubleshootingContent');
    if (!container) return;

    let html = '';

    initialData.troubleshooting.forEach(item => {
        html += '<div class="troubleshooting-item">';
        html += `<h3><i class="fas fa-exclamation-triangle"></i> ${item.title}</h3>`;
        html += `<div class="problem"><strong>問題:</strong> ${item.problem}</div>`;
        html += '<div class="solution">';
        html += '<strong>解決策:</strong>';
        html += '<ul>';
        item.solutions.forEach(solution => {
            html += `<li>${solution}</li>`;
        });
        html += '</ul>';
        html += '</div>';
        html += '</div>';
    });

    container.innerHTML = html;
}

// ===================================
// AirPay マニュアル
// ===================================

function renderAirpay() {
    const container = document.getElementById('airpayContent');
    if (!container || !airpayData) return;

    let html = '';

    if (airpayData.title) {
        html += `<h3>${airpayData.title}</h3>`;
    }

    if (airpayData.device) {
        html += `<p><strong>使用機器:</strong> ${airpayData.device}</p>`;
    }

    if (airpayData.methods && airpayData.methods.length > 0) {
        html += '<div class="service-section">';
        html += '<h4><i class="fas fa-cash-register"></i> 決済手順</h4>';
        airpayData.methods.forEach(method => {
            html += '<div class="flow-notes">';
            html += `<strong>${method.name}</strong>`;
            if (method.steps) {
                html += '<ol>';
                method.steps.forEach(step => {
                    html += `<li>${step}</li>`;
                });
                html += '</ol>';
            }
            if (method.notes && method.notes.length) {
                html += '<ul>';
                method.notes.forEach(note => {
                    html += `<li>${note}</li>`;
                });
                html += '</ul>';
            }
            html += '</div>';
        });
        html += '</div>';
    }

    if (airpayData.videos && airpayData.videos.length > 0) {
        html += '<div class="service-section">';
        html += '<h4><i class="fas fa-video"></i> 公式動画</h4>';
        html += '<div class="video-grid">';
        airpayData.videos.forEach(video => {
            const videoId = video.videoId || null;
            html += '<div class="service-figure">';
            if (videoId) {
                const thumb = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
                html += `<a class="video-thumb" href="https://www.youtube.com/watch?v=${videoId}" target="_blank" rel="noopener">`;
                html += `<div class="thumb-image" style="background-image:url('${thumb}')"></div>`;
                html += `<div class="thumb-overlay"><i class="fas fa-play-circle"></i><span>別タブで再生</span></div>`;
                html += `</a>`;
            } else {
                html += `<p><a href="${video.url}" target="_blank" rel="noopener">動画リンクを開く</a></p>`;
            }
            html += '</div>';
        });
        html += '</div>';
        html += '</div>';
    }

    if (airpayData.checklist && airpayData.checklist.length > 0) {
        html += '<div class="service-section">';
        html += '<h4><i class="fas fa-clipboard-check"></i> 動画視聴後チェックリスト</h4>';
        html += '<ul>';
        airpayData.checklist.forEach(item => {
            html += `<li>${item}</li>`;
        });
        html += '</ul>';
        html += '</div>';
    }

    if (airpayData.cautions && airpayData.cautions.length > 0) {
        html += '<div class="service-section">';
        html += '<h4><i class="fas fa-exclamation-triangle"></i> 注意事項</h4>';
        html += '<ul>';
        airpayData.cautions.forEach(item => {
            html += `<li>${item}</li>`;
        });
        html += '</ul>';
        html += '</div>';
    }

    if (airpayData.troubles && airpayData.troubles.length > 0) {
        html += '<div class="service-section">';
        html += '<h4><i class="fas fa-tools"></i> トラブル対応</h4>';
        html += '<ul>';
        airpayData.troubles.forEach(item => {
            html += `<li>${item}</li>`;
        });
        html += '</ul>';
        html += '</div>';
    }

    container.innerHTML = html;
}

// ===================================
// 設定
// ===================================

function backupData() {
    const backup = {
        menu: menuData,
        cleaning: cleaningData,
        settings: settings,
        timestamp: new Date().toISOString()
    };

    const dataStr = JSON.stringify(backup, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `cafe-manual-backup-${Date.now()}.json`;
    link.click();

    URL.revokeObjectURL(url);

    alert('バックアップが完了しました');
}

function restoreData() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';

    input.onchange = (e) => {
        const file = e.target.files[0];
        const reader = new FileReader();

        reader.onload = (event) => {
            try {
                const backup = JSON.parse(event.target.result);

                if (backup.menu) menuData = backup.menu;
                if (backup.cleaning) cleaningData = backup.cleaning;
                if (backup.settings) settings = backup.settings;

                saveData();
                location.reload();
            } catch (error) {
                alert('バックアップファイルの読み込みに失敗しました');
            }
        };

        reader.readAsText(file);
    };

    input.click();
}

function addUpdateHistory(message) {
    const history = JSON.parse(localStorage.getItem(STORAGE_KEYS.UPDATE_HISTORY) || '[]');
    history.unshift({
        message,
        timestamp: new Date().toISOString()
    });

    // 最新50件まで保存
    if (history.length > 50) {
        history.splice(50);
    }

    localStorage.setItem(STORAGE_KEYS.UPDATE_HISTORY, JSON.stringify(history));
    renderUpdateHistory();
}

function renderUpdateHistory() {
    const container = document.getElementById('updateHistory');
    if (!container) return;

    const history = JSON.parse(localStorage.getItem(STORAGE_KEYS.UPDATE_HISTORY) || '[]');

    if (history.length === 0) {
        container.innerHTML = '<p>履歴がありません</p>';
        return;
    }

    let html = '<ul style="list-style: none; padding: 0;">';
    history.slice(0, 10).forEach(item => {
        const date = new Date(item.timestamp);
        html += `<li style="padding: 0.5rem 0; border-bottom: 1px solid #ddd;">`;
        html += `<small>${date.toLocaleString('ja-JP')}</small><br>`;
        html += item.message;
        html += '</li>';
    });
    html += '</ul>';

    container.innerHTML = html;
}

// ============================================
// カレンダー関連の機能（埋め込みコード版）
// ============================================

/**
 * カレンダー設定を保存
 */
function saveCalendarSettings() {
    const embedCode = document.getElementById('calendarEmbedCode').value.trim();
    const statusDiv = document.getElementById('calendarSaveStatus');

    if (!embedCode) {
        statusDiv.innerHTML = '<p style="color: #f44336;">⚠️ 埋め込みコードを入力してください</p>';
        return;
    }

    // iframeタグの基本的な検証
    if (!embedCode.includes('<iframe') || !embedCode.includes('</iframe>')) {
        statusDiv.innerHTML = '<p style="color: #f44336;">⚠️ 有効なiframe埋め込みコードを入力してください</p>';
        return;
    }

    try {
        // LocalStorageに保存
        localStorage.setItem(STORAGE_KEYS.CALENDAR_EMBED, embedCode);

        // 成功メッセージを表示
        statusDiv.innerHTML = '<p style="color: #4caf50;">✓ カレンダー設定を保存しました</p>';

        // 更新履歴に記録
        addUpdateHistory('カレンダーの設定を更新しました');

        // 3秒後にメッセージを消す
        setTimeout(() => {
            statusDiv.innerHTML = '';
        }, 3000);
    } catch (error) {
        console.error('カレンダー設定の保存に失敗:', error);
        statusDiv.innerHTML = '<p style="color: #f44336;">⚠️ 保存に失敗しました</p>';
    }
}

/**
 * カレンダー設定をクリア
 */
function clearCalendarSettings() {
    if (!confirm('カレンダー設定を削除してもよろしいですか？')) {
        return;
    }

    const statusDiv = document.getElementById('calendarSaveStatus');

    try {
        // LocalStorageから削除
        localStorage.removeItem(STORAGE_KEYS.CALENDAR_EMBED);

        // テキストエリアをクリア
        document.getElementById('calendarEmbedCode').value = '';

        // 成功メッセージを表示
        statusDiv.innerHTML = '<p style="color: #4caf50;">✓ カレンダー設定を削除しました</p>';

        // 更新履歴に記録
        addUpdateHistory('カレンダーの設定を削除しました');

        // 3秒後にメッセージを消す
        setTimeout(() => {
            statusDiv.innerHTML = '';
        }, 3000);
    } catch (error) {
        console.error('カレンダー設定の削除に失敗:', error);
        statusDiv.innerHTML = '<p style="color: #f44336;">⚠️ 削除に失敗しました</p>';
    }
}

/**
 * カレンダー設定を読み込んでテキストエリアに表示
 */
function loadCalendarSettings() {
    const embedCode = localStorage.getItem(STORAGE_KEYS.CALENDAR_EMBED);
    const textarea = document.getElementById('calendarEmbedCode');

    if (textarea && embedCode) {
        textarea.value = embedCode;
    }
}

// ===================================
// 提供方法マニュアル
// ===================================

function renderServicePage() {
    const container = document.getElementById('serviceContent');
    if (!container || !serviceData) return;

    let html = '';

    // 概要
    if (serviceData.overview) {
        html += '<div class="service-section">';
        html += `<h3><i class="fas fa-info-circle"></i> ${serviceData.overview.title}</h3>`;
        html += '<ul>';
        serviceData.overview.content.forEach(item => {
            html += `<li>${item}</li>`;
        });
        html += '</ul>';
        html += '</div>';
    }

    // 店内動線・レイアウト
    if (serviceData.layout) {
        html += '<div class="service-section">';
        html += `<h3><i class="fas fa-route"></i> ${serviceData.layout.title}</h3>`;
        if (serviceData.layout.image) {
            html += `<div class="service-figure"><img src="${serviceData.layout.image}" alt="店内動線・レイアウト" class="responsive-img"></div>`;
        }
        if (serviceData.layout.seats) {
            html += '<h4>座席構成</h4><ul>';
            serviceData.layout.seats.forEach(item => {
                html += `<li>${item}</li>`;
            });
            html += '</ul>';
        }
        if (serviceData.layout.flow) {
            html += '<h4>動線</h4><ul>';
            serviceData.layout.flow.forEach(item => {
                html += `<li>${item}</li>`;
            });
            html += '</ul>';
        }
        if (serviceData.layout.notes) {
            html += '<h4>補足</h4><ul>';
            serviceData.layout.notes.forEach(item => {
                html += `<li>${item}</li>`;
            });
            html += '</ul>';
        }
        html += '</div>';
    }

    // 営業時間
    if (serviceData.hours) {
        html += '<div class="service-section">';
        html += `<h3><i class="fas fa-clock"></i> ${serviceData.hours.title}</h3>`;
        const renderHoursTable = (block) => {
            html += `<h4>${block.label}</h4>`;
            html += '<table class="congestion-table"><thead><tr><th>曜日</th><th>時間</th><th>時間数</th></tr></thead><tbody>';
            block.rows.forEach(row => {
                html += `<tr><td>${row.day}</td><td>${row.time}</td><td>${row.hours}</td></tr>`;
            });
            html += '</tbody></table>';
            if (block.image) {
                html += `<div class="service-figure"><img src="${block.image}" alt="${block.label}" class="responsive-img"></div>`;
            }
        };
        if (serviceData.hours.normal) renderHoursTable(serviceData.hours.normal);
        if (serviceData.hours.holiday) renderHoursTable(serviceData.hours.holiday);
        html += '</div>';
    }

    // 店舗運営・シフト
    if (serviceData.staffing) {
        html += '<div class="service-section">';
        html += `<h3><i class="fas fa-users-cog"></i> ${serviceData.staffing.title}</h3>`;
        if (serviceData.staffing.image) {
            html += `<div class="service-figure"><img src="${serviceData.staffing.image}" alt="店舗運営シフト" class="responsive-img"></div>`;
        }
        if (serviceData.staffing.summary) {
            html += '<ul>';
            serviceData.staffing.summary.forEach(item => {
                html += `<li>${item}</li>`;
            });
            html += '</ul>';
        }
        if (serviceData.staffing.notes) {
            html += '<h4>運用メモ</h4><ul>';
            serviceData.staffing.notes.forEach(item => {
                html += `<li>${item}</li>`;
            });
            html += '</ul>';
        }
        html += '</div>';
    }

    // 設備配置
    if (serviceData.facilities) {
        html += '<div class="service-section">';
        html += `<h3><i class="fas fa-map-marked-alt"></i> ${serviceData.facilities.title}</h3>`;
        html += '<table class="facilities-table">';
        html += '<thead><tr><th>設備</th><th>数量</th><th>設置場所</th><th>備考</th></tr></thead>';
        html += '<tbody>';
        serviceData.facilities.items.forEach(item => {
            html += '<tr>';
            html += `<td>${item.equipment}</td>`;
            html += `<td>${item.quantity}</td>`;
            html += `<td>${item.location}</td>`;
            html += `<td>${item.notes}</td>`;
            html += '</tr>';
        });
        html += '</tbody>';
        html += '</table>';
        if (serviceData.facilities.flowNotes) {
            html += '<ul class="flow-notes">';
            serviceData.facilities.flowNotes.forEach(note => {
                html += `<li>${note}</li>`;
            });
            html += '</ul>';
        }
        html += '</div>';
    }

    // 役割分担
    if (serviceData.roles) {
        html += '<div class="service-section">';
        html += `<h3><i class="fas fa-users"></i> ${serviceData.roles.title}</h3>`;
        serviceData.roles.staff.forEach(staff => {
            html += '<div class="role-card">';
            html += `<h4>${staff.position}</h4>`;
            html += '<ul>';
            staff.responsibilities.forEach(resp => {
                html += `<li>${resp}</li>`;
            });
            html += '</ul>';
            html += '</div>';
        });
        html += '</div>';
    }

    // 番号札運用
    if (serviceData.numberTag) {
        html += '<div class="service-section">';
        html += `<h3><i class="fas fa-ticket-alt"></i> ${serviceData.numberTag.title}</h3>`;
        serviceData.numberTag.flow.forEach(item => {
            html += '<div class="flow-step">';
            html += `<strong>${item.step}</strong>`;
            html += `<p>${item.description}</p>`;
            html += '</div>';
        });
        if (serviceData.numberTag.notes) {
            html += '<div class="notes">';
            html += '<strong>注意点:</strong><ul>';
            serviceData.numberTag.notes.forEach(note => {
                html += `<li>${note}</li>`;
            });
            html += '</ul></div>';
        }
        html += '</div>';
    }

    // トレー運用
    if (serviceData.tray) {
        html += '<div class="service-section">';
        html += `<h3><i class="fas fa-clipboard-list"></i> ${serviceData.tray.title}</h3>`;
        serviceData.tray.operations.forEach(op => {
            html += '<div class="operation-card">';
            html += `<h4>${op.action}</h4>`;
            html += `<p>${op.procedure}</p>`;
            html += `<p class="tips"><i class="fas fa-lightbulb"></i> ${op.tips}</p>`;
            html += '</div>';
        });
        if (serviceData.tray.expression) {
            html += `<p class="expression">${serviceData.tray.expression}</p>`;
        }
        html += '</div>';
    }

    // 返却口運用
    if (serviceData.returnCounter) {
        html += '<div class="service-section">';
        html += `<h3><i class="fas fa-undo"></i> ${serviceData.returnCounter.title}</h3>`;
        html += '<div class="subsection">';
        html += '<h4>設置</h4><ul>';
        serviceData.returnCounter.setup.forEach(item => {
            html += `<li>${item}</li>`;
        });
        html += '</ul></div>';
        html += '<div class="subsection">';
        html += '<h4>運用</h4><ul>';
        serviceData.returnCounter.operations.forEach(item => {
            html += `<li>${item}</li>`;
        });
        html += '</ul></div>';
        html += '<div class="subsection">';
        html += '<h4>混雑時</h4><ul>';
        serviceData.returnCounter.congestion.forEach(item => {
            html += `<li>${item}</li>`;
        });
        html += '</ul></div>';
        html += '</div>';
    }

    // フロー（来店〜退店）
    if (serviceData.flow) {
        html += '<div class="service-section">';
        html += `<h3><i class="fas fa-route"></i> ${serviceData.flow.title}</h3>`;
        html += '<ol class="flow-list">';
        serviceData.flow.steps.forEach(step => {
            html += `<li><strong>${step.action}</strong>: ${step.detail}</li>`;
        });
        html += '</ol>';

        // Mermaidダイアグラム
        if (serviceData.flow.mermaid) {
            html += '<div class="mermaid-container">';
            html += '<h4>フローチャート</h4>';
            html += '<pre class="mermaid">' + serviceData.flow.mermaid + '</pre>';
            html += '</div>';
        }

        if (serviceData.flow.notes) {
            html += '<div class="notes">';
            html += '<strong>注記:</strong><ul>';
            serviceData.flow.notes.forEach(note => {
                html += `<li>${note}</li>`;
            });
            html += '</ul></div>';
        }
        html += '</div>';
    }

    // 安全・衛生
    if (serviceData.safety) {
        html += '<div class="service-section">';
        html += `<h3><i class="fas fa-shield-alt"></i> ${serviceData.safety.title}</h3>`;
        serviceData.safety.items.forEach(item => {
            html += '<div class="safety-card">';
            html += `<h4>${item.category}</h4>`;
            html += '<ul>';
            item.measures.forEach(measure => {
                html += `<li>${measure}</li>`;
            });
            html += '</ul>';
            html += '</div>';
        });
        html += '</div>';
    }

    // 混雑時の運用
    if (serviceData.congestion) {
        html += '<div class="service-section">';
        html += `<h3><i class="fas fa-exclamation-triangle"></i> ${serviceData.congestion.title}</h3>`;
        html += '<table class="congestion-table">';
        html += '<thead><tr><th>状況</th><th>対応</th></tr></thead>';
        html += '<tbody>';
        serviceData.congestion.scenarios.forEach(scenario => {
            html += '<tr>';
            html += `<td>${scenario.situation}</td>`;
            html += `<td>${scenario.action}</td>`;
            html += '</tr>';
        });
        html += '</tbody>';
        html += '</table>';
        html += '</div>';
    }

    // 掲示物・サイン
    if (serviceData.signage) {
        html += '<div class="service-section">';
        html += `<h3><i class="fas fa-sign"></i> ${serviceData.signage.title}</h3>`;
        serviceData.signage.signs.forEach(sign => {
            html += '<div class="sign-card">';
            html += `<h4>${sign.location}</h4>`;
            html += `<pre class="sign-text">${sign.text}</pre>`;
            html += '</div>';
        });
        html += '</div>';
    }

    // チェックリスト
    if (serviceData.checklist) {
        html += '<div class="service-section">';
        html += `<h3><i class="fas fa-tasks"></i> ${serviceData.checklist.title}</h3>`;
        serviceData.checklist.periods.forEach(period => {
            html += '<div class="checklist-period">';
            html += `<h4>${period.period}</h4>`;
            html += '<ul class="checklist">';
            period.items.forEach(item => {
                html += `<li><input type="checkbox"> ${item}</li>`;
            });
            html += '</ul>';
            html += '</div>';
        });
        html += '</div>';
    }

    container.innerHTML = html;

    // Mermaid図を初期化（CDNが読み込まれている場合）
    if (typeof mermaid !== 'undefined') {
        mermaid.init(undefined, document.querySelectorAll('.mermaid'));
    }
}

// 接客方法ページ（独立ページ）
function renderCustomerServicePage() {
    const container = document.getElementById('customerServiceContent');
    if (!container || !serviceData || !serviceData.customerService) return;

    const cs = serviceData.customerService;
    let html = '';

    // 接客フローを画像カードで表示
    if (cs.flow && cs.flow.length) {
        html += '<div class="service-section">';
        html += '<h3><i class="fas fa-route"></i> 接客フロー（基本）</h3>';
        html += '<div class="service-flow-grid">';
        cs.flow.forEach(item => {
            // オブジェクト形式か文字列形式かを判定
            if (typeof item === 'object' && item.title) {
                html += `
                    <div class="service-flow-card" data-id="${item.id || ''}">
                        <div class="service-flow-image">
                            ${item.image ? `<img src="${item.image}" alt="${item.alt || item.title}" loading="lazy" onerror="this.parentElement.classList.add('image-error')">` : ''}
                            <div class="image-placeholder">
                                <i class="fas fa-image"></i>
                                <span>STEP ${item.step}</span>
                            </div>
                        </div>
                        <div class="service-flow-content">
                            <span class="step-badge">STEP ${item.step}</span>
                            <h4 class="flow-title">${item.title}</h4>
                            <p class="flow-description">${item.description}</p>
                        </div>
                    </div>
                `;
            } else if (typeof item === 'string') {
                // 旧形式（文字列）の場合はリストで表示
                html += `<div class="service-flow-card legacy"><div class="service-flow-content"><p>${item}</p></div></div>`;
            }
        });
        html += '</div></div>';
    }

    if (cs.basics && cs.basics.length) {
        html += '<div class="service-section">';
        html += '<h3><i class="fas fa-smile"></i> 接客の基本姿勢</h3><ul>';
        cs.basics.forEach(item => {
            html += `<li>${item}</li>`;
        });
        html += '</ul></div>';
    }

    container.innerHTML = html;
}

// 接客の注意ページ（独立ページ）
function renderCustomerCautionsPage() {
    const container = document.getElementById('customerCautionsContent');
    if (!container || !serviceData || !serviceData.customerService) return;

    const cautions = serviceData.customerService.cautions || {};
    let html = '';

    // NG行動は画像付きカードで表示
    if (cautions.ng && cautions.ng.length) {
        html += '<div class="service-section">';
        html += '<h3><i class="fas fa-ban"></i> 接客時のNG行動</h3>';
        html += '<div class="ng-behavior-grid">';
        cautions.ng.forEach(item => {
            // オブジェクト形式か文字列形式かを判定
            if (typeof item === 'object' && item.text) {
                html += `
                    <div class="ng-behavior-card" data-id="${item.id || ''}">
                        <div class="ng-behavior-image">
                            ${item.image ? `<img src="${item.image}" alt="${item.alt || item.text}" loading="lazy" onerror="this.parentElement.classList.add('image-error')">` : ''}
                            <div class="image-placeholder ng-placeholder">
                                <i class="fas fa-ban"></i>
                                <span>NG</span>
                            </div>
                        </div>
                        <div class="ng-behavior-content">
                            <span class="ng-badge">NG</span>
                            <p>${item.text}</p>
                        </div>
                    </div>
                `;
            } else if (typeof item === 'string') {
                // 旧形式（文字列）の場合はリストで表示
                html += `<div class="ng-behavior-card"><div class="ng-behavior-content"><span class="ng-badge">NG</span><p>${item}</p></div></div>`;
            }
        });
        html += '</div></div>';
    }

    // 他のカテゴリはリスト形式で表示
    const blocks = [
        ['衛生・身だしなみの注意', cautions.hygiene, 'fa-hand-sparkles'],
        ['オーダー・提供時の注意', cautions.order, 'fa-clipboard-check'],
        ['クレーム・トラブル対応の注意', cautions.claim, 'fa-exclamation-triangle'],
    ];

    blocks.forEach(([title, list, icon]) => {
        if (!list || !list.length) return;
        html += '<div class="service-section">';
        html += `<h3><i class="fas ${icon}"></i> ${title}</h3><ul>`;
        list.forEach(item => {
            html += `<li>${item}</li>`;
        });
        html += '</ul></div>';
    });

    container.innerHTML = html;
}

// ===================================
// 衛生マニュアル
// ===================================

function renderHygiene() {
    renderStaffHygiene();
    renderManagerHygiene();
    renderHealthCheck();

    // Mermaidがあれば衛生セクションの図を初期化（描画後に実行）
    if (typeof mermaid !== 'undefined') {
        setTimeout(() => mermaid.init(undefined, document.querySelectorAll('.mermaid')), 0);
    }
}

function renderStaffHygiene() {
    const container = document.getElementById('staffHygieneContent');
    if (!container) return;

    const data = initialData.hygiene.staff;
    let html = '';

    // タイトルとサブタイトル
    html += `<div class="hygiene-header">`;
    html += `<h3>${data.title}</h3>`;
    html += `<p class="hygiene-subtitle">${data.subtitle}</p>`;
    html += `</div>`;

    // セクション
    data.sections.forEach(section => {
        html += `<div class="hygiene-item">`;
        html += `<h4><i class="fas fa-clipboard-check"></i> ${section.title}</h4>`;

        if (section.items) {
            html += '<ul>';
            section.items.forEach(item => {
                html += `<li>${item}</li>`;
            });
            html += '</ul>';
        }

        if (section.subsections) {
            section.subsections.forEach(subsection => {
                html += `<div class="hygiene-subsection">`;
                html += `<h5>${subsection.subtitle}</h5>`;
                html += '<ul>';
                subsection.items.forEach(item => {
                    html += `<li>${item}</li>`;
                });
                html += '</ul>';
                html += '</div>';
            });
        }

        if (section.diagram) {
            html += '<div class="mermaid-container">';
            html += `<h5>フロー</h5>`;
            html += `<pre class="mermaid">${section.diagram}</pre>`;
            html += '</div>';
        }

        html += '</div>';
    });

    container.innerHTML = html;
}

function renderHealthCheck() {
    const container = document.getElementById('healthCheckContent');
    if (!container) return;

    const data = initialData.hygiene.healthCheck;
    if (!data) return;

    let html = '';

    html += `<div class="hygiene-header">`;
    html += `<h3>${data.title}</h3>`;
    if (data.subtitle) {
        html += `<p class="hygiene-subtitle">${data.subtitle}</p>`;
    }
    html += `</div>`;

    if (data.form?.fields) {
        html += '<div class="hygiene-item">';
        html += '<h4><i class="fas fa-list"></i> 基本項目</h4><ul>';
        data.form.fields.forEach(f => {
            html += `<li>${f}</li>`;
        });
        html += '</ul></div>';
    }

    if (data.form?.sections) {
        data.form.sections.forEach(sec => {
            html += '<div class="hygiene-item">';
            html += `<h4>${sec.title}</h4>`;
            if (sec.items) {
                html += '<ul>';
                sec.items.forEach(item => {
                    html += `<li>${item}</li>`;
                });
                html += '</ul>';
            }
            html += '</div>';
        });
    }

    if (data.form?.submission) {
        html += '<div class="hygiene-item">';
        html += '<h4><i class="fas fa-share-square"></i> 提出・運用</h4><ul>';
        data.form.submission.forEach(item => {
            html += `<li>${item}</li>`;
        });
        html += '</ul></div>';
    }

    container.innerHTML = html;
}

function renderManagerHygiene() {
    const container = document.getElementById('managerHygieneContent');
    if (!container) return;

    const data = initialData.hygiene.manager;
    let html = '';

    // タイトルとサブタイトル
    html += `<div class="hygiene-header">`;
    html += `<h3>${data.title}</h3>`;
    html += `<p class="hygiene-subtitle">${data.subtitle}</p>`;
    if (data.description) {
        html += `<p class="hygiene-description">${data.description.replace(/\n/g, '<br>')}</p>`;
    }
    html += `</div>`;

    // セクション
    data.sections.forEach(section => {
        html += `<div class="hygiene-item">`;
        html += `<h4><i class="fas fa-clipboard-check"></i> ${section.title}</h4>`;

        if (section.items) {
            html += '<ul>';
            section.items.forEach(item => {
                html += `<li>${item}</li>`;
            });
            html += '</ul>';
        }

        if (section.subsections) {
            section.subsections.forEach(subsection => {
                html += `<div class="hygiene-subsection">`;
                html += `<h5>${subsection.subtitle}</h5>`;
                html += '<ul>';
                subsection.items.forEach(item => {
                    html += `<li>${item}</li>`;
                });
                html += '</ul>';
                html += '</div>';
            });
        }

        if (section.diagram) {
            html += '<div class="mermaid-container">';
            html += `<h5>フロー</h5>`;
            html += `<pre class="mermaid">${section.diagram}</pre>`;
            html += '</div>';
        }

        html += '</div>';
    });

    container.innerHTML = html;
}

// ===================================
// 在庫管理機能
// ===================================

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

/**
 * 在庫データを取得
 */
async function fetchInventoryData() {
    // APIが設定されていない場合はフォールバックデータを使用
    if (!INVENTORY_API_URL) {
        console.log('在庫API未設定: フォールバックデータを使用');
        updateApiStatus('unconfigured', 'API未設定（デモデータ）');
        return {
            ...fallbackInventoryData,
            timestamp: new Date().toISOString(),
            isOffline: true,
            isUnconfigured: true
        };
    }

    // 接続確認中を表示
    updateApiStatus('checking', '接続確認中...');

    try {
        const response = await fetch(INVENTORY_API_URL);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();

        // キャッシュに保存
        localStorage.setItem(STORAGE_KEYS.INVENTORY_CACHE, JSON.stringify(data));

        // 接続成功を表示
        updateApiStatus('connected', 'API接続中');

        return { ...data, isOffline: false };
    } catch (error) {
        console.error('在庫データ取得エラー:', error);

        // キャッシュを試行
        const cached = localStorage.getItem(STORAGE_KEYS.INVENTORY_CACHE);
        if (cached) {
            console.log('キャッシュからデータを使用');
            updateApiStatus('cached', 'キャッシュ使用中');
            const cachedData = JSON.parse(cached);
            return { ...cachedData, isOffline: true, isCached: true };
        }

        // フォールバックデータを使用
        updateApiStatus('offline', '接続エラー');
        return {
            ...fallbackInventoryData,
            timestamp: new Date().toISOString(),
            isOffline: true,
            error: error.message
        };
    }
}

/**
 * 在庫ページを初期化
 */
async function initInventoryPage() {
    const listContent = document.getElementById('inventoryListContent');
    const storageContent = document.getElementById('storageInfoContent');

    // ローディング表示
    if (listContent) {
        listContent.innerHTML = `
            <div class="loading-spinner">
                <i class="fas fa-spinner fa-spin"></i>
                <p>在庫データを読み込み中...</p>
            </div>
        `;
    }

    try {
        const data = await fetchInventoryData();
        renderInventorySummary(data);
        renderInventoryList(data, listContent);
        renderStorageInfo(data, storageContent);
    } catch (error) {
        console.error('在庫ページ初期化エラー:', error);
        if (listContent) {
            listContent.innerHTML = `
                <div class="error-message">
                    <i class="fas fa-exclamation-circle"></i>
                    <p>データの取得に失敗しました</p>
                    <button class="btn btn-secondary" onclick="refreshInventory()">
                        <i class="fas fa-sync-alt"></i> 再試行
                    </button>
                </div>
            `;
        }
    }
}

/**
 * 在庫サマリーを表示
 */
function renderInventorySummary(data) {
    const totalEl = document.getElementById('totalItemsCount');
    const needsOrderEl = document.getElementById('needsOrderCount');
    const inProgressEl = document.getElementById('inProgressCount');
    const completedEl = document.getElementById('inventoryCompletedCount');
    const lastUpdatedEl = document.getElementById('lastUpdated');

    // items配列を取得（APIレスポンスまたはフォールバック）
    const items = data.items || [];

    // 総数（itemsから直接カウント）
    const totalItems = items.length || data.summary?.totalItems || 0;

    // 発注が必要な数（未申請）- itemsから直接カウント
    const needsOrderCount = items.filter(item =>
        item.purchaseStatus === '未申請' ||
        item.statusType === 'pending' ||
        item.needsOrder === true
    ).length;

    // 申請中の数 - itemsから直接カウント
    const inProgressCount = items.filter(item =>
        item.purchaseStatus === '仕入れ申請中' ||
        item.statusType === 'in_progress' ||
        item.inProgress === true
    ).length;

    // 完了数 - itemsから直接カウント（最も確実な方法）
    const completedCount = items.filter(item =>
        item.purchaseStatus === '完了' ||
        item.statusType === 'completed'
    ).length;

    // デバッグログ（問題解決後に削除可能）
    console.log('[在庫サマリー] 総数:', totalItems, '未申請:', needsOrderCount, '申請中:', inProgressCount, '完了:', completedCount);

    if (totalEl) totalEl.textContent = totalItems || '-';
    if (needsOrderEl) needsOrderEl.textContent = needsOrderCount || '-';
    if (inProgressEl) inProgressEl.textContent = inProgressCount || '-';
    if (completedEl) completedEl.textContent = completedCount || '-';

    if (lastUpdatedEl) {
        if (data.timestamp) {
            const date = new Date(data.timestamp);
            lastUpdatedEl.textContent = date.toLocaleString('ja-JP', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } else if (data.isOffline) {
            lastUpdatedEl.textContent = 'オフライン';
        } else {
            lastUpdatedEl.textContent = '-';
        }
    }
}

/**
 * 在庫一覧を表示（v2.0対応）
 */
function renderInventoryList(data, container) {
    if (!container) return;

    const items = data.items || [];
    if (items.length === 0) {
        container.innerHTML = '<p class="no-data">在庫データがありません</p>';
        return;
    }

    // カテゴリでグループ化（APIからcategoriesが来る場合はそれを使用）
    const categories = data.categories || {};
    if (Object.keys(categories).length === 0) {
        items.forEach(item => {
            const category = item.category || 'その他';
            if (!categories[category]) {
                categories[category] = [];
            }
            categories[category].push(item);
        });
    }

    let html = '';

    // オフライン通知
    if (data.isOffline) {
        html += `
            <div class="offline-notice">
                <i class="fas fa-wifi-slash"></i>
                <span>${data.isCached ? 'キャッシュデータを表示中' : 'オフラインモード：サンプルデータを表示中'}</span>
            </div>
        `;
    }

    // v2.3: 未申請（赤）のアイテムを先に表示
    if (data.orderList && data.orderList.length > 0) {
        html += `
            <div class="order-alert-section status-pending-section">
                <h3 class="order-alert-title">
                    <i class="fas fa-exclamation-triangle"></i>
                    未申請（要発注）（${data.orderList.length}件）
                </h3>
                <div class="order-list">
        `;
        data.orderList.forEach(item => {
            // v2.5: クライアント側で単位を再推測
            const unit = (typeof inferUnitClient === 'function') ? inferUnitClient(item.name) : (item.unit || '個');
            html += `
                <div class="order-item status-pending-item">
                    <span class="order-item-name">${item.name}</span>
                    <span class="order-item-info">
                        残数: <strong>${item.remaining}</strong>${unit}
                    </span>
                </div>
            `;
        });
        html += '</div></div>';
    }

    // v2.3: 仕入れ申請中（オレンジ）のアイテムを表示
    if (data.inProgressList && data.inProgressList.length > 0) {
        html += `
            <div class="in-progress-section status-in-progress-section">
                <h3 class="in-progress-title">
                    <i class="fas fa-clock"></i>
                    仕入れ申請中（${data.inProgressList.length}件）
                </h3>
                <div class="in-progress-list">
        `;
        data.inProgressList.forEach(item => {
            // v2.5: クライアント側で単位を再推測
            const unit = (typeof inferUnitClient === 'function') ? inferUnitClient(item.name) : (item.unit || '個');
            html += `
                <div class="in-progress-item status-in-progress-item">
                    <span class="in-progress-item-name">${item.name}</span>
                    <span class="in-progress-item-info">
                        残数: <strong>${item.remaining}</strong>${unit}
                    </span>
                </div>
            `;
        });
        html += '</div></div>';
    }

    // カテゴリ別に表示
    Object.entries(categories).forEach(([category, categoryItems]) => {
        // v2.3: 仕入れ状況ベースでカウント
        const pendingCount = categoryItems.filter(i => i.needsOrder || i.statusType === 'pending' || i.purchaseStatus === '未申請').length;
        const inProgressCount = categoryItems.filter(i => i.inProgress || i.statusType === 'in_progress' || i.purchaseStatus === '仕入れ申請中').length;

        html += `
            <div class="inventory-category">
                <h3 class="category-title">
                    <i class="fas fa-folder"></i> ${category}
                    <span class="category-count">${categoryItems.length}件</span>
                    ${pendingCount > 0 ? `<span class="category-alert category-pending">${pendingCount}件未申請</span>` : ''}
                    ${inProgressCount > 0 ? `<span class="category-alert category-in-progress">${inProgressCount}件申請中</span>` : ''}
                </h3>
                <div class="inventory-items">
        `;

        categoryItems.forEach(item => {
            const stock = item.remaining !== undefined ? item.remaining : item.stock;
            const orderPoint = item.orderLine !== undefined ? item.orderLine : item.orderPoint;
            const ideal = item.ideal || orderPoint * 2;
            const stockRatio = item.stockRatio !== undefined ? item.stockRatio : (ideal > 0 ? Math.round((stock / ideal) * 100) : 100);

            // v2.5: クライアント側で単位を再推測（APIの単位が正しくない場合のフォールバック）
            const unit = (typeof inferUnitClient === 'function') ? inferUnitClient(item.name) : (item.unit || '個');

            // v2.3: 仕入れ状況ベースの表示
            const statusType = item.statusType || (item.purchaseStatus === '未申請' ? 'pending' : (item.purchaseStatus === '仕入れ申請中' ? 'in_progress' : 'completed'));
            const isPending = statusType === 'pending';
            const isInProgress = statusType === 'in_progress';

            let statusClass, statusIcon, statusText, barClass;
            if (isPending) {
                statusClass = 'status-pending';
                statusIcon = 'fa-exclamation-triangle';
                statusText = '未申請';
                barClass = 'bar-pending';
            } else if (isInProgress) {
                statusClass = 'status-in-progress';
                statusIcon = 'fa-clock';
                statusText = '申請中';
                barClass = 'bar-in-progress';
            } else {
                statusClass = 'status-completed';
                statusIcon = 'fa-check-circle';
                statusText = '完了';
                barClass = 'bar-completed';
            }

            html += `
                <div class="inventory-item ${statusClass}">
                    <div class="item-header">
                        <span class="item-name">${item.name}</span>
                        <span class="item-status ${statusClass}">
                            <i class="fas ${statusIcon}"></i>
                            ${statusText}
                        </span>
                    </div>
                    <div class="item-details">
                        <div class="item-stock">
                            <span class="stock-value">${stock}</span>
                            <span class="stock-unit">${unit}</span>
                            <span class="stock-ratio">(${stockRatio}%)</span>
                        </div>
                        <div class="item-thresholds">
                            <span class="threshold-ideal">理想: ${ideal}${unit}</span>
                            <span class="threshold-order">発注ライン: ${orderPoint}${unit}</span>
                        </div>
                    </div>
                    <div class="stock-bar-container">
                        <div class="stock-bar ${barClass}" style="width: ${Math.min(100, stockRatio)}%"></div>
                    </div>
                    <div class="item-purchase-status ${statusClass}">
                        <i class="fas ${statusIcon}"></i> ${item.purchaseStatus || statusText}
                    </div>
                </div>
            `;
        });

        html += '</div></div>';
    });

    container.innerHTML = html;
}

/**
 * 保管場所情報を表示
 */
function renderStorageInfo(data, container) {
    if (!container) return;

    const storage = data.storage || [];
    if (storage.length === 0) {
        container.innerHTML = '<p class="no-data">保管場所データがありません</p>';
        return;
    }

    let html = `
        <div class="storage-table-container">
            <table class="storage-table">
                <thead>
                    <tr>
                        <th>品名</th>
                        <th>開封前</th>
                        <th>開封後</th>
                        <th>消費期限目安</th>
                        <th>備考</th>
                    </tr>
                </thead>
                <tbody>
    `;

    storage.forEach(item => {
        const afterOpenHtml = (item.afterOpen || '').replace(/\n/g, '<br>');
        html += `
            <tr>
                <td class="storage-name">${item.name}</td>
                <td class="storage-location">${item.beforeOpen || '-'}</td>
                <td class="storage-location">${afterOpenHtml || '-'}</td>
                <td class="storage-expiry">${item.expiryDays || '-'}</td>
                <td class="storage-notes">${item.notes || '-'}</td>
            </tr>
        `;
    });

    html += '</tbody></table></div>';
    container.innerHTML = html;
}

/**
 * 在庫データを更新（手動更新ボタン用）
 */
async function refreshInventory() {
    const listContent = document.getElementById('inventoryListContent');
    const storageContent = document.getElementById('storageInfoContent');

    // ローディング表示
    if (listContent) {
        listContent.innerHTML = `
            <div class="loading-spinner">
                <i class="fas fa-spinner fa-spin"></i>
                <p>在庫データを更新中...</p>
            </div>
        `;
    }

    try {
        const data = await fetchInventoryData();
        renderInventorySummary(data);
        renderInventoryList(data, listContent);
        renderStorageInfo(data, storageContent);
    } catch (error) {
        console.error('在庫更新エラー:', error);
        if (listContent) {
            listContent.innerHTML = `
                <div class="error-message">
                    <i class="fas fa-exclamation-circle"></i>
                    <p>更新に失敗しました</p>
                    <button class="btn btn-secondary" onclick="refreshInventory()">
                        <i class="fas fa-sync-alt"></i> 再試行
                    </button>
                </div>
            `;
        }
    }
}

// showPage関数をオーバーライドして在庫ページ表示時に初期化
(function() {
    const originalShowPage = window.showPage;
    if (originalShowPage) {
        window.showPage = function(pageId) {
            originalShowPage(pageId);
            if (pageId === 'inventory') {
                initInventoryPage();
            }
        };
    }
})();
