/**
 * FenixJpCatch Welcome & Onboarding UI Controller
 * Powered by Fenix Language Ecosystem
 */

import {CloudController} from '../../js/cloud/cloud-controller.js';

const cloudController = new CloudController();
const starredWords = new Set();

const dictionaryStore = {
    'sakura': {
        kanji: '桜',
        kana: 'さくら',
        hanViet: 'ANH',
        jlpt: 'N4',
        freq: 'Phổ biến ★★★',
        pitch: '[0]',
        meaning: 'Hoa anh đào (quốc hoa biểu tượng của Nhật Bản)',
        breakdown: '桜 (ANH: cây anh đào, loài hoa nở vào mùa xuân biểu trưng cho sự tái sinh và thanh tao).',
        exampleJp: '公園の桜がとても綺麗です。',
        exampleVi: 'Hoa anh đào trong công viên rất đẹp.'
    },
    'mankai': {
        kanji: '満開',
        kana: 'まんかい',
        hanViet: 'MÃN KHAI',
        jlpt: 'N3',
        freq: 'Phổ biến ★★★',
        pitch: '[0]',
        meaning: 'Nở rộ, nở bung hoàn toàn (đặc trưng dùng cho hoa anh đào, hoa mùa xuân nở hết cỡ).',
        breakdown: '満 (MÃN: đầy đặn, sung mãn, trọn vẹn) + 開 (KHAI: mở ra, hé mở, khai hoa) ➔ Hoa nở tràn ngập đến độ trọn vẹn nhất.',
        exampleJp: '公園の桜が満開で見事だ。',
        exampleVi: 'Hoa anh đào trong công viên đã nở rộ tuyệt đẹp.'
    },
    'kisetsu': {
        kanji: '季節',
        kana: 'きせつ',
        hanViet: 'QUÝ TIẾT',
        jlpt: 'N4',
        freq: 'Phổ biến ★★★',
        pitch: '[2]',
        meaning: 'Mùa trong năm, thời kỳ tiết trời.',
        breakdown: '季 (QUÝ: mùa vụ, tuần hoàn) + 節 (TIẾT: đốt tre, tiết khí, thời điểm) ➔ Tiết trời chuyển biến theo chu kỳ thiên nhiên.',
        exampleJp: '日本には美しい四季の季節がある。',
        exampleVi: 'Nhật Bản có bốn mùa tươi đẹp rõ rệt.'
    },
    'nihongo': {
        kanji: '日本語',
        kana: 'にほんご',
        hanViet: 'NHẬT BẢN NGỮ',
        jlpt: 'N5',
        freq: 'Cực phổ biến ★★★',
        pitch: '[0]',
        meaning: 'Tiếng Nhật, ngôn ngữ chính thức tại Nhật Bản.',
        breakdown: '日 (NHẬT: mặt trời) + 本 (BẢN: gốc rễ, nguồn gốc) + 語 (NGỮ: ngôn ngữ nói/viết) ➔ Ngôn ngữ của xứ sở Mặt trời mọc.',
        exampleJp: '毎日日本語を勉強しています。',
        exampleVi: 'Tôi đang học tiếng Nhật mỗi ngày.'
    },
    'benkyou': {
        kanji: '勉強',
        kana: 'べんきょう',
        hanViet: 'MIỄN CƯỠNG',
        jlpt: 'N5',
        freq: 'Cực phổ biến ★★★',
        pitch: '[0]',
        meaning: 'Học tập, trau dồi kiến thức; hạ giá bán (thương mại).',
        breakdown: '勉 (MIỄN: nỗ lực, gắng sức) + 強 (CƯỜNG: mạnh mẽ, kiên định) ➔ Gắng sức rèn luyện tâm trí để trở nên mạnh mẽ hơn.',
        exampleJp: '図書館で試験の勉強をする。',
        exampleVi: 'Học thi ở trong thư viện.'
    },
    'omoshiroi': {
        kanji: '面白い',
        kana: 'おもしろい',
        hanViet: 'DIỆN BẠCH',
        jlpt: 'N5',
        freq: 'Cực phổ biến ★★★',
        pitch: '[4]',
        meaning: 'Thú vị, hấp dẫn, vui vẻ, lôi cuốn.',
        breakdown: '面 (DIỆN: khuôn mặt, diện mạo) + 白 (BẠCH: sáng rõ, trắng) ➔ Khuôn mặt bừng sáng rạng rỡ khi chứng kiến điều thú vị.',
        exampleJp: 'この小説は展開がとても面白い。',
        exampleVi: 'Cuốn tiểu thuyết này có cốt truyện rất thú vị.'
    }
};

