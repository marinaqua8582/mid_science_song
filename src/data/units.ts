import { UnitInfo, ScienceUnit, StudentRosterItem, RubricCriterion } from '../types';

export const SCIENCE_UNITS: Record<ScienceUnit, UnitInfo> = {
  소화: {
    id: '소화',
    name: '소화 (Digestion)',
    description: '음식물 속 크고 복잡한 영양소를 세포가 흡수할 수 있는 작은 크기로 분해하는 과정',
    icon: 'Utensils',
    starterExample: '소화는 음식물 속 영양소를 세포가 흡수할 수 있도록 작은 크기로 분해하는 과정입니다.',
    recommendedTerms: [
      '영양소', '탄수화물', '단백질', '지방', '입', '침', '아밀레이스', 
      '위', '펩신', '위산', '소장', '쓸개즙', '이자액', '트립신', 
      '라이페이스', '포도당', '아미노산', '지방산', '모노글리세리드', '융털'
    ]
  },
  순환: {
    id: '순환',
    name: '순환 (Circulation)',
    description: '심장의 펌프 작용으로 혈액이 온몸을 돌며 산소와 영양소를 공급하고 노폐물을 회수하는 과정',
    icon: 'HeartPulse',
    starterExample: '순환은 심장의 펌프 작용에 의해 혈액이 온몸을 흐르며 산소와 영양소를 세포로 전달하는 과정입니다.',
    recommendedTerms: [
      '심장', '좌심실', '좌심방', '우심실', '우심방', '혈관', '동맥', 
      '정맥', '모세혈관', '혈액', '적혈구', '백혈구', '혈소판', '혈장', 
      '헤모글로빈', '체순환', '폐순환', '산소', '이산화탄소', '판막'
    ]
  },
  호흡: {
    id: '호흡',
    name: '호흡 (Respiration)',
    description: '폐를 통한 기체 교환과 세포에서 영양소를 분해하여 생명 활동에 필요한 에너지를 얻는 작용',
    icon: 'Wind',
    starterExample: '호흡은 코와 기관, 폐를 통해 산소를 받아들이고 이산화탄소를 배출하는 기체 교환 작용입니다.',
    recommendedTerms: [
      '코', '기관', '기관지', '폐', '폐포', '갈비뼈', '가로막', 
      '들숨', '날숨', '기체교환', '확산', '산소', '이산화탄소', 
      '세포호흡', '에너지', '미토콘드리아', '혈액', '모세혈관', '압력변화'
    ]
  },
  배설: {
    id: '배설',
    name: '배설 (Excretion)',
    description: '세포 호흡 결과 생성된 암모니아, 요소 등 해로운 노폐물을 콩팥에서 걸러 오줌으로 만드는 과정',
    icon: 'Droplets',
    starterExample: '배설은 세포 호흡으로 생긴 암모니아 등 노폐물을 콩팥에서 걸러 오줌 형태로 몸 밖으로 내보내는 과정입니다.',
    recommendedTerms: [
      '노폐물', '암모니아', '요소', '이산화탄소', '콩팥', '방광', '오줌관', 
      '요도', '네프론', '사구체', '보먼주머니', '세뇨관', ' 여과', '재흡수', 
      '분비', '오줌', '혈액', '포도당', '단백질', '체온조절'
    ]
  }
};

export const DEFAULT_ROSTER: StudentRosterItem[] = [];

export const DEFAULT_RUBRICS: RubricCriterion[] = [
  {
    id: 'rubric-1',
    title: '과학적 지식 및 학습 정리 (5문장/10키워드)',
    description: '단원 핵심 용어 및 과학 개념을 정확히 이해하고 자기 언어로 풍부하게 정리하였는가?',
    maxPoints: 10
  },
  {
    id: 'rubric-2',
    title: 'AI 가사 비판적 검토 및 오류 수정',
    description: 'Gemini AI가 생성한 가사 속 과학 오류나 잘못된 유도를 비판적으로 찾아내어 올바르게 수정했는가?',
    maxPoints: 10
  },
  {
    id: 'rubric-3',
    title: '음악 프롬프트 구성 및 독창성',
    description: '음악 스타일, 가사 구조, 창의적 상황 설정을 논리적이고 풍부하게 빌딩했는가?',
    maxPoints: 10
  }
];
