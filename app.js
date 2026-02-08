// ===== PSAT EXAM APPLICATION =====
const App = {
    // 상태
    questions: [],
    currentQuestions: [],
    currentIndex: 0,
    selectedAnswers: {},
    stats: {},
    starred: new Set(),
    deleted: new Set(),
    settings: {
        questionCount: 25,
        timeLimit: 90
    },
    
    // 타이머
    timer: 0,
    timerInterval: null,
    studyMode: 'random',

    // ===== 초기화 =====
    init() {
        // 저장된 API 설정 복원
        const savedKey = Storage.load('psat_api_key');
        const savedModel = Storage.load('psat_api_model');
        if (savedKey) CONFIG.CLAUDE_API_KEY = savedKey;
        if (savedModel) CONFIG.CLAUDE_MODEL = savedModel;
        
        this.loadData();
        this.updateDDay();
        this.updateDashboard();
        this.updateReportCount();
        console.log('PSAT initialized');
    },

    loadData() {
        // 기본 문제 데이터 로드
        const freshQuestions = initializeQuestions();
        console.log('Fresh questions loaded:', freshQuestions.length);
        
        if (freshQuestions.length > 0) {
            // 저장된 AI 생성 문제 보존
            const savedQuestions = Storage.load(STORAGE_KEYS.QUESTIONS, []);
            const aiQuestions = savedQuestions.filter(q => q.isAI === true);
            console.log('Preserved AI questions:', aiQuestions.length);
            
            // 기본 문제 + AI 문제 병합
            this.questions = [...freshQuestions, ...aiQuestions];
            Storage.save(STORAGE_KEYS.QUESTIONS, this.questions);
        } else {
            // 저장된 문제 불러오기
            this.questions = Storage.load(STORAGE_KEYS.QUESTIONS, []);
        }
        
        this.stats = Storage.load(STORAGE_KEYS.STATS, {});
        this.starred = new Set(Storage.load(STORAGE_KEYS.STARRED, []));
        this.deleted = new Set(Storage.load(STORAGE_KEYS.DELETED, []));
        this.questions = this.questions.filter(q => !this.deleted.has(String(q.id)));
        
        console.log('Final questions count:', this.questions.length);
        
        const savedSettings = Storage.load(STORAGE_KEYS.SETTINGS);
        if (savedSettings) {
            this.settings = { ...this.settings, ...savedSettings };
        }
    },

    updateDDay() {
        const examDate = new Date(CONFIG.EXAM_DATE);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const diff = Math.ceil((examDate - today) / (1000 * 60 * 60 * 24));
        const el = document.getElementById('d-day');
        if (el) el.textContent = diff > 0 ? `D-${diff}` : '시험완료';
    },

    // ===== 대시보드 =====
    updateDashboard() {
        // 기본 통계
        const totalSolved = Object.keys(this.stats).length;
        this.setText('stat-total', totalSolved);
        this.setText('stat-total-questions', this.questions.length);

        // 정답률 계산
        let totalAttempts = 0, totalCorrect = 0;
        Object.values(this.stats).forEach(s => {
            totalAttempts += s.attempts || 0;
            totalCorrect += s.correct || 0;
        });
        const accuracy = totalAttempts > 0 ? Math.round((totalCorrect / totalAttempts) * 100) : 0;
        this.setText('stat-accuracy', `${accuracy}%`);

        // 오늘 풀이 수
        const today = new Date().toDateString();
        const todaySolved = Object.values(this.stats).filter(s => 
            s.lastAttempt && new Date(s.lastAttempt).toDateString() === today
        ).length;
        this.setText('stat-today', todaySolved);

        // 취약 문제 수
        const weakCount = this.getWeaknessQuestions().length;
        this.setText('stat-weak', weakCount);
        this.setText('weakness-count', `${weakCount}문제`);

        // 영역별 문제 수 (모드 카드)
        const mathQuestions = this.questions.filter(q => 
            (q.category || CONFIG.AREA_TO_CATEGORY[q.area]) === 'MATH'
        );
        const langQuestions = this.questions.filter(q => 
            (q.category || CONFIG.AREA_TO_CATEGORY[q.area]) === 'LANG'
        );
        this.setText('math-count', `${mathQuestions.length}문제`);
        this.setText('lang-count', `${langQuestions.length}문제`);

        // 영역별 분석
        this.updateAreaAnalysis();

        // 중요 문제
        this.setText('starred-count', `${this.starred.size}문제`);
        
        // 전체 문제 수
        this.setText('archive-count', `${this.questions.length}문제`);
    },

    updateAreaAnalysis() {
        ['MATH', 'LANG'].forEach(cat => {
            const areaQuestions = this.questions.filter(q => 
                (q.category || CONFIG.AREA_TO_CATEGORY[q.area]) === cat
            );
            
            let attempts = 0, correct = 0;
            areaQuestions.forEach(q => {
                const s = this.stats[q.id];
                if (s) {
                    attempts += s.attempts || 0;
                    correct += s.correct || 0;
                }
            });
            
            const accuracy = attempts > 0 ? Math.round((correct / attempts) * 100) : 50;
            const solved = areaQuestions.filter(q => this.stats[q.id]).length;
            
            const fillEl = document.getElementById(`${cat.toLowerCase()}-fill`);
            const statsEl = document.getElementById(`${cat.toLowerCase()}-stats`);
            
            if (fillEl) {
                fillEl.style.width = `${accuracy}%`;
                fillEl.textContent = `${accuracy}%`;
            }
            if (statsEl) {
                statsEl.textContent = `${solved}/${areaQuestions.length} 풀이`;
            }
        });
    },

    getWeaknessQuestions() {
        return this.questions.filter(q => {
            const s = this.stats[q.id];
            if (!s) return false;
            return s.attempts > 0 && (s.correct / s.attempts) < 0.5;
        });
    },

    getWrongQuestions() {
        return this.questions.filter(q => this.stats[q.id]?.lastWrong);
    },

    // ===== 화면 전환 =====
    showScreen(id) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        const screen = document.getElementById(`screen-${id}`);
        if (screen) screen.classList.add('active');

        if (id === 'review') this.renderReviewList('starred');
        else if (id === 'ai-generate') {
            document.getElementById('ai-form').style.display = 'block';
            document.getElementById('ai-loading').classList.remove('active');
        } else if (id === 'dashboard') this.updateDashboard();
        else if (id === 'settings') this.loadSettings();
        else if (id === 'archive') this.renderArchive();
    },

    // ===== 학습 =====
    startStudy(mode) {
        this.studyMode = mode;
        this.selectedAnswers = {};
        this.currentIndex = 0;

        if (mode === 'weakness') {
            this.currentQuestions = this.getWeaknessQuestions();
            if (this.currentQuestions.length === 0) {
                this.toast('취약 문제가 없습니다!');
                return;
            }
        } else if (mode === 'wrong') {
            this.currentQuestions = this.getWrongQuestions();
            if (this.currentQuestions.length === 0) {
                this.toast('오답 문제가 없습니다!');
                return;
            }
        } else if (mode === 'math') {
            this.currentQuestions = this.questions
                .filter(q => (q.category || CONFIG.AREA_TO_CATEGORY[q.area]) === 'MATH')
                .sort(() => Math.random() - 0.5)
                .slice(0, this.settings.questionCount);
        } else if (mode === 'lang') {
            this.currentQuestions = this.questions
                .filter(q => (q.category || CONFIG.AREA_TO_CATEGORY[q.area]) === 'LANG')
                .sort(() => Math.random() - 0.5)
                .slice(0, this.settings.questionCount);
        } else {
            // random - 전체에서 랜덤
            this.currentQuestions = [...this.questions]
                .sort(() => Math.random() - 0.5)
                .slice(0, this.settings.questionCount);
        }

        if (this.currentQuestions.length === 0) {
            this.toast('문제가 없습니다');
            return;
        }

        this.startTimer();
        this.setText('q-total', this.currentQuestions.length);
        this.showScreen('study');
        this.renderQuestion();
    },

    startTimer() {
        this.timer = 0;
        if (this.timerInterval) clearInterval(this.timerInterval);
        this.timerInterval = setInterval(() => {
            this.timer++;
            this.updateTimerDisplay();
        }, 1000);
    },

    updateTimerDisplay() {
        const mins = Math.floor(this.timer / 60);
        const secs = this.timer % 60;
        const el = document.getElementById('study-timer');
        if (el) {
            el.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
            el.classList.remove('warning', 'danger');
            if (this.timer > this.settings.timeLimit * 60) el.classList.add('danger');
            else if (this.timer > (this.settings.timeLimit - 15) * 60) el.classList.add('warning');
        }
    },

    renderQuestion() {
        const q = this.currentQuestions[this.currentIndex];
        if (!q) return;

        const isStarred = this.starred.has(q.id);
        const selected = this.selectedAnswers[q.id];
        const showSol = selected !== undefined;
        const category = q.category || CONFIG.AREA_TO_CATEGORY[q.area] || 'MATH';
        const categoryInfo = CONFIG.AREAS[category];
        const catLabel = category === 'MATH' ? '수리·논리' : '독해·요약';

        this.setText('q-current', this.currentIndex + 1);

        const viewport = document.getElementById('paper-viewport');
        if (!viewport) return;

        viewport.innerHTML = `
            <div class="paper-sheet">
                <div class="question-header">
                    <div class="question-meta">
                        <span class="meta-badge ${category.toLowerCase()}">${catLabel}</span>
                        <span class="meta-badge level">Lv.${q.level}</span>
                        ${q.isAI ? '<span class="meta-badge ai">AI생성</span>' : ''}
                    </div>
                    <div class="question-actions">
                        <button class="icon-btn ${isStarred ? 'starred' : ''}" onclick="App.toggleStar()">${isStarred ? '★' : '☆'}</button>
                        <button class="icon-btn delete" onclick="App.deleteQuestion()">🗑</button>
                    </div>
                </div>

                <div class="question-number">문 ${this.currentIndex + 1}.</div>
                
                <div class="passage-box">
                    <div class="passage-label">[${q.code || category}] 다음을 읽고 물음에 답하시오.</div>
                    <div class="passage-content">${q.stem.replace(/\n/g, '<br>')}</div>
                </div>

                <ul class="options-list">
                    ${q.options.map((opt, i) => {
                        let cls = 'option-item';
                        if (selected === i) cls += i === q.answerIndex ? ' correct' : ' wrong';
                        else if (showSol && i === q.answerIndex) cls += ' correct';
                        return `
                            <li class="${cls}" onclick="App.selectAnswer(${i})">
                                <span class="option-number">${i + 1}</span>
                                <span class="option-text">${opt}</span>
                            </li>`;
                    }).join('')}
                </ul>

                <div class="solution-box ${showSol ? 'show' : ''}">
                    <div class="solution-title">📝 해설</div>
                    <div class="solution-content">${q.solution || '해설이 없습니다.'}</div>
                </div>
            </div>`;
        
        viewport.scrollTop = 0;
    },

    selectAnswer(idx) {
        const q = this.currentQuestions[this.currentIndex];
        if (!q || this.selectedAnswers[q.id] !== undefined) return;

        this.selectedAnswers[q.id] = idx;
        const correct = idx === q.answerIndex;

        if (!this.stats[q.id]) this.stats[q.id] = { attempts: 0, correct: 0, lastWrong: false };
        this.stats[q.id].attempts++;
        if (correct) {
            this.stats[q.id].correct++;
            this.stats[q.id].lastWrong = false;
        } else {
            this.stats[q.id].lastWrong = true;
        }
        this.stats[q.id].lastAttempt = Date.now();

        Storage.save(STORAGE_KEYS.STATS, this.stats);
        this.renderQuestion();
        this.toast(correct ? '정답입니다! ✓' : '오답입니다 ✗');
    },

    toggleStar() {
        const q = this.currentQuestions[this.currentIndex];
        if (!q) return;
        if (this.starred.has(q.id)) {
            this.starred.delete(q.id);
            this.toast('중요 표시 해제');
        } else {
            this.starred.add(q.id);
            this.toast('중요 문제로 표시 ⭐');
        }
        Storage.save(STORAGE_KEYS.STARRED, [...this.starred]);
        this.renderQuestion();
    },

    deleteQuestion() {
        const q = this.currentQuestions[this.currentIndex];
        if (!q) return;
        this.confirm('문제 삭제', '이 문제를 삭제하시겠습니까?', () => {
            this.deleted.add(q.id);
            Storage.save(STORAGE_KEYS.DELETED, [...this.deleted]);
            this.currentQuestions.splice(this.currentIndex, 1);
            this.questions = this.questions.filter(x => x.id !== q.id);

            if (this.currentQuestions.length === 0) {
                this.finishStudy();
            } else {
                if (this.currentIndex >= this.currentQuestions.length) this.currentIndex--;
                this.setText('q-total', this.currentQuestions.length);
                this.renderQuestion();
            }
            this.toast('삭제되었습니다');
        });
    },

    prevQuestion() {
        if (this.currentIndex > 0) {
            this.currentIndex--;
            this.renderQuestion();
        }
    },

    nextQuestion() {
        if (this.currentIndex < this.currentQuestions.length - 1) {
            this.currentIndex++;
            this.renderQuestion();
        } else {
            this.finishStudy();
        }
    },

    exitStudy() {
        this.confirm('학습 종료', '학습을 종료하시겠습니까?', () => this.finishStudy());
    },

    finishStudy() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }

        let correct = 0, wrong = 0;
        Object.entries(this.selectedAnswers).forEach(([qId, ans]) => {
            const q = this.currentQuestions.find(x => x.id == qId);
            if (q && ans === q.answerIndex) correct++;
            else wrong++;
        });

        const total = Object.keys(this.selectedAnswers).length;
        const score = total > 0 ? Math.round((correct / total) * 100) : 0;

        this.setText('result-score', `${score}%`);
        this.setText('result-correct', correct);
        this.setText('result-wrong', wrong);
        
        const mins = Math.floor(this.timer / 60);
        const secs = this.timer % 60;
        this.setText('result-time', `${mins}:${String(secs).padStart(2, '0')}`);

        // 히스토리 저장
        const history = Storage.load(STORAGE_KEYS.HISTORY, []);
        history.push({
            date: Date.now(),
            mode: this.studyMode,
            total,
            correct,
            time: this.timer
        });
        Storage.save(STORAGE_KEYS.HISTORY, history.slice(-100));

        this.showScreen('result');
        this.updateDashboard();
    },

    reviewWrong() {
        const wrongQ = this.currentQuestions.filter(q => {
            const ans = this.selectedAnswers[q.id];
            return ans !== undefined && ans !== q.answerIndex;
        });
        if (wrongQ.length === 0) {
            this.toast('오답이 없습니다! 🎉');
            return;
        }

        this.currentQuestions = wrongQ;
        this.currentIndex = 0;
        this.selectedAnswers = {};
        this.studyMode = 'wrong';
        this.startTimer();
        this.setText('q-total', this.currentQuestions.length);
        this.showScreen('study');
        this.renderQuestion();
    },

    // ===== AI 생성 =====
    async generateAI() {
        const category = document.getElementById('ai-category').value;
        const mode = document.getElementById('ai-mode').value;
        const count = parseInt(document.getElementById('ai-count').value);

        document.getElementById('ai-form').style.display = 'none';
        document.getElementById('ai-loading').classList.add('active');

        const catLabel = category === 'MATH' ? '수리·논리' : '독해·요약';
        this.setText('loading-text', `${catLabel} 문제 ${count}개 생성 중...`);

        try {
            let newQuestions;
            
            if (mode === 'similar') {
                const wrongQuestions = this.getWrongQuestions();
                if (wrongQuestions.length === 0) {
                    this.toast('먼저 문제를 풀어주세요');
                    document.getElementById('ai-form').style.display = 'block';
                    document.getElementById('ai-loading').classList.remove('active');
                    return;
                }
                newQuestions = await API.generateSimilarQuestions(wrongQuestions, category, count);
            } else {
                const level = parseInt(document.getElementById('ai-level').value);
                newQuestions = await API.generateQuestions(category, level, count);
            }

            newQuestions.forEach(q => this.questions.push(q));
            Storage.save(STORAGE_KEYS.QUESTIONS, this.questions);

            this.toast(`${newQuestions.length}개 문제 생성 완료!`);

            this.currentQuestions = newQuestions;
            this.currentIndex = 0;
            this.selectedAnswers = {};
            this.studyMode = 'ai';
            this.startTimer();
            this.setText('q-total', this.currentQuestions.length);
            this.showScreen('study');
            this.renderQuestion();
            this.updateDashboard();

        } catch (e) {
            console.error(e);
            this.toast('생성 실패: ' + e.message);
            document.getElementById('ai-form').style.display = 'block';
        }
        document.getElementById('ai-loading').classList.remove('active');
    },

    // ===== 복습 관리 =====
    switchReviewTab(tab) {
        document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
        this.renderReviewList(tab);
    },

    renderReviewList(tab) {
        let qs;
        if (tab === 'starred') qs = this.questions.filter(q => this.starred.has(q.id));
        else if (tab === 'wrong') qs = this.getWrongQuestions();
        else qs = this.questions;

        const container = document.getElementById('review-list');
        if (!container) return;

        if (qs.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="icon">📭</div>
                    <h3>문제가 없습니다</h3>
                    <p>학습을 진행하면 여기에 표시됩니다</p>
                </div>`;
            return;
        }

        container.innerHTML = qs.map(q => {
            const s = this.stats[q.id] || { attempts: 0, correct: 0 };
            const acc = s.attempts > 0 ? Math.round((s.correct / s.attempts) * 100) : 0;
            const isStarred = this.starred.has(q.id);
            const category = q.category || CONFIG.AREA_TO_CATEGORY[q.area] || 'MATH';
            const catLabel = category === 'MATH' ? '수리·논리' : '독해·요약';

            return `
                <div class="review-item ${isStarred ? 'starred' : ''}" onclick="App.studySingle('${q.id}')">
                    <div class="review-header">
                        <div class="review-badges">
                            <span class="meta-badge ${category.toLowerCase()}">${catLabel}</span>
                            <span class="meta-badge level">Lv.${q.level}</span>
                            ${q.isAI ? '<span class="meta-badge ai">AI</span>' : ''}
                        </div>
                    </div>
                    <div class="review-stem">${q.stem.replace(/\n/g, ' ').substring(0, 80)}...</div>
                    <div class="review-stats">
                        <span>시도: ${s.attempts}회</span>
                        <span>정답률: ${acc}%</span>
                    </div>
                </div>`;
        }).join('');
    },

    studySingle(id) {
        const q = this.questions.find(x => x.id == id);
        if (!q) return;
        this.currentQuestions = [q];
        this.currentIndex = 0;
        this.selectedAnswers = {};
        this.studyMode = 'single';
        this.startTimer();
        this.setText('q-total', 1);
        this.showScreen('study');
        this.renderQuestion();
    },

    // ===== 설정 =====
    saveSettings() {
        const countEl = document.getElementById('setting-count');
        const timeEl = document.getElementById('setting-time');
        
        if (countEl) this.settings.questionCount = parseInt(countEl.value);
        if (timeEl) this.settings.timeLimit = parseInt(timeEl.value);
        
        Storage.save(STORAGE_KEYS.SETTINGS, this.settings);
        this.toast('설정 저장됨');
    },

    saveApiSettings() {
        const keyEl = document.getElementById('setting-api-key');
        const modelEl = document.getElementById('setting-model');
        
        const apiKey = keyEl?.value?.trim();
        const model = modelEl?.value;
        
        if (apiKey) {
            CONFIG.CLAUDE_API_KEY = apiKey;
            Storage.save('psat_api_key', apiKey);
        }
        if (model) {
            CONFIG.CLAUDE_MODEL = model;
            Storage.save('psat_api_model', model);
        }
        
        this.toast('API 설정 저장됨');
    },

    async testApiKey() {
        const keyEl = document.getElementById('setting-api-key');
        const modelEl = document.getElementById('setting-model');
        const apiKey = keyEl?.value?.trim() || CONFIG.CLAUDE_API_KEY;
        const model = modelEl?.value || CONFIG.CLAUDE_MODEL;
        
        if (!apiKey || apiKey === 'YOUR_API_KEY_HERE') {
            this.toast('API 키를 입력해주세요');
            return;
        }
        
        this.toast('API 연결 테스트 중...');
        
        try {
            const response = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': apiKey,
                    'anthropic-version': '2023-06-01',
                    'anthropic-dangerous-direct-browser-access': 'true'
                },
                body: JSON.stringify({
                    model: model,
                    max_tokens: 10,
                    messages: [{ role: 'user', content: '1+1=?' }]
                })
            });
            
            if (response.ok) {
                this.toast('✅ API 연결 성공!');
            } else {
                const err = await response.json().catch(() => ({}));
                if (response.status === 401) {
                    this.toast('❌ API 키가 유효하지 않습니다');
                } else if (response.status === 404) {
                    this.toast('❌ 모델을 찾을 수 없습니다');
                } else {
                    this.toast(`❌ 오류: ${err?.error?.message || response.status}`);
                }
            }
        } catch (e) {
            this.toast('❌ 네트워크 오류: ' + e.message);
        }
    },

    loadSettings() {
        const countEl = document.getElementById('setting-count');
        const timeEl = document.getElementById('setting-time');
        const apiKeyEl = document.getElementById('setting-api-key');
        const modelEl = document.getElementById('setting-model');
        
        if (countEl) countEl.value = this.settings.questionCount;
        if (timeEl) timeEl.value = this.settings.timeLimit;
        
        // API 설정 로드
        const savedKey = Storage.load('psat_api_key');
        const savedModel = Storage.load('psat_api_model');
        if (savedKey) CONFIG.CLAUDE_API_KEY = savedKey;
        if (savedModel) CONFIG.CLAUDE_MODEL = savedModel;
        
        if (apiKeyEl) apiKeyEl.value = CONFIG.CLAUDE_API_KEY || '';
        if (modelEl) modelEl.value = CONFIG.CLAUDE_MODEL || 'claude-sonnet-4-20250514';
    },

    resetData() {
        this.confirm('데이터 초기화', '모든 데이터가 삭제됩니다. 계속하시겠습니까?', () => {
            Storage.clear();
            location.reload();
        });
    },

    exportData() {
        const data = Storage.exportAll();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `psat_backup_${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
        this.toast('데이터 내보내기 완료');
    },

    // ===== 이의제기 =====
    reportQuestion() {
        const q = this.currentQuestions[this.currentIndex];
        if (!q) return;
        
        const reason = prompt('이의제기 내용을 입력하세요:\n(예: 정답이 틀림, 해설 오류, 문제 오타 등)');
        if (!reason || reason.trim() === '') return;
        
        const reports = Storage.load(STORAGE_KEYS.REPORTS, []);
        reports.push({
            questionId: q.id,
            questionCode: q.code,
            stem: q.stem.substring(0, 100),
            reason: reason.trim(),
            reportedAt: Date.now()
        });
        Storage.save(STORAGE_KEYS.REPORTS, reports);
        this.toast('이의제기 저장됨');
        this.updateReportCount();
    },

    updateReportCount() {
        const reports = Storage.load(STORAGE_KEYS.REPORTS, []);
        const el = document.getElementById('report-count');
        if (el) el.textContent = `${reports.length}건`;
    },

    showReports() {
        const reports = Storage.load(STORAGE_KEYS.REPORTS, []);
        if (reports.length === 0) {
            this.toast('이의제기 내역이 없습니다');
            return;
        }
        
        let text = '=== 이의제기 목록 ===\n\n';
        reports.forEach((r, i) => {
            text += `[${i + 1}] ${r.questionCode || r.questionId}\n`;
            text += `내용: ${r.reason}\n`;
            text += `날짜: ${new Date(r.reportedAt).toLocaleDateString()}\n\n`;
        });
        
        alert(text);
    },

    async submitReportsToAI() {
        const reports = Storage.load(STORAGE_KEYS.REPORTS, []);
        if (reports.length === 0) {
            this.toast('이의제기 내역이 없습니다');
            return;
        }

        this.confirm('AI에게 전송', `${reports.length}건의 이의제기를 AI에게 분석 요청할까요?`, async () => {
            const reportedQuestions = reports.map(r => {
                const q = this.questions.find(q => q.id == r.questionId);
                return { ...r, question: q };
            }).filter(r => r.question);

            const prompt = `다음은 PSAT 문제에 대한 사용자 이의제기입니다. 각 이의제기를 검토하고 수정이 필요한지 판단해주세요.

${reportedQuestions.map((r, i) => `
[이의제기 ${i + 1}]
문제코드: ${r.questionCode}
문제: ${r.question.stem.substring(0, 300)}...
선택지: ${r.question.options.join(' / ')}
현재 정답: ${r.question.answerIndex + 1}번
해설: ${r.question.solution?.substring(0, 200) || '없음'}...
이의내용: ${r.reason}
`).join('\n')}

각 이의제기에 대해:
1. 이의가 타당한지 판단
2. 수정이 필요하면 수정 내용 제안
3. 수정 불필요하면 이유 설명`;

            try {
                const response = await fetch('https://api.anthropic.com/v1/messages', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-api-key': CONFIG.CLAUDE_API_KEY,
                        'anthropic-version': '2023-06-01',
                        'anthropic-dangerous-direct-browser-access': 'true'
                    },
                    body: JSON.stringify({
                        model: CONFIG.CLAUDE_MODEL,
                        max_tokens: 4096,
                        messages: [{ role: 'user', content: prompt }]
                    })
                });

                const data = await response.json();
                const result = data.content[0].text;
                
                const newWindow = window.open('', '_blank');
                newWindow.document.write(`
                    <html><head><title>AI 분석 결과</title>
                    <style>body{font-family:'Noto Sans KR',sans-serif;padding:24px;line-height:1.8;max-width:800px;margin:0 auto;background:#F6F3EE;color:#1C1917;}pre{white-space:pre-wrap;background:#fff;padding:24px;border-radius:16px;border:1px solid #E7E5E4;}</style>
                    </head><body>
                    <h1>🤖 AI 이의제기 분석 결과</h1>
                    <pre>${result}</pre>
                    <button onclick="window.close()" style="margin-top:20px;padding:12px 24px;font-size:15px;border-radius:12px;border:none;background:#1C1917;color:#fff;cursor:pointer;">닫기</button>
                    </body></html>
                `);
                
                this.toast('AI 분석 완료');
            } catch (e) {
                this.toast('AI 요청 실패: ' + e.message);
            }
        });
    },

    clearReports() {
        this.confirm('이의제기 삭제', '모든 이의제기를 삭제할까요?', () => {
            Storage.save(STORAGE_KEYS.REPORTS, []);
            this.updateReportCount();
            this.toast('삭제됨');
        });
    },

    // ===== 아카이브 =====
    renderArchive() {
        const categoryFilter = document.getElementById('archive-category')?.value || 'all';
        const levelFilter = document.getElementById('archive-level')?.value || 'all';
        const statusFilter = document.getElementById('archive-status')?.value || 'all';

        let filtered = this.questions.filter(q => {
            if (categoryFilter !== 'all') {
                const qCat = q.category || CONFIG.AREA_TO_CATEGORY[q.area] || 'MATH';
                if (qCat !== categoryFilter) return false;
            }
            if (levelFilter !== 'all') {
                if (q.level != levelFilter) return false;
            }
            if (statusFilter !== 'all') {
                const stat = this.stats[q.id];
                if (statusFilter === 'unsolved' && stat) return false;
                if (statusFilter === 'wrong' && (!stat || !stat.lastWrong)) return false;
                if (statusFilter === 'correct' && (!stat || stat.lastWrong)) return false;
            }
            return true;
        });

        filtered.sort((a, b) => (a.code || '').localeCompare(b.code || ''));

        this.setText('archive-filtered', filtered.length);

        const container = document.getElementById('archive-list');
        if (!container) return;

        if (filtered.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="icon">📭</div>
                    <h3>문제가 없습니다</h3>
                </div>`;
            return;
        }

        container.innerHTML = filtered.map((q, idx) => {
            const stat = this.stats[q.id];
            const category = q.category || CONFIG.AREA_TO_CATEGORY[q.area] || 'MATH';
            const catLabel = category === 'MATH' ? '수리·논리' : '독해·요약';
            
            let statusClass = '';
            let statusText = '미풀이';
            if (stat) {
                if (stat.lastWrong) {
                    statusClass = 'wrong';
                    statusText = '오답';
                } else {
                    statusClass = 'solved';
                    statusText = '정답';
                }
            }

            const acc = stat && stat.attempts > 0 
                ? Math.round((stat.correct / stat.attempts) * 100) 
                : null;

            return `
                <div class="archive-item ${statusClass}" onclick="App.studySingle('${q.id}')">
                    <div class="archive-num">${idx + 1}</div>
                    <div class="archive-content">
                        <div class="archive-badges">
                            <span class="meta-badge ${category.toLowerCase()}">${catLabel}</span>
                            <span class="meta-badge level">Lv.${q.level}</span>
                            ${q.isAI ? '<span class="meta-badge ai">AI</span>' : ''}
                        </div>
                        <div class="archive-stem">${q.stem.replace(/\\n/g, ' ').substring(0, 80)}...</div>
                        <div class="archive-info">
                            <span>${q.code || '-'}</span>
                            <span>${statusText}</span>
                            ${acc !== null ? `<span>정답률 ${acc}%</span>` : ''}
                        </div>
                    </div>
                </div>`;
        }).join('');
    },

    // ===== 유틸리티 =====
    setText(id, text) {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    },

    toast(msg) {
        const el = document.getElementById('toast');
        if (el) {
            el.textContent = msg;
            el.classList.add('show');
            setTimeout(() => el.classList.remove('show'), 2500);
        }
    },

    confirm(title, msg, onConfirm) {
        const modal = document.getElementById('modal');
        document.getElementById('modal-title').textContent = title;
        document.getElementById('modal-message').textContent = msg;
        document.getElementById('modal-confirm').onclick = () => {
            this.closeModal();
            onConfirm();
        };
        modal.classList.add('active');
    },

    closeModal() {
        document.getElementById('modal').classList.remove('active');
    }
};

// 모달 외부 클릭 닫기
document.getElementById('modal')?.addEventListener('click', e => {
    if (e.target.id === 'modal') App.closeModal();
});

// 앱 초기화
document.addEventListener('DOMContentLoaded', () => App.init());