let currentWordKey = 'mankai';

function renderPopup(key) {
    const item = dictionaryStore[key] || dictionaryStore['mankai'];
    currentWordKey = key;
    const isStarred = starredWords.has(key);
    const popup = document.getElementById('fenixFloatingPopup');
    if (!popup) return;

    popup.innerHTML = `
        <div class="flex items-start justify-between gap-space-sm pb-space-xs border-b border-surface-variant/40">
            <div class="flex flex-col">
                <div class="flex items-baseline gap-2">
                    <span class="font-headline-lg text-2xl text-on-surface font-bold tracking-tight">${item.kanji}</span>
                    <span class="font-body-md text-body-md text-on-surface-variant">[${item.kana}]</span>
                    <span class="inline-flex items-center px-2 py-0.5 rounded-md bg-tertiary-fixed text-on-tertiary-fixed font-label-md text-label-md font-bold tracking-wide shadow-sm">
                        ${item.hanViet}
                    </span>
                </div>
                <div class="flex items-center gap-1.5 mt-1">
                    <span class="px-1.5 py-0.5 rounded bg-secondary-container text-on-secondary-container font-label-sm text-[10px] font-semibold">
                        JLPT ${item.jlpt}
                    </span>
                    <span class="px-1.5 py-0.5 rounded bg-surface-variant text-on-surface-variant font-label-sm text-[10px]">
                        ${item.freq}
                    </span>
                    <span class="px-1.5 py-0.5 rounded bg-surface-container-low text-tertiary font-label-sm text-[10px] flex items-center gap-0.5">
                        <span class="material-symbols-outlined text-[12px]">graphic_eq</span>
                        Âm điệu ${item.pitch}
                    </span>
                </div>
            </div>
            <div class="flex items-center gap-1">
                <button id="popupAudioBtn" class="w-8 h-8 rounded-lg bg-surface-container hover:bg-primary-container text-tertiary-fixed flex items-center justify-center transition-colors shadow-sm" title="Phát âm từ vựng">
                    <span class="material-symbols-outlined text-[18px]">volume_up</span>
                </button>
                <button id="popupStarBtn" class="w-8 h-8 rounded-lg bg-surface-container hover:bg-secondary-container ${isStarred ? 'text-secondary-fixed' : 'text-secondary'} flex items-center justify-center transition-colors shadow-sm" title="Lưu vào sổ từ">
                    <span class="material-symbols-outlined text-[18px]" style="font-variation-settings: 'FILL' ${isStarred ? 1 : 0};">star</span>
                </button>
            </div>
        </div>
        <div class="pt-space-sm flex flex-col gap-space-xs text-left">
            <div class="flex items-start gap-2">
                <span class="w-5 h-5 rounded-full bg-primary/20 text-primary flex items-center justify-center font-label-sm text-label-sm font-bold flex-shrink-0 mt-0.5">1</span>
                <p class="font-body-md text-body-md text-on-surface font-medium leading-snug">
                    ${item.meaning}
                </p>
            </div>
            <div class="mt-1 p-2 rounded-lg bg-surface-container-lowest/80 text-xs text-on-surface-variant leading-relaxed">
                <span class="text-tertiary-fixed font-semibold block mb-0.5 font-label-sm text-label-sm">
                    Phân tích Hán tự chuyên sâu:
                </span>
                ${item.breakdown}
            </div>
            <div class="mt-1 pt-1 border-t border-surface-variant/30 flex flex-col text-xs">
                <span class="text-on-surface font-normal">${item.exampleJp}</span>
                <span class="text-on-surface-variant text-[11px]">${item.exampleVi}</span>
            </div>
        </div>
        <div class="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-surface-container-high/95 rotate-45 transform"></div>
    `;

    // Audio button click
    const audioBtn = document.getElementById('popupAudioBtn');
    if (audioBtn) {
        audioBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            playAudioText(item.kana || item.kanji);
        });
    }

    // Star button click -> saves word to CloudController (local notebook + Firestore)
    const starBtn = document.getElementById('popupStarBtn');
    if (starBtn) {
        starBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (starredWords.has(currentWordKey)) {
                starredWords.delete(currentWordKey);
                renderPopup(currentWordKey);
                await cloudController.deleteSavedWord('', item.kanji, item.kana);
            } else {
                starredWords.add(currentWordKey);
                renderPopup(currentWordKey);
                await cloudController.saveWord({
                    expression: item.kanji,
                    reading: item.kana,
                    contextSentence: item.exampleJp,
                    sourceUrl: 'https://nhk.or.jp/news/easy/k1001438910/',
                    sourceTitle: 'NHK News Web Easy (FenixJpCatch Playground)',
                });
            }
        });
    }
}

