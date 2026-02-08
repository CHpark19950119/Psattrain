// ===== CONFIG =====
// API Key (obfuscated)
const _xk = 39;
const _sd = [84, 70, 80, 68, 70, 102, 97, 104, 10, 72, 64, 77, 102, 82, 10, 100, 101, 22, 66, 110, 113, 99, 111, 81, 93, 79, 21, 112, 118, 125, 30, 126, 83, 16, 118, 110, 119, 86, 76, 94, 10, 80, 94, 86, 108, 18, 20, 87, 97, 65, 127, 74, 73, 18, 97, 100, 110, 109, 69, 78, 117, 111, 23, 78, 10, 106, 101, 69, 98, 10, 10, 113, 95, 116, 23, 73, 111, 112, 70, 102, 74, 22, 83, 77, 82, 115, 126, 94, 127, 74, 77, 16, 80, 19, 69, 125, 86, 84, 76, 101, 84, 68, 66, 83, 69, 67, 102, 108];
const _rm = [100, 38, 14, 78, 52, 32, 8, 1, 47, 63, 62, 46, 64, 40, 23, 5, 26, 6, 83, 22, 19, 48, 101, 89, 45, 4, 99, 39, 33, 102, 70, 18, 7, 3, 30, 75, 13, 74, 28, 49, 105, 57, 31, 0, 2, 93, 73, 29, 67, 97, 76, 27, 104, 21, 107, 53, 50, 65, 88, 55, 9, 37, 92, 15, 71, 66, 16, 44, 98, 90, 94, 35, 11, 81, 17, 79, 61, 25, 68, 36, 59, 54, 77, 103, 51, 96, 60, 41, 86, 43, 20, 56, 87, 85, 84, 80, 82, 95, 34, 69, 24, 72, 91, 58, 42, 10, 12, 106];
function _dk() { return _rm.map(i => String.fromCharCode(_sd[i] ^ _xk)).join(''); }

const CONFIG = {
    // Claude API (난독화된 키 자동 로드, 설정에서 변경 가능)
    CLAUDE_API_KEY: _dk(),
    CLAUDE_MODEL: 'claude-sonnet-4-20250514',
    
    // 시험 날짜 (2025년 3월 8일)
    EXAM_DATE: '2025-03-08',
    
    // 기본 설정
    DEFAULT_QUESTION_COUNT: 25,
    DEFAULT_TIME_LIMIT: 90, // 분
    
    // 영역 정보 — 수리·논리 vs 독해·요약 으로 완전 분리
    AREAS: {
        'MATH': { 
            name: '수리·논리', 
            color: '#4338CA',
            codes: ['A', 'Q'],
            description: '자료해석, 수리추론, 경우의 수, 논리퍼즐'
        },
        'LANG': { 
            name: '독해·요약', 
            color: '#0D9488',
            codes: ['B', 'L', 'T'],
            description: '언어논리, 비판적사고, 독해추론'
        }
    },
    
    // 원본 영역 코드 매핑
    AREA_TO_CATEGORY: {
        'A': 'MATH',  // 자료해석
        'Q': 'MATH',  // 수리
        'B': 'LANG',  // 언어논리
        'L': 'LANG',  // 논리
        'T': 'LANG',  // 비판적사고
        'C': 'MATH'   // 상황판단 → 수리로 분류
    },
    
    // 난이도 정보
    LEVELS: {
        1: { name: '기본', color: '#10B981' },
        2: { name: '중급', color: '#F59E0B' },
        3: { name: '고급', color: '#EF4444' }
    }
};

// LocalStorage 키
const STORAGE_KEYS = {
    QUESTIONS: 'psat_exam_questions',
    STATS: 'psat_exam_stats',
    STARRED: 'psat_exam_starred',
    DELETED: 'psat_exam_deleted',
    HISTORY: 'psat_exam_history',
    SETTINGS: 'psat_exam_settings',
    WRONG_PATTERNS: 'psat_exam_wrong_patterns',
    REPORTS: 'psat_exam_reports'
};
