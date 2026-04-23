"""
题目生成引擎 - 参数化模板驱动（V2.0）

核心思想：模板 + 参数 → 无限题目
不再依赖硬编码或题库，而是通过参数化模板动态生成
"""
import random
import re
from typing import Dict, Any, Optional
from dataclasses import dataclass
from sympy import symbols, solve, sympify


@dataclass
class Question:
    """生成的题目"""
    content: str
    answer: str
    input_type: str = "number"
    steps: list = None

    def __post_init__(self):
        if self.steps is None:
            self.steps = []


@dataclass
class Template:
    """参数化模板"""
    id: int
    knowledge_id: int
    name: str
    structure: str  # 如 "[a]x + [b] = [c]"
    parameters: Dict[str, Any]  # 参数定义
    level_rules: Dict[str, Any]  # Level规则
    validation_rules: Optional[Dict[str, Any]] = None


class QuestionGenerator:
    """
    参数化题目生成器（V2.0）

    核心逻辑：
    1. 从数据库加载模板
    2. 根据Level规则生成参数
    3. 渲染模板生成题目
    4. 求解并验证答案
    """

    def __init__(self, template_loader=None):
        self.template_loader = template_loader
        # 内置模板（fallback）
        self._builtin_templates = self._init_builtin_templates()

    def generate(self, knowledge_id: int, level: int) -> Question:
        """
        根据知识点和Level生成题目

        Args:
            knowledge_id: 知识点ID
            level: 难度等级 (0-4)

        Returns:
            Question对象
        """
        # 获取模板
        template = self._get_template(knowledge_id, level)

        # 生成基础参数
        params = self._generate_params(template, level)

        # 求解并生成derived参数
        answer = self._solve_and_derive(template, params)

        # 渲染题目（此时params已包含所有参数）
        content = self._render_template(template.structure, params)

        # 验证
        if template.validation_rules:
            self._validate(template, params, answer)

        return Question(
            content=content,
            answer=str(answer),
            input_type="number",
            steps=[f"题目: {content}", f"答案: {answer}"]
        )

    def _get_template(self, knowledge_id: int, level: int) -> Template:
        """获取模板（优先从数据库，否则使用内置模板）"""
        if self.template_loader:
            template = self.template_loader.load(knowledge_id, level)
            if template:
                return template

        # 使用内置模板
        return self._builtin_templates.get(knowledge_id, self._builtin_templates[1])

    def _generate_params(self, template: Template, level: int) -> Dict[str, Any]:
        """根据Level规则生成参数"""
        level_key = str(level)
        level_rule = template.level_rules.get(level_key, {})

        params = {}
        for param_name, param_def in template.parameters.items():
            if param_def.get("type") == "derived":
                # 派生参数，稍后计算
                continue

            # 根据Level规则调整参数范围
            value_range = param_def.get("range", [1, 10])

            # 应用Level规则
            if param_name in level_rule:
                rule_value = level_rule[param_name]
                if isinstance(rule_value, int):
                    params[param_name] = rule_value
                elif isinstance(rule_value, list):
                    params[param_name] = random.randint(rule_value[0], rule_value[1])
                continue

            # 默认：从范围中随机选择
            params[param_name] = random.randint(value_range[0], value_range[1])

        return params

    def _render_template(self, structure: str, params: Dict[str, Any]) -> str:
        """渲染模板，将参数替换到结构中"""
        result = structure

        # 替换 [param] 格式的参数
        for param_name, param_value in params.items():
            placeholder = f"[{param_name}]"
            result = result.replace(placeholder, str(param_value))

        return result

    def _solve_and_derive(self, template: Template, params: Dict[str, Any]) -> Any:
        """
        求解题目答案并生成derived参数

        对于方程 ax + b = c：
        1. 随机生成x的答案
        2. 根据a和b计算c = a*x + b
        3. 返回答案x
        """
        # 对于一元一次方程: ax + b = c 或类似形式
        if "x" in template.structure:
            # 检查是否有derived参数
            has_derived = any(
                p.get("type") == "derived"
                for p in template.parameters.values()
            )

            if has_derived:
                # 随机生成答案x（范围-10到10，避免0）
                x = random.randint(-10, 10)
                while x == 0:
                    x = random.randint(-10, 10)

                # 根据已生成的参数计算derived参数
                a = params.get("a", 1)
                b = params.get("b", 0)

                # 计算 c = a*x + b
                c = a * x + b
                params["c"] = c

                return x

            # 无derived参数，使用原有求解逻辑
            a = params.get("a", 1)
            b = params.get("b", 0)
            c = params.get("c", 0)
            return (c - b) / a if a != 0 else 0

        # 对于其他类型题目
        return params.get("answer", 0)

    def _solve(self, template: Template, params: Dict[str, Any]) -> Any:
        """求解题目答案"""
        # 对于一元一次方程: ax + b = c
        if "x" in template.structure:
            # 提取方程
            equation = template.structure
            for param_name, param_value in params.items():
                equation = equation.replace(f"[{param_name}]", str(param_value))

            # 使用sympy求解
            x = symbols('x')
            # 移项处理
            equation = equation.replace("=", "-(") + ")"
            try:
                solution = solve(sympify(equation), x)
                return solution[0] if solution else 0
            except:
                # 简单求解
                if "x" in params:
                    return params.get("x", 0)
                # 从方程 ax + b = c 求解 x = (c-b)/a
                a = params.get("a", 1)
                b = params.get("b", 0)
                c = params.get("c", 0)
                return (c - b) / a if a != 0 else 0

        return params.get("answer", 0)

    def _validate(self, template: Template, params: Dict[str, Any], answer: Any) -> bool:
        """验证题目合法性"""
        rules = template.validation_rules or {}

        if rules.get("avoid_no_solution"):
            if answer is None:
                raise ValueError("生成的题目无解")

        if rules.get("avoid_infinite_solution"):
            if answer == float("inf"):
                raise ValueError("生成的题目有无限解")

        if rules.get("integer_answer"):
            if isinstance(answer, float) and not answer.is_integer():
                # 重新生成
                return False

        return True

    def _init_builtin_templates(self) -> Dict[int, Template]:
        """初始化内置模板（fallback）"""
        return {
            1: Template(
                id=1,
                knowledge_id=1,
                name="一元一次方程基础模板",
                structure="[a]x + [b] = [c]",
                parameters={
                    "a": {"type": "int", "range": [1, 5]},
                    "b": {"type": "int", "range": [-10, 10]},
                    "c": {"type": "derived", "formula": "a*x+b"}
                },
                level_rules={
                    "0": {"a": 1, "allow_negative": False},
                    "1": {"a": [1, 3], "allow_negative": True},
                    "2": {"both_sides": True},
                    "3": {"fractions": True},
                    "4": {"parentheses": True}
                },
                validation_rules={
                    "avoid_no_solution": True,
                    "avoid_infinite_solution": True,
                    "integer_answer": True
                }
            ),
            2: Template(
                id=2,
                knowledge_id=2,
                name="有理数运算模板",
                structure="[a] + [b] = ?",
                parameters={
                    "a": {"type": "int", "range": [-20, 20]},
                    "b": {"type": "int", "range": [-20, 20]}
                },
                level_rules={
                    "0": {},
                    "1": {},
                    "2": {},
                    "3": {},
                    "4": {}
                }
            ),
            3: Template(
                id=3,
                knowledge_id=3,
                name="三角形角度模板",
                structure="三角形中，∠A = [angle1]°, ∠B = [angle2]°, 求∠C = ?",
                parameters={
                    "angle1": {"type": "int", "range": [30, 80]},
                    "angle2": {"type": "int", "range": [30, 80]}
                },
                level_rules={
                    "0": {},
                    "1": {},
                    "2": {},
                    "3": {},
                    "4": {}
                },
                validation_rules={
                    "triangle_angle_sum": True  # angle1 + angle2 < 180
                }
            )
        }


class TemplateLoader:
    """模板加载器（从数据库加载）"""

    def __init__(self, db_session):
        self.db_session = db_session

    def load(self, knowledge_id: int, level: int) -> Optional[Template]:
        """从数据库加载模板"""
        from app.models import KnowledgeTemplate

        template = self.db_session.query(KnowledgeTemplate).filter(
            KnowledgeTemplate.knowledge_id == knowledge_id,
            KnowledgeTemplate.is_active == True
        ).first()

        if not template:
            return None

        return Template(
            id=template.id,
            knowledge_id=template.knowledge_id,
            name=template.name,
            structure=template.structure,
            parameters=template.parameters,
            level_rules=template.level_rules,
            validation_rules=template.validation_rules
        )


# 全局实例
question_generator = QuestionGenerator()
