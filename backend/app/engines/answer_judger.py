"""
判题引擎 - 校验答案正确性
"""
from typing import Tuple
import re


class AnswerJudger:
    """判题器"""

    def judge(self, user_answer: str, correct_answer: str, input_type: str) -> Tuple[bool, str]:
        """
        判断答案是否正确

        Args:
            user_answer: 用户答案
            correct_answer: 正确答案
            input_type: 输入类型 (number/expression/steps)

        Returns:
            (是否正确, 反馈信息)
        """
        # 清理答案
        user_clean = self._clean_answer(user_answer)
        correct_clean = self._clean_answer(correct_answer)

        if input_type == "number":
            is_correct, feedback = self._judge_number(user_clean, correct_clean)
        elif input_type == "expression":
            is_correct, feedback = self._judge_expression(user_clean, correct_clean)
        else:
            is_correct, feedback = self._judge_text(user_clean, correct_clean)

        if is_correct:
            feedback = "✓ 正确！"
        else:
            feedback = f"✗ 错误。正确答案是: {correct_answer}"

        return is_correct, feedback

    def _clean_answer(self, answer: str) -> str:
        """清理答案字符串"""
        if not answer:
            return ""
        # 去除空格、括号、度数符号
        cleaned = answer.strip().lower()
        cleaned = cleaned.replace(" ", "").replace("（", "(").replace("）", ")")
        cleaned = cleaned.replace("°", "").replace("度", "")
        return cleaned

    def _judge_number(self, user_answer: str, correct_answer: str) -> Tuple[bool, str]:
        """判断数值答案"""
        try:
            user_val = float(user_answer)
            correct_val = float(correct_answer)
            # 允许小误差
            if abs(user_val - correct_val) < 0.01:
                return True, ""
            return False, f"数值不匹配，正确答案是 {correct_answer}"
        except ValueError:
            return False, "答案格式不正确，请输入数字"

    def _judge_expression(self, user_answer: str, correct_answer: str) -> Tuple[bool, str]:
        """判断表达式答案"""
        # 移除x=, x = 等前缀
        user_answer = re.sub(r'^[xX]\s*=\s*', '', user_answer)
        correct_answer = re.sub(r'^[xX]\s*=\s*', '', correct_answer)

        try:
            user_val = float(user_answer)
            correct_val = float(correct_answer)
            if abs(user_val - correct_val) < 0.01:
                return True, ""
            return False, f"解不正确，x = {correct_answer}"
        except ValueError:
            return user_answer == correct_answer, ""

    def _judge_text(self, user_answer: str, correct_answer: str) -> Tuple[bool, str]:
        """判断文本答案"""
        return user_answer == correct_answer, ""


# 全局实例
answer_judger = AnswerJudger()
