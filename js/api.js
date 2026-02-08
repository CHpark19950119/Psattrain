// ===== API MODULE =====
const API = {
    // 틀린 문제 패턴 분석
    analyzeWrongPatterns(wrongQuestions, stats) {
        const patterns = {
            MATH: { count: 0, levels: {1:0, 2:0, 3:0}, refs: [] },
            LANG: { count: 0, levels: {1:0, 2:0, 3:0}, refs: [] }
        };
        
        wrongQuestions.forEach(q => {
            const cat = q.category || CONFIG.AREA_TO_CATEGORY[q.area] || 'MATH';
            patterns[cat].count++;
            patterns[cat].levels[q.level] = (patterns[cat].levels[q.level] || 0) + 1;
            if (q.refs && q.refs.length > 0) {
                patterns[cat].refs.push(...q.refs);
            }
        });
        
        return patterns;
    },

    // 틀린 문제와 유사한 문제 생성
    async generateSimilarQuestions(wrongQuestions, category, count) {
        // 틀린 문제 샘플링 (최대 5개)
        const samples = wrongQuestions
            .filter(q => (q.category || CONFIG.AREA_TO_CATEGORY[q.area]) === category)
            .slice(0, 5);
        
        if (samples.length === 0) {
            return this.generateQuestions(category, 2, count);
        }

        // 틀린 문제들의 특성 분석
        const avgLevel = Math.round(samples.reduce((sum, q) => sum + q.level, 0) / samples.length);
        const refs = [...new Set(samples.flatMap(q => q.refs || []))];
        
        const categoryInfo = CONFIG.AREAS[category];
        const sampleTexts = samples.map((q, i) => 
            `예시${i+1}:\n문제: ${q.stem.substring(0, 200)}...\n유형: ${q.refs?.join(', ') || '일반'}`
        ).join('\n\n');

        const prompt = `당신은 PSAT(공직적격성평가) ${categoryInfo.name} 전문 출제위원입니다.

사용자가 아래 문제들을 틀렸습니다. 이와 **유사한 유형과 난이도**의 문제를 ${count}개 생성해주세요.

[사용자가 틀린 문제들]
${sampleTexts}

[분석된 취약 패턴]
- 영역: ${categoryInfo.name} (${categoryInfo.description})
- 평균 난이도: Lv.${avgLevel}
- 관련 키워드: ${refs.length > 0 ? refs.join(', ') : '일반'}

[출제 지침]
1. 틀린 문제와 **동일한 개념/유형**을 다루되, 숫자와 상황만 변형
2. 같은 함정 요소를 포함하되 약간 다른 방식으로 제시
3. 난이도는 Lv.${avgLevel} 수준 유지
4. 5지선다형, 명확한 정답 필요

[출력 형식]
반드시 아래 JSON 배열 형식으로만 출력하세요.

[
  {
    "area": "${samples[0]?.area || 'A'}",
    "category": "${category}",
    "level": ${avgLevel},
    "stem": "문제 지문",
    "options": ["①", "②", "③", "④", "⑤"],
    "answerIndex": 0,
    "solution": "상세한 해설",
    "refs": ["관련키워드"]
  }
]`;

        return this._callAPI(prompt, category, count);
    },

    // 일반 문제 생성
    async generateQuestions(category, level, count) {
        const categoryInfo = CONFIG.AREAS[category];
        const levelInfo = CONFIG.LEVELS[level];

        const prompt = `당신은 PSAT(공직적격성평가) ${categoryInfo.name} 전문 출제위원입니다.

다음 조건에 맞는 고품질 문제를 정확히 ${count}개 생성해주세요.

[출제 조건]
- 영역: ${categoryInfo.name} (${categoryInfo.description})
- 난이도: Lv.${level} ${levelInfo.name}
- 실제 PSAT 기출문제 스타일 정확히 반영
- 5지선다형, 명확한 정답

[${categoryInfo.name} 출제 가이드]
${this.getCategoryGuide(category)}

[출력 형식]
반드시 아래 JSON 배열 형식으로만 출력하세요.

[
  {
    "area": "${category === 'MATH' ? 'A' : 'B'}",
    "category": "${category}",
    "level": ${level},
    "stem": "문제 지문 (줄바꿈은 \\n으로)",
    "options": ["①번 선택지", "②번 선택지", "③번 선택지", "④번 선택지", "⑤번 선택지"],
    "answerIndex": 0,
    "solution": "상세한 해설",
    "refs": ["관련키워드"]
  }
]

주의: answerIndex는 0부터 시작 (0=①, 1=②, 2=③, 3=④, 4=⑤)`;

        return this._callAPI(prompt, category, count);
    },

    async _callAPI(prompt, category, count) {
        try {
            // API 키 확인
            if (!CONFIG.CLAUDE_API_KEY || CONFIG.CLAUDE_API_KEY === '' || CONFIG.CLAUDE_API_KEY === 'YOUR_API_KEY_HERE') {
                throw new Error('API 키가 설정되지 않았습니다. 설정에서 API 키를 입력해주세요.');
            }

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

            if (!response.ok) {
                const errorBody = await response.json().catch(() => ({}));
                const errorType = errorBody?.error?.type || '';
                
                if (response.status === 401) {
                    throw new Error('API 키가 유효하지 않습니다. 설정에서 키를 확인해주세요.');
                } else if (response.status === 403) {
                    throw new Error('API 접근이 거부되었습니다. 키 권한을 확인해주세요.');
                } else if (response.status === 404) {
                    throw new Error(`모델 "${CONFIG.CLAUDE_MODEL}"을 찾을 수 없습니다.`);
                } else if (response.status === 429) {
                    throw new Error('API 요청 한도 초과. 잠시 후 다시 시도해주세요.');
                } else if (response.status === 529) {
                    throw new Error('API 서버 과부하. 잠시 후 다시 시도해주세요.');
                } else {
                    throw new Error(`API 오류 (${response.status}): ${errorType || '알 수 없는 오류'}`);
                }
            }

            const data = await response.json();
            
            if (!data.content || !data.content[0] || !data.content[0].text) {
                throw new Error('API 응답이 비어있습니다.');
            }
            
            const content = data.content[0].text;

            const jsonMatch = content.match(/\[[\s\S]*\]/);
            if (!jsonMatch) {
                throw new Error('유효한 JSON 형식을 찾을 수 없습니다');
            }

            const questions = JSON.parse(jsonMatch[0]);

            return questions.map((q, idx) => ({
                ...q,
                id: `AI_${Date.now()}_${idx}_${Math.random().toString(36).substr(2, 6)}`,
                code: `${q.area || 'A'}${q.level}-AI${String(idx + 1).padStart(2, '0')}`,
                category: category,
                isAI: true,
                createdAt: Date.now()
            }));

        } catch (error) {
            console.error('Question generation error:', error);
            throw error;
        }
    },

    getCategoryGuide(category) {
        const guides = {
            MATH: `[수리영역 - 자료해석/수리추론]
- 표, 그래프, 도표를 활용한 수치 분석
- 비율, 증가율, 평균, 가중치 계산
- 방정식, 부등식을 활용한 추론
- 경우의 수, 확률 계산
- 조건을 종합하여 판단하는 복합 문제
- 계산 실수를 유도하는 함정 배치`,

            LANG: `[언어영역 - 언어논리/비판적사고]
- 지문의 논지 파악, 추론, 비판적 분석
- 논증 구조 분석 (전제-결론, 논리적 오류)
- 글의 구조와 흐름 파악
- 명제 논리, 조건문 추론
- 반박, 강화, 약화 논증 분석
- 유사 개념 혼동 유도 선택지 배치`
        };
        return guides[category] || guides.MATH;
    }
};
