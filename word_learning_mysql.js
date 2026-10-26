/**
 * word_learning_mysql.js
 * Frontend JavaScript kết nối trực tiếp với backend PHP & MySQL API
 */

(function () {
    'use strict';

    let currentWords = [];
    let activeWordIndex = 0;
    let quizCurrentQuestion = null;
    let quizScore = 0;
    let quizQuestionIndex = 0;
    let isPodcastPlaying = false;
    let podcastTimer = null;
    let recognition = null;
    let isRecording = false;

    // ==================== KHỞI CHẠY HỆ THỐNG ====================
    document.addEventListener('DOMContentLoaded', () => {
        initTheme();
        initModeTabs();
        initSearch();
        initKeyboard();
        loadUnitData(APP_CONFIG.currentBookId, APP_CONFIG.currentUnitId);
    });

    // ==================== GIAO DIỆN CHỦ ĐỀ (THEMES) ====================
    function initTheme() {
        const savedTheme = localStorage.getItem('wl_theme') || 'dark';
        document.body.setAttribute('data-theme', savedTheme);

        // Nút đổi theme
        document.querySelectorAll('[data-set-theme]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const theme = btn.getAttribute('data-set-theme');
                document.body.setAttribute('data-theme', theme);
                localStorage.setItem('wl_theme', theme);
                showToast(`Đã chuyển sang chủ đề: ${btn.getAttribute('title') || theme}`);
                document.getElementById('settingsDropdownMenu')?.classList.add('hidden');
            });
        });

        // Nút mở menu cài đặt
        const btnSettings = document.getElementById('btnOpenSettings');
        const settingsMenu = document.getElementById('settingsDropdownMenu');
        if (btnSettings && settingsMenu) {
            btnSettings.addEventListener('click', (e) => {
                e.stopPropagation();
                settingsMenu.classList.toggle('hidden');
            });
            document.addEventListener('click', (e) => {
                if (!e.target.closest('#settingsMenuWrapper')) {
                    settingsMenu.classList.add('hidden');
                }
            });
        }
    }

    // ==================== CHUYỂN ĐỔI CHẾ ĐỘ HỌC (TABS) ====================
    function initModeTabs() {
        const tabs = document.querySelectorAll('.sm-tab');
        const panes = document.querySelectorAll('.mode-pane');

        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const mode = tab.getAttribute('data-mode');
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');

                panes.forEach(p => p.classList.remove('active'));
                const targetPane = document.getElementById('pane' + mode.charAt(0).toUpperCase() + mode.slice(1));
                if (targetPane) targetPane.classList.add('active');

                // Kích hoạt logic riêng của từng chế độ
                if (mode === 'flashcard') {
                    renderFlashcard();
                } else if (mode === 'quiz') {
                    startQuiz();
                } else if (mode === 'shadowing') {
                    updateShadowingCard();
                }
            });
        });

        // Đọc cả bài
        const btnSpeakAll = document.getElementById('btnToggleSpeakAll');
        if (btnSpeakAll) {
            btnSpeakAll.addEventListener('click', toggleSpeakAll);
        }

        // Mở Podcast
        const btnOpenPodcast = document.getElementById('btnOpenPodcast');
        if (btnOpenPodcast) {
            btnOpenPodcast.addEventListener('click', openPodcast);
        }
    }

    // ==================== TẢI DỮ LIỆU TỪ BACKEND MYSQL ====================
    window.loadUnitData = async function (bookId, unitId, filter = 'all') {
        const wrapper = document.getElementById('wordsGridWrapper');
        if (wrapper) {
            wrapper.innerHTML = `<div class="loading-state" style="padding:40px; text-align:center; color:#94a3b8;">⏳ Đang tải từ vựng từ MySQL...</div>`;
        }

        try {
            const url = `api/vocab.php?book_id=${bookId}&unit_id=${unitId}&filter=${filter}`;
            const res = await fetch(url);
            const data = await res.json();

            if (data.status === 'success') {
                currentWords = data.words || [];
                activeWordIndex = 0;

                // Cập nhật Header & Stats
                document.getElementById('heroUnitBadge').innerText = data.current_unit ? `Bài ${data.current_unit.unit_number}` : 'HSK';
                document.getElementById('heroUnitTitle').innerText = data.current_unit ? data.current_unit.title : 'Từ vựng';
                document.getElementById('heroUnitDesc').innerText = data.current_unit ? (data.current_unit.description || '') : '';
                document.getElementById('heroWordCount').innerText = currentWords.length;

                renderWordsList(currentWords);
                renderFlashcard();
            } else {
                if (wrapper) {
                    wrapper.innerHTML = `<div style="padding:40px; text-align:center; color:#ef4444;">⚠️ ${data.message || 'Lỗi tải dữ liệu.'}</div>`;
                }
            }
        } catch (err) {
            console.error('Fetch error:', err);
            if (wrapper) {
                wrapper.innerHTML = `<div style="padding:40px; text-align:center; color:#ef4444;">⚠️ Không thể kết nối với máy chủ API. Vui lòng kiểm tra MySQL và Apache.</div>`;
            }
        }
    };

    window.switchBook = function (bookId) {
        window.location.href = `word_learning.php?book_id=${bookId}`;
    };

    window.selectUnit = function (unitId, unitNum) {
        document.querySelectorAll('.unit-item').forEach(i => i.classList.remove('active'));
        const el = document.querySelector(`[data-unit-id="${unitId}"]`);
        if (el) el.classList.add('active');

        APP_CONFIG.currentUnitId = unitId;
        loadUnitData(APP_CONFIG.currentBookId, unitId);
    };

    // ==================== HIỂN THỊ DANH SÁCH TỪ VỰNG ====================
    function renderWordsList(words) {
        const wrapper = document.getElementById('wordsGridWrapper');
        if (!wrapper) return;

        if (words.length === 0) {
            wrapper.innerHTML = `<div style="padding:40px; text-align:center; color:#94a3b8;">Không có từ vựng nào trong danh sách này.</div>`;
            return;
        }

        let html = '<div class="words-cards-list">';
        words.forEach((w, idx) => {
            const isFav = w.is_favorite ? 'active' : '';
            const isDiff = w.is_difficult ? 'active' : '';

            // Render ví dụ
            let exHtml = '';
            if (w.examples && w.examples.length > 0) {
                exHtml = '<div class="word-card-examples">';
                w.examples.forEach(ex => {
                    exHtml += `
                        <div class="wc-ex-row" onclick="speakText('${escapeQuotes(ex.hz)}')">
                            <div class="wc-ex-hz">💬 ${ex.hz}</div>
                            <div class="wc-ex-py">${ex.py}</div>
                            <div class="wc-ex-vn">${ex.vn}</div>
                        </div>
                    `;
                });
                exHtml += '</div>';
            }

            html += `
                <div class="word-card-item" id="wordCard_${w.id}">
                    <div class="wc-left">
                        <div class="wc-num">#${idx + 1}</div>
                        <div class="wc-hanzi-wrap">
                            <span class="wc-hanzi" onclick="speakText('${w.word}')" title="Nhấn để nghe">${w.word}</span>
                            ${w.traditional && w.traditional !== w.word ? `<span class="wc-trad">${w.traditional}</span>` : ''}
                        </div>
                        <div class="wc-pinyin">${w.pinyin}</div>
                        ${w.han_viet ? `<div class="wc-hanviet">Hán Việt: <strong>${w.han_viet}</strong></div>` : ''}
                    </div>

                    <div class="wc-mid">
                        <div class="wc-meaning-row">
                            <span class="wc-pos-tag">${w.pos || 'từ'}</span>
                            <span class="wc-meaning">${w.meaning_vi}</span>
                        </div>
                        ${w.meaning_en ? `<div class="wc-meaning-en">${w.meaning_en}</div>` : ''}
                        ${w.mnemonic ? `<div class="wc-mnemonic">💡 <em>${w.mnemonic}</em></div>` : ''}
                        ${exHtml}
                    </div>

                    <div class="wc-actions">
                        <button class="wc-btn-speak" onclick="speakText('${w.word}')" title="Phát âm">
                            🔊
                        </button>
                        <button class="wc-btn-star ${isFav}" onclick="toggleStarWord(${w.id}, this)" title="Lưu từ yêu thích">
                            ⭐
                        </button>
                        <button class="wc-btn-srs ${isDiff}" onclick="toggleDifficultWord(${w.id}, this)" title="Đánh dấu từ khó (SRS)">
                            🧠
                        </button>
                    </div>
                </div>
            `;
        });
        html += '</div>';

        wrapper.innerHTML = html;
    }

    // ==================== TƯƠNG TÁC LƯU TIẾN ĐỘ MYSQL ====================
    window.toggleStarWord = async function (vocabId, btn) {
        try {
            const formData = new FormData();
            formData.append('action', 'toggle_favorite');
            formData.append('vocab_id', vocabId);

            const res = await fetch('api/progress.php', { method: 'POST', body: formData });
            const data = await res.json();

            if (data.status === 'success') {
                if (btn) btn.classList.toggle('active', data.is_favorite);
                // Cập nhật mảng local
                const target = currentWords.find(w => w.id == vocabId);
                if (target) target.is_favorite = data.is_favorite;
                showToast(data.message);
            } else if (data.status === 'guest') {
                showToast(data.message, 'warning');
            } else {
                showToast(data.message || 'Lỗi thao tác', 'error');
            }
        } catch (err) {
            console.error(err);
        }
    };

    window.toggleDifficultWord = async function (vocabId, btn) {
        try {
            const formData = new FormData();
            formData.append('action', 'toggle_difficult');
            formData.append('vocab_id', vocabId);

            const res = await fetch('api/progress.php', { method: 'POST', body: formData });
            const data = await res.json();

            if (data.status === 'success') {
                if (btn) btn.classList.toggle('active', data.is_difficult);
                const target = currentWords.find(w => w.id == vocabId);
                if (target) target.is_difficult = data.is_difficult;

                // Cập nhật badge đếm
                const srsBadge = document.getElementById('hdrSrsCount');
                if (srsBadge) {
                    let cur = parseInt(srsBadge.innerText) || 0;
                    srsBadge.innerText = Math.max(0, cur + (data.is_difficult ? 1 : -1));
                }
                showToast(data.message);
            } else if (data.status === 'guest') {
                showToast(data.message, 'warning');
            } else {
                showToast(data.message || 'Lỗi thao tác', 'error');
            }
        } catch (err) {
            console.error(err);
        }
    };

    // ==================== CHẾ ĐỘ THẺ GHI NHỚ FLASHCARD 3D ====================
    function renderFlashcard() {
        if (!currentWords || currentWords.length === 0) return;
        const w = currentWords[activeWordIndex] || currentWords[0];
        if (!w) return;

        document.getElementById('fcCounter').innerText = `${activeWordIndex + 1} / ${currentWords.length}`;
        document.getElementById('fcFrontHz').innerText = w.word;
        document.getElementById('fcBackHz').innerText = w.word;
        document.getElementById('fcBackPy').innerText = w.pinyin;
        document.getElementById('fcBackVn').innerText = w.meaning_vi;
        document.getElementById('fcBackHanViet').innerText = `Hán Việt: ${w.han_viet || '—'} · ${w.pos || ''}`;

        let exText = '';
        if (w.examples && w.examples.length > 0) {
            exText = `${w.examples[0].hz} (${w.examples[0].vn})`;
        }
        document.getElementById('fcBackEx').innerText = exText;

        const starBtn = document.getElementById('btnFcStar');
        if (starBtn) {
            starBtn.style.color = w.is_favorite ? '#f59e0b' : '';
        }

        // Reset flip
        document.getElementById('fcCardInner').classList.remove('flipped');

        if (document.getElementById('fcAutoSpeakCheck')?.checked) {
            speakText(w.word);
        }
    }

    window.flipFlashcard = function () {
        const card = document.getElementById('fcCardInner');
        if (card) {
            card.classList.toggle('flipped');
        }
    };

    window.nextFlashcard = function () {
        if (activeWordIndex < currentWords.length - 1) {
            activeWordIndex++;
            renderFlashcard();
        } else {
            activeWordIndex = 0;
            renderFlashcard();
            showToast('Đã hoàn thành vòng thẻ ghi nhớ!');
        }
    };

    window.prevFlashcard = function () {
        if (activeWordIndex > 0) {
            activeWordIndex--;
            renderFlashcard();
        }
    };

    window.speakCurrentFc = function () {
        const w = currentWords[activeWordIndex];
        if (w) speakText(w.word);
    };

    window.toggleCurrentWordStar = function () {
        const w = currentWords[activeWordIndex];
        if (w) {
            toggleStarWord(w.id, null);
            w.is_favorite = !w.is_favorite;
            const starBtn = document.getElementById('btnFcStar');
            if (starBtn) starBtn.style.color = w.is_favorite ? '#f59e0b' : '';
        }
    };

    // ==================== CHẾ ĐỘ TRẮC NGHIỆM QUIZ ====================
    window.startQuiz = function () {
        if (!currentWords || currentWords.length < 4) {
            document.getElementById('paneQuiz').innerHTML = '<div style="padding:40px; text-align:center; color:#94a3b8;">Cần ít nhất 4 từ vựng trong bài học để tạo bài Quiz.</div>';
            return;
        }
        quizScore = 0;
        quizQuestionIndex = 0;
        renderQuizQuestion();
    };

    function renderQuizQuestion() {
        if (quizQuestionIndex >= currentWords.length) {
            // Hoàn thành quiz
            document.getElementById('quizOptionsGrid').innerHTML = `
                <div style="grid-column: 1/-1; text-align:center; padding: 30px;">
                    <div style="font-size:40px; margin-bottom:10px;">🎉</div>
                    <h3 style="color:#fff; margin-bottom:8px;">Hoàn thành bài Quiz!</h3>
                    <p style="color:#34d399; font-size:18px; font-weight:700;">Điểm của bạn: ${quizScore} XP</p>
                    <button class="btn-pill btn-primary" onclick="startQuiz()" style="margin-top:20px; padding:10px 24px;">🔄 Làm Lại Quiz</button>
                </div>
            `;
            // Gửi điểm cộng XP lên server
            if (quizScore > 0) {
                const fd = new FormData();
                fd.append('action', 'add_xp');
                fd.append('xp', quizScore);
                fetch('api/progress.php', { method: 'POST', body: fd });
            }
            return;
        }

        const targetWord = currentWords[quizQuestionIndex];
        quizCurrentQuestion = targetWord;

        document.getElementById('quizCounterText').innerText = `Câu ${quizQuestionIndex + 1} / ${currentWords.length}`;
        document.getElementById('quizScoreText').innerText = `Điểm: ${quizScore} XP`;
        document.getElementById('quizProgressBar').style.width = `${((quizQuestionIndex) / currentWords.length) * 100}%`;

        document.getElementById('quizWord').innerText = targetWord.word;
        document.getElementById('quizPinyin').innerText = targetWord.pinyin;

        // Sinh 3 đáp án sai ngẫu nhiên
        const distractors = currentWords.filter(w => w.id !== targetWord.id)
            .sort(() => 0.5 - Math.random())
            .slice(0, 3);

        const options = [targetWord, ...distractors].sort(() => 0.5 - Math.random());
        const letters = ['A', 'B', 'C', 'D'];

        let optHtml = '';
        options.forEach((opt, idx) => {
            optHtml += `
                <button class="quiz-option-btn" onclick="checkQuizAnswer(${opt.id === targetWord.id}, this)">
                    <span class="q-opt-key">${letters[idx]}</span>
                    <span class="q-opt-text">${opt.meaning_vi}</span>
                </button>
            `;
        });

        document.getElementById('quizOptionsGrid').innerHTML = optHtml;
        speakText(targetWord.word);
    }

    window.speakQuizWord = function () {
        if (quizCurrentQuestion) speakText(quizCurrentQuestion.word);
    };

    window.checkQuizAnswer = function (isCorrect, btn) {
        const allBtns = document.querySelectorAll('.quiz-option-btn');
        allBtns.forEach(b => b.disabled = true);

        if (isCorrect) {
            btn.classList.add('correct');
            quizScore += 10;
            showToast('Chính xác! +10 XP', 'success');
        } else {
            btn.classList.add('wrong');
            showToast('Chưa chính xác!', 'error');
        }

        setTimeout(() => {
            quizQuestionIndex++;
            renderQuizQuestion();
        }, 1200);
    };

    // ==================== PHÁT ÂM (WEB SPEECH SYNTHESIS) ====================
    window.speakText = function (text) {
        if (!('speechSynthesis' in window)) return;
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'zh-CN';
        utterance.rate = 0.9;
        window.speechSynthesis.speak(utterance);
    };

    function toggleSpeakAll() {
        if (!currentWords || currentWords.length === 0) return;
        let idx = 0;
        const btn = document.getElementById('lblSpeakAll');

        function speakNext() {
            if (idx >= currentWords.length) {
                if (btn) btn.innerText = 'Đọc cả bài';
                return;
            }
            if (btn) btn.innerText = `Đang đọc (${idx + 1}/${currentWords.length})`;
            const w = currentWords[idx];
            speakText(w.word);

            // Highlight từ đang đọc
            document.querySelectorAll('.word-card-item').forEach(c => c.style.borderColor = '');
            const card = document.getElementById(`wordCard_${w.id}`);
            if (card) {
                card.style.borderColor = '#4f46e5';
                card.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }

            idx++;
            setTimeout(speakNext, 2200);
        }

        speakNext();
    }

    // ==================== PODCAST RẢNH TAY ====================
    window.openPodcast = function () {
        document.getElementById('podcastPlayerBar')?.classList.remove('hidden');
        updatePodcastUI();
    };

    window.closePodcast = function () {
        document.getElementById('podcastPlayerBar')?.classList.add('hidden');
        if (podcastTimer) clearInterval(podcastTimer);
        isPodcastPlaying = false;
        document.getElementById('btnPodcastPlay').innerText = '▶️';
    };

    window.togglePodcastPlay = function () {
        isPodcastPlaying = !isPodcastPlaying;
        document.getElementById('btnPodcastPlay').innerText = isPodcastPlaying ? '⏸️' : '▶️';

        if (isPodcastPlaying) {
            runPodcastStep();
        } else {
            clearTimeout(podcastTimer);
        }
    };

    function runPodcastStep() {
        if (!isPodcastPlaying || currentWords.length === 0) return;
        const w = currentWords[activeWordIndex];
        if (!w) return;

        updatePodcastUI();
        speakText(w.word);

        podcastTimer = setTimeout(() => {
            if (activeWordIndex < currentWords.length - 1) {
                activeWordIndex++;
            } else {
                activeWordIndex = 0;
            }
            runPodcastStep();
        }, 3000);
    }

    function updatePodcastUI() {
        const w = currentWords[activeWordIndex] || currentWords[0];
        if (!w) return;
        document.getElementById('ppbHz').innerText = w.word;
        document.getElementById('ppbPy').innerText = w.pinyin;
        document.getElementById('ppbVn').innerText = w.meaning_vi;
        document.getElementById('ppbCounter').innerText = `${activeWordIndex + 1} / ${currentWords.length}`;
    }

    window.nextPodcast = function () {
        if (activeWordIndex < currentWords.length - 1) activeWordIndex++;
        updatePodcastUI();
        speakText(currentWords[activeWordIndex].word);
    };

    window.prevPodcast = function () {
        if (activeWordIndex > 0) activeWordIndex--;
        updatePodcastUI();
        speakText(currentWords[activeWordIndex].word);
    };

    // ==================== LUYỆN NÓI & SHADOWING ====================
    function updateShadowingCard() {
        const w = currentWords[activeWordIndex] || currentWords[0];
        if (!w) return;
        document.getElementById('shadCurrentHz').innerText = w.word;
        document.getElementById('shadCurrentPy').innerText = w.pinyin;
        document.getElementById('shadCurrentVn').innerText = w.meaning_vi;
    }

    window.speakCurrentWord = function () {
        const w = currentWords[activeWordIndex] || currentWords[0];
        if (w) speakText(w.word);
    };

    window.toggleVoiceRecord = function () {
        const btn = document.getElementById('btnRecordMic');
        const resBox = document.getElementById('shadResultBox');
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

        if (!SpeechRecognition) {
            resBox.innerHTML = '<span style="color:#ef4444;">Trình duyệt của bạn chưa hỗ trợ Web Speech API. Hãy dùng Chrome hoặc Edge.</span>';
            return;
        }

        if (isRecording) {
            if (recognition) recognition.stop();
            isRecording = false;
            btn.innerText = '🎙️ Bắt Đầu Nói';
            return;
        }

        recognition = new SpeechRecognition();
        recognition.lang = 'zh-CN';
        recognition.interimResults = false;

        recognition.onstart = () => {
            isRecording = true;
            btn.innerText = '🔴 Đang nghe... Hãy đọc to';
            resBox.innerHTML = '<span style="color:#38bdf8;">Đang lắng nghe giọng bạn...</span>';
        };

        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            const targetWord = (currentWords[activeWordIndex] || currentWords[0]).word;

            const isMatch = transcript.trim() === targetWord.trim() || transcript.includes(targetWord);
            if (isMatch) {
                resBox.innerHTML = `
                    <div style="color:#34d399; font-weight:700; font-size:16px;">🌟 Phát âm rất chuẩn!</div>
                    <div style="margin-top:6px;">AI nhận diện: <strong>“${transcript}”</strong> (Đúng 100%)</div>
                `;
            } else {
                resBox.innerHTML = `
                    <div style="color:#fb923c; font-weight:700;">AI nhận diện bạn đã nói: “${transcript}”</div>
                    <div style="margin-top:6px; color:#cbd5e1;">Mục tiêu cần đọc: <strong>${targetWord}</strong>. Hãy thử lại nhé!</div>
                `;
            }
        };

        recognition.onerror = (e) => {
            resBox.innerHTML = `<span style="color:#ef4444;">Lỗi micro hoặc chưa cấp quyền: ${e.error}</span>`;
            isRecording = false;
            btn.innerText = '🎙️ Bắt Đầu Nói';
        };

        recognition.onend = () => {
            isRecording = false;
            btn.innerText = '🎙️ Bắt Đầu Nói';
        };

        recognition.start();
    };

    // ==================== TÌM KIẾM TOÀN CỤC ====================
    function initSearch() {
        const input = document.getElementById('globalWordSearch');
        const clearBtn = document.getElementById('clearGlobalSearch');
        if (!input) return;

        let debounce = null;
        input.addEventListener('input', () => {
            const val = input.value.trim();
            if (clearBtn) clearBtn.classList.toggle('hidden', val.length === 0);

            clearTimeout(debounce);
            debounce = setTimeout(async () => {
                if (val.length > 0) {
                    const res = await fetch(`api/vocab.php?search=${encodeURIComponent(val)}`);
                    const data = await res.json();
                    if (data.status === 'success') {
                        currentWords = data.words;
                        renderWordsList(currentWords);
                    }
                } else {
                    loadUnitData(APP_CONFIG.currentBookId, APP_CONFIG.currentUnitId);
                }
            }, 300);
        });

        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                input.value = '';
                clearBtn.classList.add('hidden');
                loadUnitData(APP_CONFIG.currentBookId, APP_CONFIG.currentUnitId);
            });
        }
    }

    // ==================== PHÍM TẮT BÀN PHÍM ====================
    function initKeyboard() {
        document.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

            const activePane = document.querySelector('.mode-pane.active');
            if (activePane && activePane.id === 'paneFlashcard') {
                if (e.code === 'Space') {
                    e.preventDefault();
                    flipFlashcard();
                } else if (e.code === 'ArrowRight') {
                    nextFlashcard();
                } else if (e.code === 'ArrowLeft') {
                    prevFlashcard();
                }
            } else if (activePane && activePane.id === 'paneQuiz') {
                const keys = ['1', '2', '3', '4', 'KeyA', 'KeyB', 'KeyC', 'KeyD'];
                const btns = document.querySelectorAll('.quiz-option-btn');
                if (e.key === '1' || e.code === 'KeyA') btns[0]?.click();
                if (e.key === '2' || e.code === 'KeyB') btns[1]?.click();
                if (e.key === '3' || e.code === 'KeyC') btns[2]?.click();
                if (e.key === '4' || e.code === 'KeyD') btns[3]?.click();
            }
        });
    }

    // ==================== TIỆN ÍCH (TOAST & ESCAPE) ====================
    function showToast(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `wl-toast ${type}`;
        toast.innerText = message;
        container.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 2500);
    }

    function escapeQuotes(str) {
        return (str || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
    }

})();