function playAudioText(text) {
    try {
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'ja-JP';
            utterance.rate = 1.0;
            window.speechSynthesis.speak(utterance);
        }
    } catch (e) {
        // Fallback silent
    }
}

async function checkPermissions() {
    const toggle = document.getElementById('permissionToggle');
    const badge = document.getElementById('permissionStatusBadge');
    if (!toggle) return;

    if (typeof chrome !== 'undefined' && chrome.permissions) {
        try {
            const hasPermissions = await chrome.permissions.contains({origins: ['<all_urls>']});
            toggle.checked = hasPermissions;
            if (badge) {
                if (hasPermissions) {
                    badge.innerHTML = '<span class="material-symbols-outlined text-[14px]">check_circle</span><span>Đã cấp quyền</span>';
                    badge.className = 'flex items-center gap-1.5 text-emerald-400 font-label-sm text-label-sm bg-emerald-950/40 px-2 py-0.5 rounded-full';
                } else {
                    badge.innerHTML = '<span class="material-symbols-outlined text-[14px]">info</span><span>Chưa cấp quyền</span>';
                    badge.className = 'flex items-center gap-1.5 text-amber-400 font-label-sm text-label-sm bg-amber-950/40 px-2 py-0.5 rounded-full';
                }
            }
        } catch (e) {
            toggle.checked = true;
        }
    } else {
        toggle.checked = true;
    }
}

