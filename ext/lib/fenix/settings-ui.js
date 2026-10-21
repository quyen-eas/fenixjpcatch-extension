/**
 * FenixJpCatch Settings Dashboard UI Controller
 * Dedicated to Vietnamese learners of Japanese
 */

// Default settings state
const defaultSettings = {
    activationKey: 'shift',
    hoverDelay: 150,
    selectionScan: true,
    clipboardScan: false,
    docsCanvas: true,
    autoPlayAudio: false,
    audioSpeed: 1.0,
    audioVolume: 85,
    audioSource: 'jppod',
    hanVietHighlight: true,
    pitchAccent: true,
    jlptPosTags: true,
    layoutMode: 'default',
    theme: 'dark',
    dictJavi: true,
    dictKanji: true
};

let currentSettings = {...defaultSettings};

function showAutoSaveNotification() {
    const dot = document.getElementById('auto-save-dot');
    const status = document.getElementById('auto-save-status');
    if (!dot || !status) return;

    dot.classList.remove('bg-tertiary');
    dot.classList.add('bg-emerald-400');
    status.textContent = 'Đã lưu thay đổi';

    setTimeout(() => {
        dot.classList.remove('bg-emerald-400');
        dot.classList.add('bg-tertiary');
        status.textContent = 'Tự động lưu';
    }, 1800);
}

function saveSettings() {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({fenixDashboardSettings: currentSettings}, () => {
            showAutoSaveNotification();
        });
    } else {
        localStorage.setItem('fenixDashboardSettings', JSON.stringify(currentSettings));
        showAutoSaveNotification();
    }
}

function loadSettings() {
    return new Promise((resolve) => {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            chrome.storage.local.get(['fenixDashboardSettings'], (result) => {
                if (result && result.fenixDashboardSettings) {
                    currentSettings = {...defaultSettings, ...result.fenixDashboardSettings};
                }
                resolve(currentSettings);
            });
        } else {
            const saved = localStorage.getItem('fenixDashboardSettings');
            if (saved) {
                try {
                    currentSettings = {...defaultSettings, ...JSON.parse(saved)};
                } catch (e) {
                    // Ignore parse error
                }
            }
            resolve(currentSettings);
        }
    });
}

