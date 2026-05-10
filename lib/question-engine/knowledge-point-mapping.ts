/**
 * Knowledge Point Mapping
 *
 * Maps knowledge point IDs to Chinese names and template IDs.
 * Used for consistent identification across the system.
 */

export const KNOWLEDGE_POINT_MAP: Record<string, {
  name: string;
  templateId: string;
  chapter?: string;
  description?: string;
}> = {
  // 一次方程（第7章）
  'linear-equation': {
    name: '一元一次方程',
    templateId: 'linear_equation',
    chapter: '7',
    description: '解一元一次方程，掌握移项和合并同类项',
  },

  // 二次函数
  'quadratic': {
    name: '二次函数',
    templateId: 'quadratic_vertex',
    description: '二次函数的顶点、图像和应用',
  },
  'quadratic-vertex': {
    name: '二次函数顶点',
    templateId: 'quadratic_vertex',
    description: '求二次函数顶点坐标',
  },
  'quadratic-evaluate': {
    name: '二次函数求值',
    templateId: 'quadratic_evaluate',
    description: '给定x值求二次函数值',
  },

  // 勾股定理（第17章）
  'pythagorean': {
    name: '勾股定理',
    templateId: 'pythagoras',
    chapter: '17',
    description: '勾股定理的直接应用',
  },
  'pythagoras-fold': {
    name: '勾股定理折叠',
    templateId: 'pythagoras_folding',
    chapter: '17',
    description: '勾股定理折叠问题',
  },
  'triangle-verify': {
    name: '三角形判定',
    templateId: 'triangle_verify',
    chapter: '17',
    description: '勾股定理逆定理判定三角形',
  },

  // 一元二次方程（第19章）
  'quadratic-identify': {
    name: '一元二次方程识别',
    templateId: 'quadratic_identify',
    chapter: '19',
    description: '判断是否为一元二次方程',
  },
  'quadratic-direct-root': {
    name: '直接开平方法',
    templateId: 'quadratic_direct_root',
    chapter: '19',
    description: '用直接开平方法解方程',
  },
  'quadratic-complete-square': {
    name: '配方法',
    templateId: 'quadratic_complete_square',
    chapter: '19',
    description: '用配方法解一元二次方程',
  },
  'quadratic-formula': {
    name: '求根公式法',
    templateId: 'quadratic_formula',
    chapter: '19',
    description: '用求根公式解一元二次方程',
  },
  'quadratic-factorize': {
    name: '因式分解法',
    templateId: 'quadratic_factorize',
    chapter: '19',
    description: '用因式分解法解一元二次方程',
  },
  'quadratic-growth': {
    name: '增长率问题',
    templateId: 'quadratic_growth',
    chapter: '19',
    description: '一元二次方程增长率应用题',
  },
  'quadratic-area': {
    name: '面积问题',
    templateId: 'quadratic_area',
    chapter: '19',
    description: '一元二次方程面积应用题',
  },

  // 数据分析（第20章）
  'central-tendency': {
    name: '集中趋势',
    templateId: 'central_tendency',
    chapter: '20',
    description: '平均数、中位数、众数',
  },
  'data-stddev': {
    name: '标准差',
    templateId: 'data_stddev',
    chapter: '20',
    description: '计算标准差',
  },
  'data-variance': {
    name: '方差',
    templateId: 'data_variance',
    chapter: '20',
    description: '计算方差',
  },

  // 二次根式（第16章）
  'sqrt-concept': {
    name: '二次根式概念',
    templateId: 'sqrt_concept',
    chapter: '16',
    description: '二次根式的定义域',
  },
  'sqrt-simplify': {
    name: '最简二次根式',
    templateId: 'sqrt_simplify',
    chapter: '16',
    description: '化简二次根式',
  },
  'sqrt-property': {
    name: '二次根式性质',
    templateId: 'sqrt_property',
    chapter: '16',
    description: '二次根式的性质应用',
  },
  'sqrt-multiply': {
    name: '二次根式乘法',
    templateId: 'sqrt_multiply',
    chapter: '16',
    description: '二次根式的乘法运算',
  },
  'sqrt-divide': {
    name: '二次根式除法',
    templateId: 'sqrt_divide',
    chapter: '16',
    description: '二次根式的除法运算',
  },
  'sqrt-add-subtract': {
    name: '二次根式加减',
    templateId: 'sqrt_add_subtract',
    chapter: '16',
    description: '二次根式的加减混合运算',
  },

  // 四边形（第18章）
  'rhombus-property': {
    name: '菱形性质',
    templateId: 'rhombus_property',
    chapter: '18',
    description: '菱形的性质计算',
  },
  'rhombus-verify': {
    name: '菱形判定',
    templateId: 'rhombus_verify',
    chapter: '18',
    description: '判定四边形是否为菱形',
  },
  'parallelogram-verify': {
    name: '平行四边形判定',
    templateId: 'parallelogram_verify',
    chapter: '18',
    description: '判定四边形是否为平行四边形',
  },
  'rectangle-property': {
    name: '矩形性质',
    templateId: 'rectangle_property',
    chapter: '18',
    description: '矩形的性质计算',
  },
  'rectangle-verify': {
    name: '矩形判定',
    templateId: 'rectangle_verify',
    chapter: '18',
    description: '判定四边形是否为矩形',
  },
  'square-property': {
    name: '正方形性质',
    templateId: 'square_property',
    chapter: '18',
    description: '正方形的性质计算',
  },
  'square-verify': {
    name: '正方形判定',
    templateId: 'square_verify',
    chapter: '18',
    description: '判定四边形是否为正方形',
  },
  'quadrilateral-perimeter': {
    name: '四边形周长',
    templateId: 'quadrilateral_perimeter',
    chapter: '18',
    description: '计算四边形周长',
  },
  'quadrilateral-area': {
    name: '四边形面积',
    templateId: 'quadrilateral_area',
    chapter: '18',
    description: '计算四边形面积',
  },
  'trapezoid-property': {
    name: '梯形性质',
    templateId: 'trapezoid_property',
    chapter: '18',
    description: '梯形的中位线性质',
  },
};

/**
 * Get Chinese name for a knowledge point
 */
export function getKnowledgePointName(knowledgePointId: string): string {
  const mapping = KNOWLEDGE_POINT_MAP[knowledgePointId];
  return mapping?.name || knowledgePointId;
}

/**
 * Get template ID for a knowledge point
 */
export function getTemplateIdForKnowledgePoint(knowledgePointId: string): string | null {
  const mapping = KNOWLEDGE_POINT_MAP[knowledgePointId];
  return mapping?.templateId || null;
}

/**
 * Get all knowledge point IDs
 */
export function getAllKnowledgePointIds(): string[] {
  return Object.keys(KNOWLEDGE_POINT_MAP);
}

/**
 * Get knowledge points by chapter
 */
export function getKnowledgePointsByChapter(chapter: string): string[] {
  return Object.entries(KNOWLEDGE_POINT_MAP)
    .filter(([_, mapping]) => mapping.chapter === chapter)
    .map(([id, _]) => id);
}