async function handlePermissionToggle(e) {
    const toggle = e.target;
    if (typeof chrome !== 'undefined' && chrome.permissions) {
        try {
            if (toggle.checked) {
                const granted = await chrome.permissions.request({origins: ['<all_urls>']});
                toggle.checked = granted;
            } else {
                await chrome.permissions.remove({origins: ['<all_urls>']});
            }
            await checkPermissions();
        } catch (err) {
            // Ignore error
        }
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    // Initial popup render
    renderPopup('mankai');

    // Attach click/hover to practice words in playground
    const words = document.querySelectorAll('.practice-word');
    words.forEach(w => {
        const key = w.getAttribute('data-word');
        if (!key) return;

        w.addEventListener('click', (e) => {
            e.preventDefault();
            words.forEach(el => el.classList.remove('bg-primary-container/80', 'text-tertiary-fixed', 'font-semibold'));
            w.classList.add('bg-primary-container/80', 'text-tertiary-fixed', 'font-semibold');
            renderPopup(key);
        });

        w.addEventListener('mouseenter', () => {
            renderPopup(key);
        });
    });

    // Check permissions
    await checkPermissions();
    const permToggle = document.getElementById('permissionToggle');
    if (permToggle) {
        permToggle.addEventListener('change', handlePermissionToggle);
    }

    // Top nav "Tra từ Hover" smooth scroll + highlight playground
    const navHoverLookup = document.getElementById('nav-hover-lookup');
    const playgroundSection = document.getElementById('practice-playground-section');
    const highlightPlayground = () => {
        if (!playgroundSection) { return; }
        playgroundSection.scrollIntoView({behavior: 'smooth', block: 'center'});
        playgroundSection.classList.add('ring-2', 'ring-tertiary-fixed');
        setTimeout(() => {
            playgroundSection.classList.remove('ring-2', 'ring-tertiary-fixed');
        }, 1800);
    };
    if (navHoverLookup) {
        navHoverLookup.addEventListener('click', (e) => {
            e.preventDefault();
            highlightPlayground();
        });
    }
    if (window.location.hash === '#practice-playground-section') {
        setTimeout(highlightPlayground, 200);
    }

    // Trigger Mode selection -> dispatches custom event so welcome-main.js updates real profile settings
    const triggerRadios = document.querySelectorAll('input[name="triggerMode"]');
    triggerRadios.forEach(radio => {
        radio.addEventListener('change', () => {
            document.querySelectorAll('.trigger-option').forEach(el => {
                el.classList.remove('bg-surface-container-highest', 'text-on-surface');
                el.classList.add('bg-surface-container-lowest/60', 'text-on-surface-variant');
            });
            const parentLabel = radio.closest('.trigger-option');
            if (parentLabel) {
                parentLabel.classList.remove('bg-surface-container-lowest/60', 'text-on-surface-variant');
                parentLabel.classList.add('bg-surface-container-highest', 'text-on-surface');
            }
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                chrome.storage.local.set({fenixPreferredTrigger: radio.value});
            }
            window.dispatchEvent(new CustomEvent('fenix:trigger-mode-change', {detail: {mode: radio.value}}));
        });
    });

    // Header search toggle -> dispatches custom event so welcome-main.js updates general.enable
    const searchToggle = document.getElementById('header-search-toggle');
    if (searchToggle) {
        searchToggle.addEventListener('change', () => {
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                chrome.storage.local.set({fenixSearchEnabled: searchToggle.checked});
            }
            window.dispatchEvent(new CustomEvent('fenix:search-enable-change', {detail: {enabled: searchToggle.checked}}));
        });
    }

    // Observe hidden WelcomeController status to mirror live dictionary installation progress inside Step 2 card
    const dictStatusBadge = document.getElementById('welcome-dict-status');
    const hiddenList = document.getElementById('fenix-dictionary-list');
    const pillJaVi = document.getElementById('welcome-pill-javi');
    const pillKanji = document.getElementById('welcome-pill-kanji');
    const offlineDot = document.getElementById('welcome-offline-dot');
    const offlinePillIcon = document.getElementById('welcome-offline-pill-icon');
    const offlinePillText = document.getElementById('welcome-offline-pill-text');
    const step2Card = document.getElementById('welcome-step2-card');
    const step2Badge = document.getElementById('welcome-step2-badge');
    const step2BadgeIcon = document.getElementById('welcome-step2-badge-icon');
    const step2BadgeText = document.getElementById('welcome-step2-badge-text');
    const step2Title = document.getElementById('welcome-step2-title');
    const step2Desc = document.getElementById('welcome-step2-desc');
    const step2Bar = document.getElementById('welcome-step2-progress-bar');
    const step2Substatus = document.getElementById('welcome-step2-substatus');
    const step2RetryBtn = document.getElementById('welcome-step2-retry-btn');
    const bottomIcon = document.getElementById('welcome-bottom-icon');
    const bottomTitle = document.getElementById('welcome-bottom-title');
    const bottomSubtitle = document.getElementById('welcome-bottom-subtitle');
    const startBtn = document.getElementById('btnStartNow');

    let isNavigating = false;
    let maxOverallPct = 5;

    const estimateRowProgress = (row) => {
        const phase = row.dataset.phase || 'checking';
        if (phase === 'installed') { return 1; }
        if (phase === 'downloading') {
            const widthStr = row.querySelector('.fenix-dictionary-progress .progress-bar')?.style.width || '0%';
            const pct = Math.max(0, Math.min(100, Number.parseFloat(widthStr) || 0));
            return 0.02 + (pct / 100) * 0.04;
        }
        if (phase === 'importing') {
            const statusText = row.querySelector('.fenix-dictionary-status')?.textContent || '';
            const widthStr = row.querySelector('.fenix-dictionary-progress .progress-bar')?.style.width || '0%';
            const barRatio = Math.max(0, Math.min(1, (Number.parseFloat(widthStr) || 0) / 100));
            const stepMatch = /\bbước\s+(\d+)\s*\/\s*(\d+)/i.exec(statusText);
            const step = stepMatch ? Number.parseInt(stepMatch[1], 10) : 1;
            if (step <= 1) { return 0.05; }
            if (step === 2) { return 0.06; }
            if (step === 3) { return 0.06 + barRatio * 0.09; }
            if (step === 4) { return 0.15 + barRatio * 0.25; }
            if (step === 5) { return 0.40 + barRatio * 0.56; }
            return 0.96 + barRatio * 0.03;
        }
        return 0;
    };

    const updateDictPill = (pillEl, label, row) => {
        if (!pillEl || !row) { return; }
        const phase = row.dataset.phase || 'checking';
        if (phase === 'installed') {
            pillEl.textContent = `✓ ${label} Chuẩn`;
            pillEl.className = 'px-2 py-0.5 rounded font-label-sm text-label-sm fenix-bg-emerald';
        } else if (phase === 'error' || phase === 'missing') {
            pillEl.textContent = `${label}: Cần thử lại`;
            pillEl.className = 'px-2 py-0.5 rounded font-label-sm text-label-sm fenix-bg-rose';
        } else if (phase === 'downloading' || phase === 'importing') {
            pillEl.textContent = `${label}: Đang nạp...`;
            pillEl.className = 'px-2 py-0.5 rounded font-label-sm text-label-sm fenix-bg-amber';
        } else {
            pillEl.textContent = `${label}: Đang chờ...`;
            pillEl.className = 'px-2 py-0.5 rounded bg-surface-container-high text-on-surface-variant font-label-sm text-label-sm';
        }
    };

    const triggerStep2Attention = () => {
        if (!step2Card) { return; }
        step2Card.scrollIntoView({behavior: 'smooth', block: 'center'});
        step2Card.classList.remove('fenix-install-banner--attention');
        void step2Card.offsetWidth;
        step2Card.classList.add('fenix-install-banner--attention');
        setTimeout(() => {
            step2Card.classList.remove('fenix-install-banner--attention');
        }, 1900);
    };

    if (step2RetryBtn && hiddenList) {
        step2RetryBtn.addEventListener('click', () => {
            maxOverallPct = 5;
            const rows = [...hiddenList.querySelectorAll('.fenix-dictionary-row')];
            for (const row of rows) {
                if (row.dataset.phase === 'error' || row.dataset.phase === 'missing') {
                    row.querySelector('.fenix-dictionary-action')?.click();
                }
            }
        });
    }

    const syncDictInstallProgress = () => {
        if (!hiddenList) { return; }
        const rows = [...hiddenList.querySelectorAll('.fenix-dictionary-row')];
        if (rows.length === 0) { return; }

        const installedCount = rows.filter((r) => r.dataset.phase === 'installed').length;
        const activeRow = rows.find((r) => r.dataset.phase === 'downloading' || r.dataset.phase === 'importing');
        const errorRow = rows.find((r) => r.dataset.phase === 'error');
        const missingRow = rows.find((r) => r.dataset.phase === 'missing');
        const isAllInstalled = installedCount === rows.length;
        const hasIssue = !isAllInstalled && !activeRow && (Boolean(errorRow) || Boolean(missingRow));

        const weights = rows.length === 2 ? [0.85, 0.15] : rows.map(() => 1 / rows.length);
        let weightedProgress = 0;
        for (let i = 0; i < rows.length; ++i) {
            weightedProgress += estimateRowProgress(rows[i]) * weights[i];
        }
        let overallPct = isAllInstalled ? 100 : Math.min(99, Math.max(5, Math.round(weightedProgress * 100)));
        if (!isAllInstalled && !hasIssue) {
            maxOverallPct = Math.max(maxOverallPct, overallPct);
            overallPct = maxOverallPct;
        }

        updateDictPill(pillJaVi, 'JA-VI', rows[0]);
        updateDictPill(pillKanji, 'Kanji-VI', rows[1]);

        if (isAllInstalled) {
            maxOverallPct = 100;
            if (offlineDot) {
                offlineDot.className = 'w-2 h-2 rounded-full fenix-dot-emerald animate-pulse';
            }
            if (offlinePillIcon) {
                offlinePillIcon.textContent = 'offline_pin';
                offlinePillIcon.className = 'material-symbols-outlined text-[14px] fenix-tone-emerald';
            }
            if (offlinePillText) {
                offlinePillText.textContent = 'Sẵn sàng ngoại tuyến';
            }
            if (step2Card) {
                step2Card.classList.remove('fenix-step2-active', 'fenix-step2-error');
                step2Card.classList.add('fenix-step2-ready');
            }
            if (step2Badge) {
                step2Badge.className = 'flex items-center gap-1.5 font-label-sm text-label-sm font-semibold px-2.5 py-0.5 rounded-full fenix-bg-emerald';
            }
            if (step2BadgeIcon) {
                step2BadgeIcon.textContent = 'storage';
                step2BadgeIcon.classList.remove('fenix-spin');
            }
            if (step2BadgeText) {
                step2BadgeText.textContent = 'IndexedDB Sẵn Sàng';
            }
            if (step2Title) {
                step2Title.textContent = 'Từ điển ngoại tuyến tích hợp';
            }
            if (step2Desc) {
                step2Desc.textContent = 'Nạp sẵn kho dữ liệu Hán – Việt hoàn chỉnh. Tra cứu siêu tốc độ trễ <10ms, không phụ thuộc kết nối mạng.';
            }
            if (dictStatusBadge) {
                dictStatusBadge.textContent = '100% Sẵn sàng';
                dictStatusBadge.className = 'font-label-md text-label-md font-bold fenix-tone-emerald';
                dictStatusBadge.onclick = null;
            }
            if (step2Bar) {
                step2Bar.style.width = '100%';
                step2Bar.className = 'fenix-progress-fill fenix-progress-fill--ready';
            }
            if (step2Substatus) {
                step2Substatus.hidden = true;
            }
            if (step2RetryBtn) {
                step2RetryBtn.hidden = true;
            }
            if (bottomIcon) {
                bottomIcon.textContent = 'rocket_launch';
                bottomIcon.classList.remove('fenix-spin');
            }
            if (bottomTitle) {
                bottomTitle.textContent = 'Tất cả cấu hình đã hoàn tất';
            }
            if (bottomSubtitle) {
                bottomSubtitle.textContent = 'Sẵn sàng mở rộng vốn từ tiếng Nhật và Hán tự mỗi ngày';
            }
            if (startBtn && !isNavigating) {
                startBtn.classList.remove('fenix-btn-busy');
                startBtn.innerHTML = '<span>Bắt đầu sử dụng ngay</span><span class="material-symbols-outlined text-[20px]">arrow_forward</span>';
            }
        } else if (hasIssue) {
            const issueRow = errorRow || missingRow;
            const errDetail = issueRow?.querySelector('.fenix-dictionary-error')?.textContent || '';
            if (offlineDot) {
                offlineDot.className = 'w-2 h-2 rounded-full fenix-dot-rose animate-pulse';
            }
            if (offlinePillIcon) {
                offlinePillIcon.textContent = 'warning';
                offlinePillIcon.className = 'material-symbols-outlined text-[14px] fenix-tone-rose';
            }
            if (offlinePillText) {
                offlinePillText.textContent = 'Chưa nạp xong từ điển';
            }
            if (step2Card) {
                step2Card.classList.remove('fenix-step2-active', 'fenix-step2-ready');
                step2Card.classList.add('fenix-step2-error');
            }
            if (step2Badge) {
                step2Badge.className = 'flex items-center gap-1.5 font-label-sm text-label-sm font-semibold px-2.5 py-0.5 rounded-full fenix-bg-rose';
            }
            if (step2BadgeIcon) {
                step2BadgeIcon.textContent = 'warning';
                step2BadgeIcon.classList.remove('fenix-spin');
            }
            if (step2BadgeText) {
                step2BadgeText.textContent = 'Cần nạp lại';
            }
            if (step2Title) {
                step2Title.textContent = errorRow ? 'Nạp từ điển gặp lỗi' : 'Chưa có đủ từ điển ngoại tuyến';
            }
            if (step2Desc) {
                step2Desc.textContent = errDetail
                    ? `Quá trình cài đặt bị gián đoạn (${errDetail}). Hãy bấm "Thử lại nạp từ điển" bên dưới.`
                    : 'Hãy giữ tab này mở và bấm "Thử lại nạp từ điển" để hoàn tất trước khi tra từ.';
            }
            if (dictStatusBadge) {
                dictStatusBadge.textContent = `${overallPct}% (Lỗi)`;
                dictStatusBadge.className = 'font-label-md text-label-md font-bold cursor-pointer fenix-tone-rose';
                dictStatusBadge.onclick = () => { step2RetryBtn?.click(); };
            }
            if (step2Bar) {
                step2Bar.style.width = `${overallPct}%`;
                step2Bar.className = 'fenix-progress-fill fenix-progress-fill--error';
            }
            if (step2Substatus) {
                step2Substatus.hidden = false;
                step2Substatus.className = 'font-label-sm text-label-sm fenix-tone-rose';
                step2Substatus.textContent = 'Quá trình nạp chưa hoàn tất — Nhấn Thử lại bên dưới';
            }
            if (step2RetryBtn) {
                step2RetryBtn.hidden = false;
            }
            if (bottomIcon) {
                bottomIcon.textContent = 'warning';
                bottomIcon.classList.remove('fenix-spin');
            }
            if (bottomTitle) {
                bottomTitle.textContent = 'Chưa thể tra từ — Bộ từ điển chưa nạp xong';
            }
            if (bottomSubtitle) {
                bottomSubtitle.textContent = 'Vui lòng bấm Thử lại ở Bước 02 để hoàn tất cài đặt';
            }
            if (startBtn && !isNavigating) {
                startBtn.classList.remove('fenix-btn-busy');
                startBtn.innerHTML = '<span class="material-symbols-outlined text-[20px]">refresh</span><span>Thử nạp lại từ điển</span>';
            }
        } else {
            const statusText = activeRow?.querySelector('.fenix-dictionary-status')?.textContent || 'Đang chuẩn bị cài đặt...';
            if (offlineDot) {
                offlineDot.className = 'w-2 h-2 rounded-full fenix-dot-amber animate-pulse';
            }
            if (offlinePillIcon) {
                offlinePillIcon.textContent = 'sync';
                offlinePillIcon.className = 'material-symbols-outlined text-[14px] fenix-tone-amber fenix-spin';
            }
            if (offlinePillText) {
                offlinePillText.textContent = `Đang nạp dữ liệu ngoại tuyến (${overallPct}%)...`;
            }
            if (step2Card) {
                step2Card.classList.remove('fenix-step2-ready', 'fenix-step2-error');
                step2Card.classList.add('fenix-step2-active');
            }
            if (step2Badge) {
                step2Badge.className = 'flex items-center gap-1.5 font-label-sm text-label-sm font-semibold px-2.5 py-0.5 rounded-full fenix-bg-amber';
            }
            if (step2BadgeIcon) {
                step2BadgeIcon.textContent = 'sync';
                step2BadgeIcon.classList.add('fenix-spin');
            }
            if (step2BadgeText) {
                step2BadgeText.textContent = `Đang nạp ${overallPct}%`;
            }
            if (step2Title) {
                step2Title.textContent = 'Đang nạp từ điển ngoại tuyến...';
            }
            if (step2Desc) {
                step2Desc.textContent = 'Đang giải nén 180,000+ mục từ & Hán tự vào trình duyệt (~30–60 giây lần đầu). Vui lòng giữ trang mở đến 100%!';
            }
            if (dictStatusBadge) {
                dictStatusBadge.textContent = `${overallPct}% (${installedCount}/${rows.length})`;
                dictStatusBadge.className = 'font-label-md text-label-md font-bold animate-pulse fenix-tone-amber';
                dictStatusBadge.onclick = null;
            }
            if (step2Bar) {
                step2Bar.style.width = `${overallPct}%`;
                step2Bar.className = 'fenix-progress-fill';
            }
            if (step2Substatus) {
                step2Substatus.hidden = false;
                step2Substatus.className = 'font-label-sm text-label-sm fenix-tone-amber';
                step2Substatus.textContent = statusText;
            }
            if (step2RetryBtn) {
                step2RetryBtn.hidden = true;
            }
            if (bottomIcon) {
                bottomIcon.textContent = 'sync';
                bottomIcon.classList.add('fenix-spin');
            }
            if (bottomTitle) {
                bottomTitle.textContent = `Đang nạp dữ liệu từ điển (${overallPct}%)...`;
            }
            if (bottomSubtitle) {
                bottomSubtitle.textContent = 'Vui lòng đợi thanh tiến trình ở Bước 02 đạt 100% rồi bắt đầu tra cứu';
            }
            if (startBtn && !isNavigating) {
                startBtn.classList.add('fenix-btn-busy');
                startBtn.innerHTML = `<span class="material-symbols-outlined text-[20px] fenix-spin">sync</span><span>Đang nạp từ điển (${overallPct}%) — Vui lòng đợi...</span>`;
            }
        }
    };
    if (hiddenList && typeof MutationObserver !== 'undefined') {
        const observer = new MutationObserver(syncDictInstallProgress);
        observer.observe(hiddenList, {childList: true, subtree: true, attributes: true, characterData: true});
        syncDictInstallProgress();
    }

    // Start Now Button -> prevents leaving mid-install; opens Sổ từ & Bảng điều khiển once installed
    if (startBtn) {
        startBtn.addEventListener('click', () => {
            const rows = hiddenList ? [...hiddenList.querySelectorAll('.fenix-dictionary-row')] : [];
            const allInstalled = rows.length > 0 && rows.every((r) => r.dataset.phase === 'installed');
            if (!allInstalled) {
                triggerStep2Attention();
                const hasRetryable = rows.some((r) => r.dataset.phase === 'error' || r.dataset.phase === 'missing');
                if (hasRetryable) {
                    step2RetryBtn?.click();
                }
                return;
            }
            isNavigating = true;
            const checkedRadio = document.querySelector('input[name="triggerMode"]:checked');
            if (checkedRadio instanceof HTMLInputElement) {
                window.dispatchEvent(new CustomEvent('fenix:trigger-mode-change', {detail: {mode: checkedRadio.value}}));
            }
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                chrome.storage.local.set({openedWelcomePage: true}).catch(() => {});
            }
            window.dispatchEvent(new CustomEvent('fenix:disable-show-guide'));
            startBtn.innerHTML = `
                <span class="material-symbols-outlined fenix-spin text-[20px]">sync</span>
                <span>Đã lưu cấu hình! Đang mở Bảng điều khiển...</span>
            `;
            setTimeout(() => {
                window.location.href = '/saved-words.html';
            }, 350);
        });
    }
});