function applySettingsToUI() {
    // 1. Activation key
    document.querySelectorAll('.key-btn').forEach(btn => {
        const key = btn.getAttribute('data-key');
        if (key === currentSettings.activationKey) {
            btn.className = 'py-2 px-3 rounded-lg bg-secondary-container text-tertiary font-label-md text-label-md shadow-[0_2px_14px_rgba(113,52,85,0.6)] flex items-center justify-center gap-1.5 transition-all key-btn active';
            btn.innerHTML = `<span class="material-symbols-outlined text-[16px]">check_circle</span><span>${btn.textContent.trim()}</span>`;
        } else {
            btn.className = 'py-2 px-3 rounded-lg text-on-surface-variant font-label-md text-label-md hover:text-on-surface hover:bg-surface-container-high transition-all key-btn';
            btn.innerHTML = btn.textContent.trim();
        }
    });

    // 2. Hover delay
    const delaySlider = document.getElementById('input-hover-delay');
    const delayLabel = document.getElementById('delay-label');
    if (delaySlider && delayLabel) {
        delaySlider.value = currentSettings.hoverDelay;
        delayLabel.textContent = `${currentSettings.hoverDelay}ms${currentSettings.hoverDelay === 150 ? ' (Đề xuất)' : ''}`;
    }

    // 3. Scanning toggles
    const toggleSelect = document.getElementById('toggle-selection-scan');
    if (toggleSelect) toggleSelect.checked = currentSettings.selectionScan;

    const toggleClip = document.getElementById('toggle-clipboard-scan');
    if (toggleClip) toggleClip.checked = currentSettings.clipboardScan;

    const toggleDocs = document.getElementById('toggle-docs-canvas');
    if (toggleDocs) toggleDocs.checked = currentSettings.docsCanvas;

    // 4. Audio settings
    const toggleAutoplay = document.getElementById('toggle-autoplay-audio');
    if (toggleAutoplay) toggleAutoplay.checked = currentSettings.autoPlayAudio;

    const volSlider = document.getElementById('input-audio-volume');
    const volLabel = document.getElementById('vol-label');
    if (volSlider && volLabel) {
        volSlider.value = currentSettings.audioVolume;
        volLabel.textContent = `${currentSettings.audioVolume}%`;
    }

    const speedLabel = document.getElementById('speed-label');
    document.querySelectorAll('.speed-btn').forEach(btn => {
        const speed = parseFloat(btn.getAttribute('data-speed'));
        if (speed === currentSettings.audioSpeed) {
            btn.className = 'py-1.5 rounded-lg bg-secondary-container text-tertiary font-label-md text-label-md shadow-sm font-semibold speed-btn active';
            if (speedLabel) speedLabel.textContent = `${speed}x ${speed === 1.0 ? 'Chuẩn' : ''}`;
        } else {
            btn.className = 'py-1.5 rounded-lg bg-surface-container-lowest text-on-surface-variant font-label-md text-label-md hover:text-on-surface speed-btn';
        }
    });

    // Audio source
    const audioRadio = document.querySelector(`input[name="audio-source"][value="${currentSettings.audioSource}"]`);
    if (audioRadio) audioRadio.checked = true;
    const sidebarSourceLabel = document.getElementById('sidebar-audio-source-label');
    if (sidebarSourceLabel) sidebarSourceLabel.textContent = currentSettings.audioSource === 'jppod' ? 'Pod' : 'TTS';

    // 5. Appearance toggles & live preview
    const toggleHanViet = document.getElementById('toggle-hanviet');
    const previewHanViet = document.getElementById('preview-hanviet');
    if (toggleHanViet) {
        toggleHanViet.checked = currentSettings.hanVietHighlight;
        if (previewHanViet) previewHanViet.classList.toggle('hidden', !currentSettings.hanVietHighlight);
    }

    const togglePitch = document.getElementById('toggle-pitch');
    const previewPitch = document.getElementById('preview-pitch');
    if (togglePitch) {
        togglePitch.checked = currentSettings.pitchAccent;
        if (previewPitch) previewPitch.classList.toggle('hidden', !currentSettings.pitchAccent);
    }

    const toggleJlpt = document.getElementById('toggle-jlpt');
    const previewTags = document.getElementById('preview-tags');
    if (toggleJlpt) {
        toggleJlpt.checked = currentSettings.jlptPosTags;
        if (previewTags) previewTags.classList.toggle('hidden', !currentSettings.jlptPosTags);
    }

    const selectLayout = document.getElementById('select-layout-mode');
    const previewExample = document.getElementById('preview-example-box');
    if (selectLayout) {
        selectLayout.value = currentSettings.layoutMode;
        if (previewExample) {
            previewExample.classList.toggle('hidden', currentSettings.layoutMode === 'compact');
        }
    }

    // 6. Theme
    applyTheme(currentSettings.theme);
}

function applyTheme(theme) {
    document.querySelectorAll('.theme-btn').forEach(btn => {
        const t = btn.getAttribute('data-theme');
        if (t === theme) {
            btn.className = 'flex-1 flex items-center justify-center py-1.5 rounded-lg bg-surface-container-high text-tertiary font-label-sm text-label-sm gap-1 shadow-sm theme-btn';
        } else {
            btn.className = 'flex-1 flex items-center justify-center py-1.5 rounded-lg text-on-surface-variant hover:text-on-surface font-label-sm text-label-sm gap-1 theme-btn';
        }
    });

    if (theme === 'light') {
        document.documentElement.classList.remove('dark');
    } else if (theme === 'dark') {
        document.documentElement.classList.add('dark');
    } else {
        // Default / system
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
            document.documentElement.classList.remove('dark');
        } else {
            document.documentElement.classList.add('dark');
        }
    }
}

function playSpeech(text) {
    try {
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'ja-JP';
            utterance.rate = currentSettings.audioSpeed || 1.0;
            utterance.volume = (currentSettings.audioVolume || 85) / 100;
            window.speechSynthesis.speak(utterance);
        }
    } catch (e) {
        // Ignore
    }
}

