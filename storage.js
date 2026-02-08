// ===== STORAGE MODULE =====
const Storage = {
    save(key, data) {
        try {
            localStorage.setItem(key, JSON.stringify(data));
            return true;
        } catch (e) {
            console.error('Storage save error:', e);
            return false;
        }
    },

    load(key, defaultValue = null) {
        try {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : defaultValue;
        } catch (e) {
            console.error('Storage load error:', e);
            return defaultValue;
        }
    },

    remove(key) {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (e) {
            return false;
        }
    },

    clear() {
        try {
            Object.values(STORAGE_KEYS).forEach(key => {
                localStorage.removeItem(key);
            });
            return true;
        } catch (e) {
            return false;
        }
    },

    exportAll() {
        const data = {};
        Object.entries(STORAGE_KEYS).forEach(([name, key]) => {
            data[name] = this.load(key);
        });
        return data;
    },

    importAll(data) {
        try {
            Object.entries(STORAGE_KEYS).forEach(([name, key]) => {
                if (data[name]) {
                    this.save(key, data[name]);
                }
            });
            return true;
        } catch (e) {
            return false;
        }
    }
};

// 문제 데이터 초기화 함수
function initializeQuestions() {
    // QUESTIONS_DATA가 있으면 사용
    if (typeof QUESTIONS_DATA !== 'undefined' && QUESTIONS_DATA.length > 0) {
        console.log('Loading questions:', QUESTIONS_DATA.length);
        const questions = QUESTIONS_DATA.map((q, idx) => ({
            ...q,
            id: String(q.id || `Q${idx + 1}`),
            category: CONFIG.AREA_TO_CATEGORY[q.area] || 'MATH',
            isAI: false
        }));
        return questions;
    }
    console.log('No QUESTIONS_DATA found');
    return [];
}
