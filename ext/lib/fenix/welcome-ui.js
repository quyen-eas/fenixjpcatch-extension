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
    // Record that the welcome page has been opened to prevent reopening on browser restarts
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({openedWelcomePage: true}).catch(() => {});
    }

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

    // Observe hidden WelcomeController status to mirror live dictionary installation progress on Step 2 card
    const dictStatusBadge = document.getElementById('welcome-dict-status');
    const hiddenList = document.getElementById('fenix-dictionary-list');
    const syncDictInstallProgress = () => {
        if (!dictStatusBadge || !hiddenList) { return; }
        const rows = [...hiddenList.querySelectorAll('.fenix-dictionary-row')];
        if (rows.length === 0) { return; }
        const installedCount = rows.filter((r) => r.dataset.phase === 'installed').length;
        const activeRow = rows.find((r) => r.dataset.phase === 'downloading' || r.dataset.phase === 'importing');
        const errorRow = rows.find((r) => r.dataset.phase === 'error');
        if (installedCount === rows.length) {
            dictStatusBadge.textContent = '100% Sẵn sàng';
            dictStatusBadge.className = 'font-label-sm text-label-sm text-emerald-400 font-semibold';
        } else if (activeRow) {
            const statusText = activeRow.querySelector('.fenix-dictionary-status')?.textContent || 'Đang cài đặt...';
            dictStatusBadge.textContent = `${statusText} (${installedCount}/${rows.length})`;
            dictStatusBadge.className = 'font-label-sm text-label-sm text-amber-300 font-semibold animate-pulse';
        } else if (errorRow) {
            dictStatusBadge.textContent = 'Lỗi cài đặt (nhấn Thử lại)';
            dictStatusBadge.className = 'font-label-sm text-label-sm text-rose-400 font-semibold cursor-pointer underline';
            dictStatusBadge.onclick = () => { errorRow.querySelector('.fenix-dictionary-action')?.click(); };
        }
    };
    if (hiddenList && typeof MutationObserver !== 'undefined') {
        const observer = new MutationObserver(syncDictInstallProgress);
        observer.observe(hiddenList, {childList: true, subtree: true, attributes: true, characterData: true});
    }

    // Start Now Button -> applies settings and opens Sổ từ & Bảng điều khiển (/saved-words.html)
    const startBtn = document.getElementById('btnStartNow');
    if (startBtn) {
        startBtn.addEventListener('click', () => {
            const checkedRadio = document.querySelector('input[name="triggerMode"]:checked');
            if (checkedRadio instanceof HTMLInputElement) {
                window.dispatchEvent(new CustomEvent('fenix:trigger-mode-change', {detail: {mode: checkedRadio.value}}));
            }
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                chrome.storage.local.set({openedWelcomePage: true}).catch(() => {});
            }
            window.dispatchEvent(new CustomEvent('fenix:disable-show-guide'));
            startBtn.innerHTML = `
                <span class="material-symbols-outlined animate-spin text-[20px]">sync</span>
                <span>Đã lưu cấu hình! Đang mở Bảng điều khiển...</span>
            `;
            setTimeout(() => {
                window.location.href = '/saved-words.html';
            }, 350);
        });
    }
});