async function updateStorageEstimate() {
    try {
        if (navigator.storage && navigator.storage.estimate) {
            const {usage, quota} = await navigator.storage.estimate();
            const usageMB = Math.round((usage || 0) / (1024 * 1024));
            const statusText = document.getElementById('storage-status-text');
            const storageBar = document.getElementById('storage-bar');
            if (statusText) {
                statusText.textContent = `${usageMB} MB / Không giới hạn (IndexedDB cục bộ)`;
            }
            if (storageBar && quota) {
                const percent = Math.min(100, Math.max(5, Math.round((usage / quota) * 100)));
                storageBar.style.width = `${percent}%`;
            }
        }
    } catch (e) {
        // Fallback default
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    await loadSettings();
    applySettingsToUI();
    await updateStorageEstimate();

    // 1. Activation Key selector
    document.querySelectorAll('.key-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            currentSettings.activationKey = btn.getAttribute('data-key');
            applySettingsToUI();
            saveSettings();
        });
    });

    // 2. Hover delay slider
    const delaySlider = document.getElementById('input-hover-delay');
    if (delaySlider) {
        delaySlider.addEventListener('input', () => {
            currentSettings.hoverDelay = parseInt(delaySlider.value, 10);
            const delayLabel = document.getElementById('delay-label');
            if (delayLabel) {
                delayLabel.textContent = `${currentSettings.hoverDelay}ms${currentSettings.hoverDelay === 150 ? ' (Đề xuất)' : ''}`;
            }
        });
        delaySlider.addEventListener('change', () => {
            saveSettings();
        });
    }

    // 3. Scanning toggles
    const toggleSelect = document.getElementById('toggle-selection-scan');
    if (toggleSelect) {
        toggleSelect.addEventListener('change', () => {
            currentSettings.selectionScan = toggleSelect.checked;
            saveSettings();
        });
    }

    const toggleClip = document.getElementById('toggle-clipboard-scan');
    if (toggleClip) {
        toggleClip.addEventListener('change', () => {
            currentSettings.clipboardScan = toggleClip.checked;
            saveSettings();
        });
    }

    const toggleDocs = document.getElementById('toggle-docs-canvas');
    if (toggleDocs) {
        toggleDocs.addEventListener('change', () => {
            currentSettings.docsCanvas = toggleDocs.checked;
            saveSettings();
        });
    }

    // 4. Audio
    const testAudioBtn = document.getElementById('btn-test-audio');
    if (testAudioBtn) {
        testAudioBtn.addEventListener('click', () => {
            playSpeech('こんにちは、フェニックスへようこそ！');
        });
    }

    const toggleAutoplay = document.getElementById('toggle-autoplay-audio');
    if (toggleAutoplay) {
        toggleAutoplay.addEventListener('change', () => {
            currentSettings.autoPlayAudio = toggleAutoplay.checked;
            saveSettings();
        });
    }

    document.querySelectorAll('.speed-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            currentSettings.audioSpeed = parseFloat(btn.getAttribute('data-speed'));
            applySettingsToUI();
            saveSettings();
        });
    });

    const volSlider = document.getElementById('input-audio-volume');
    if (volSlider) {
        volSlider.addEventListener('input', () => {
            currentSettings.audioVolume = parseInt(volSlider.value, 10);
            const volLabel = document.getElementById('vol-label');
            if (volLabel) volLabel.textContent = `${currentSettings.audioVolume}%`;
        });
        volSlider.addEventListener('change', () => {
            saveSettings();
        });
    }

    document.querySelectorAll('input[name="audio-source"]').forEach(radio => {
        radio.addEventListener('change', () => {
            if (radio.checked) {
                currentSettings.audioSource = radio.value;
                const sidebarSourceLabel = document.getElementById('sidebar-audio-source-label');
                if (sidebarSourceLabel) sidebarSourceLabel.textContent = radio.value === 'jppod' ? 'Pod' : 'TTS';
                saveSettings();
            }
        });
    });

    // 5. Appearance toggles
    const toggleHanViet = document.getElementById('toggle-hanviet');
    if (toggleHanViet) {
        toggleHanViet.addEventListener('change', () => {
            currentSettings.hanVietHighlight = toggleHanViet.checked;
            const preview = document.getElementById('preview-hanviet');
            if (preview) preview.classList.toggle('hidden', !toggleHanViet.checked);
            saveSettings();
        });
    }

    const togglePitch = document.getElementById('toggle-pitch');
    if (togglePitch) {
        togglePitch.addEventListener('change', () => {
            currentSettings.pitchAccent = togglePitch.checked;
            const preview = document.getElementById('preview-pitch');
            if (preview) preview.classList.toggle('hidden', !togglePitch.checked);
            saveSettings();
        });
    }

    const toggleJlpt = document.getElementById('toggle-jlpt');
    if (toggleJlpt) {
        toggleJlpt.addEventListener('change', () => {
            currentSettings.jlptPosTags = toggleJlpt.checked;
            const preview = document.getElementById('preview-tags');
            if (preview) preview.classList.toggle('hidden', !toggleJlpt.checked);
            saveSettings();
        });
    }

    const selectLayout = document.getElementById('select-layout-mode');
    if (selectLayout) {
        selectLayout.addEventListener('change', () => {
            currentSettings.layoutMode = selectLayout.value;
            const previewExample = document.getElementById('preview-example-box');
            if (previewExample) {
                previewExample.classList.toggle('hidden', selectLayout.value === 'compact');
            }
            saveSettings();
        });
    }

    // Preview interactive buttons
    const previewPlayBtn = document.getElementById('preview-play-btn');
    if (previewPlayBtn) {
        previewPlayBtn.addEventListener('click', () => {
            playSpeech('にほんご');
        });
    }

    const previewStarBtn = document.getElementById('preview-star-btn');
    if (previewStarBtn) {
        let previewStarred = false;
        previewStarBtn.addEventListener('click', () => {
            previewStarred = !previewStarred;
            previewStarBtn.innerHTML = `<span class="material-symbols-outlined text-[18px]" style="font-variation-settings: 'FILL' ${previewStarred ? 1 : 0};">${previewStarred ? 'bookmark' : 'bookmark_border'}</span>`;
            previewStarBtn.classList.toggle('text-secondary', previewStarred);
        });
    }

    // 6. Theme switcher
    document.querySelectorAll('.theme-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            currentSettings.theme = btn.getAttribute('data-theme');
            applyTheme(currentSettings.theme);
            saveSettings();
        });
    });

    // 7. Dictionary import button
    const fileInput = document.getElementById('input-import-dict-file');
    const addDictBtn = document.getElementById('btn-add-custom-dict');
    if (addDictBtn && fileInput) {
        addDictBtn.addEventListener('click', () => {
            fileInput.click();
        });
        fileInput.addEventListener('change', () => {
            if (fileInput.files && fileInput.files.length > 0) {
                const file = fileInput.files[0];
                alert(`Đang chuẩn bị nạp từ điển: ${file.name}. Bạn có thể xem chi tiết trong Cài đặt Nâng cao.`);
            }
        });
    }

    // 8. Reset to defaults
    const resetBtn = document.getElementById('btn-reset-defaults');
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            if (confirm('Bạn có chắc chắn muốn khôi phục toàn bộ cài đặt về trạng thái mặc định ban đầu không?')) {
                currentSettings = {...defaultSettings};
                applySettingsToUI();
                saveSettings();
            }
        });
    }

    // 9. Export settings JSON
    const exportBtn = document.getElementById('btn-export-settings');
    if (exportBtn) {
        exportBtn.addEventListener('click', () => {
            const jsonStr = JSON.stringify(currentSettings, null, 2);
            const blob = new Blob([jsonStr], {type: 'application/json'});
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `fenixjpcatch-settings-${new Date().toISOString().slice(0, 10)}.json`;
            a.click();
            URL.revokeObjectURL(url);
        });
    }

    // 10. Import settings JSON
    const importFile = document.getElementById('input-import-settings-file');
    const importBtn = document.getElementById('btn-import-settings');
    if (importBtn && importFile) {
        importBtn.addEventListener('click', () => {
            importFile.click();
        });
        importFile.addEventListener('change', () => {
            if (importFile.files && importFile.files.length > 0) {
                const file = importFile.files[0];
                const reader = new FileReader();
                reader.onload = (e) => {
                    try {
                        const parsed = JSON.parse(e.target.result);
                        currentSettings = {...defaultSettings, ...parsed};
                        applySettingsToUI();
                        saveSettings();
                        alert('Nhập cấu hình thành công!');
                    } catch (err) {
                        alert('Tệp JSON không hợp lệ.');
                    }
                };
                reader.readAsText(file);
            }
        });
    }

    // 11. Search in settings filter
    const searchInput = document.getElementById('settings-search-input');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            const query = searchInput.value.toLowerCase().trim();
            document.querySelectorAll('.settings-card').forEach(card => {
                if (!query) {
                    card.classList.remove('hidden');
                } else {
                    const text = card.textContent.toLowerCase();
                    card.classList.toggle('hidden', !text.includes(query));
                }
            });
        });
    }
});
