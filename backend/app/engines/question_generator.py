"""
题目生成引擎 - 根据知识点和难度动态生成题目
"""
import random
from typing import Dict, Any
from sympy import symbols, solve, sympify


class QuestionGenerator:
    """题目生成器"""

    def __init__(self):
        self.generators = {
            1: self._generate_equation,  # 一元一次方程
            2: self._generate_rational_number,  # 有理数运算
            3: self._generate_triangle_angle,  # 三角形角度
        }

    def generate(self, knowledge_id: int, level: int) -> Dict[str, Any]:
        """
        生成题目

        Args:
            knowledge_id: 知识点ID (1=方程, 2=有理数, 3=三角形)
            level: 难度等级 (0-4)

        Returns:
            {
                "content": "题目内容",
                "answer": "正确答案",
                "input_type": "expression/number",
                "steps": ["解题步骤"]
            }
        """
        generator = self.generators.get(knowledge_id, self._generate_equation)
        return generator(level)

    def _generate_equation(self, level: int) -> Dict[str, Any]:
        """生成一元一次方程"""
        # 根据level调整参数
        level += 1  # level从0开始，但生成时从1开始

        if level == 1:
            # 简单: ax = b (a∈[2,5], x∈[1,10])
            a = random.randint(2, 5)
            x = random.randint(1, 10)
            b = a * x
            content = f"{a}x = {b}"
            answer = str(x)
        elif level == 2:
            # 中等: ax + b = c (a∈[2,3], b∈[-5,5])
            a = random.randint(2, 3)
            x = random.randint(1, 15)
            b = random.randint(-5, 5)
            c = a * x + b
            content = f"{a}x + {b} = {c}"
            answer = str(x)
        elif level == 3:
            # 困难: ax - b = c 或包含括号
            if random.choice([True, False]):
                a = random.randint(2, 4)
                x = random.randint(2, 12)
                b = random.randint(3, 10)
                c = a * x - b
                content = f"{a}x - {b} = {c}"
            else:
                a = random.randint(2, 3)
                x = random.randint(1, 8)
                b = random.randint(1, 5)
                c = random.randint(1, 5)
                d = a * x + b + c
                content = f"{a}(x + {b}) + {c} = {d}"
            answer = str(x)
        else:  # level 4-5
            # 高难度: 系数是小数或大数
            if random.choice([True, False]):
                a = random.choice([0.5, 1.5, 2.5])
                x = random.randint(2, 20)
                b = random.randint(-10, 10)
                c = a * x + b
                content = f"{a}x + {b} = {c}"
                # 验证答案是整数
                answer = str(int(x))
            else:
                # 复杂括号
                a = random.randint(2, 3)
                x = random.randint(1, 6)
                b = random.randint(1, 3)
                c = random.randint(1, 3)
                d = random.randint(1, 5)
                result = a * (x + b) - c * x
                content = f"{a}(x + {b}) - {c}x = {result}"
                answer = str(x)

        return {
            "content": f"解方程: {content}, x = ?",
            "answer": answer,
            "input_type": "number",
            "steps": [f"解方程 {content}", f"x = {answer}"]
        }

    def _generate_rational_number(self, level: int) -> Dict[str, Any]:
        """生成有理数运算题"""
        level += 1

        if level == 1:
            # 简单加减法
            a = random.randint(-20, 20)
            b = random.randint(-20, 20)
            content = f"{a} + ({b}) = ?"
            answer = str(a + b)
        elif level == 2:
            # 简单乘法
            a = random.choice([2, 3, 4, 5, -2, -3, -4, -5])
            b = random.randint(-10, 10)
            content = f"{a} × {b} = ?"
            answer = str(a * b)
        elif level == 3:
            # 除法（整除）
            b = random.choice([2, 3, 4, 5, -2, -3, -4, -5])
            result = random.randint(-10, 10)
            a = b * result
            content = f"{a} ÷ {b} = ?"
            answer = str(result)
        else:
            # 混合运算
            a = random.randint(-10, 10)
            b = random.randint(-5, 5)
            c = random.randint(2, 5)
            content = f"{a} + {b} × {c} = ?"
            answer = str(a + b * c)

        return {
            "content": content,
            "answer": answer,
            "input_type": "number",
            "steps": [f"计算: {content}", f"= {answer}"]
        }

    def _generate_triangle_angle(self, level: int) -> Dict[str, Any]:
        """生成三角形角度题"""
        level += 1

        if level == 1:
            # 已知两角求第三角
            angle1 = random.randint(30, 80)
            angle2 = random.randint(30, 100)
            angle3 = 180 - angle1 - angle2
            content = f"三角形中，∠A = {angle1}°, ∠B = {angle2}°, 求∠C = ?"
            answer = str(angle3)
        elif level == 2:
            # 等腰三角形
            base_angle = random.randint(40, 70)
            vertex_angle = 180 - 2 * base_angle
            if random.choice([True, False]):
                content = f"等腰三角形中，顶角 = {vertex_angle}°, 求底角 = ?"
                answer = str(base_angle)
            else:
                content = f"等腰三角形中，底角 = {base_angle}°, 求顶角 = ?"
                answer = str(vertex_angle)
        elif level == 3:
            # 直角三角形
            angle1 = random.randint(20, 60)
            angle2 = 90 - angle1
            content = f"直角三角形中，一个锐角 = {angle1}°, 求另一个锐角 = ?"
            answer = str(angle2)
        else:
            # 角平分线
            angle = random.randint(40, 100)
            half_angle = angle // 2
            content = f"角平分线将一个{angle}°的角分成两个相等的角，每个角 = ?"
            answer = str(half_angle)

        return {
            "content": content,
            "answer": f"{answer}°" if "°" not in answer else answer,
            "input_type": "number",
            "steps": ["三角形内角和为180°", f"答案: {answer}"]
        }


# 全局实例
question_generator = QuestionGenerator()
