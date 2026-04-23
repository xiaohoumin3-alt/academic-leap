"""
初始化参数化模板数据

3个知识点 × 不同Level规则 = 完整模板配置
"""
from sqlalchemy.orm import Session
from app.database import engine, SessionLocal, Base
from app.models import KnowledgeTemplate, KnowledgePoint
import json


# 模板定义
TEMPLATES = [
    # ==================== 知识点1: 一元一次方程 ====================
    {
        "knowledge_id": 1,
        "name": "一元一次方程-基础版",
        "structure": "[a]x + [b] = [c]",
        "parameters": {
            "a": {"type": "int", "range": [1, 5]},
            "b": {"type": "int", "range": [-10, 10]},
            "c": {"type": "derived", "formula": "a*x+b"}
        },
        "level_rules": {
            "0": {"a": 1, "b_range": [0, 10]},  # x + b = c, b>=0
            "1": {"a": [1, 3], "b_range": [-10, 10]},  # 系数1-3
            "2": {"a_range": [2, 5], "both_sides": True},  # 系数2-5，可能需要移项
            "3": {"allow_fraction": True, "a_range": [2, 6]},
            "4": {"parentheses": True, "a_range": [2, 7]}
        },
        "validation_rules": {
            "avoid_no_solution": True,
            "avoid_infinite_solution": True,
            "integer_answer": True
        }
    },
    {
        "knowledge_id": 1,
        "name": "一元一次方程-移项版",
        "structure": "[a]x + [b] = [c]x + [d]",
        "parameters": {
            "a": {"type": "int", "range": [1, 5]},
            "b": {"type": "int", "range": [-10, 10]},
            "c": {"type": "int", "range": [1, 5]},
            "d": {"type": "int", "range": [-10, 10]}
        },
        "level_rules": {
            "0": {"a": 1, "c": 1},
            "1": {"a": [1, 2], "c": [1, 2]},
            "2": {"a_range": [1, 4], "c_range": [1, 4]},
            "3": {"allow_large": True},
            "4": {"allow_fraction_result": True}
        },
        "validation_rules": {
            "avoid_no_solution": True,
            "integer_answer": True
        }
    },

    # ==================== 知识点2: 有理数运算 ====================
    {
        "knowledge_id": 2,
        "name": "有理数加减法",
        "structure": "[a] [+/-] [b] = ?",
        "parameters": {
            "a": {"type": "int", "range": [-20, 20]},
            "b": {"type": "int", "range": [-20, 20]},
            "op": {"type": "choice", "values": ["+", "-"]}
        },
        "level_rules": {
            "0": {"a_range": [0, 10], "b_range": [0, 10], "op": "+"},
            "1": {"a_range": [-10, 10], "b_range": [0, 10]},
            "2": {"a_range": [-20, 20], "b_range": [-20, 20]},
            "3": {"allow_three_terms": True},
            "4": {"mixed_operations": True}
        },
        "validation_rules": {}
    },
    {
        "knowledge_id": 2,
        "name": "有理数乘除法",
        "structure": "[a] [×/÷] [b] = ?",
        "parameters": {
            "a": {"type": "int", "range": [-12, 12]},
            "b": {"type": "int", "range": [-12, 12]},
            "op": {"type": "choice", "values": ["×", "÷"]}
        },
        "level_rules": {
            "0": {"a_range": [1, 10], "b_range": [1, 10], "op": "×"},
            "1": {"a_range": [-10, 10], "b_range": [1, 10], "op": "×"},
            "2": {"a_range": [-12, 12], "b_range": [-12, 12], "op": "×"},
            "3": {"op": "÷", "ensure_divisible": True},
            "4": {"mixed_with_addition": True}
        },
        "validation_rules": {
            "avoid_divide_by_zero": True
        }
    },

    # ==================== 知识点3: 整式运算 ====================
    {
        "knowledge_id": 3,
        "name": "整式加减",
        "structure": "([a]x [+/-] [b]) [+/-] ([c]x [+/-] [d]) = ?",
        "parameters": {
            "a": {"type": "int", "range": [1, 5]},
            "b": {"type": "int", "range": [-10, 10]},
            "c": {"type": "int", "range": [1, 5]},
            "d": {"type": "int", "range": [-10, 10]}
        },
        "level_rules": {
            "0": {"a": 1, "c": 1, "no_brackets": True},
            "1": {"a_range": [1, 3], "c_range": [1, 3]},
            "2": {"a_range": [1, 5], "c_range": [1, 5]},
            "3": {"allow_negative_coefficients": True},
            "4": {"three_polynomials": True}
        },
        "validation_rules": {}
    },

    # ==================== 知识点4: 几何基础 ====================
    {
        "knowledge_id": 4,
        "name": "三角形角度计算",
        "structure": "三角形中，∠A = [angle1]°, ∠B = [angle2]°, 求∠C = ?",
        "parameters": {
            "angle1": {"type": "int", "range": [30, 80]},
            "angle2": {"type": "int", "range": [30, 80]}
        },
        "level_rules": {
            "0": {"angle1_range": [40, 70], "angle2_range": [40, 70]},
            "1": {"angle1_range": [30, 80], "angle2_range": [30, 80]},
            "2": {"allow_obtuse": True},
            "3": {"given_exterior_angle": True},
            "4": {"is_isosceles": True}
        },
        "validation_rules": {
            "triangle_angle_sum": True  # angle1 + angle2 < 180
        }
    },

    # ==================== 知识点5: 一元一次不等式 ====================
    {
        "knowledge_id": 5,
        "name": "一元一次不等式",
        "structure": "[a]x [+/-] [b] [<>/<=/>=] [c]",
        "parameters": {
            "a": {"type": "int", "range": [1, 5]},
            "b": {"type": "int", "range": [-10, 10]},
            "c": {"type": "int", "range": [-20, 20]},
            "op": {"type": "choice", "values": ["<", ">", "<=", ">="]},
            "sign": {"type": "choice", "values": ["+", "-"]}
        },
        "level_rules": {
            "0": {"a": 1, "sign": "+", "op": "<"},
            "1": {"a_range": [1, 3], "sign": "+"},
            "2": {"a_range": [1, 5], "sign": ["+", "-"]},
            "3": {"allow_negative_a": True},
            "4": {"compound_inequality": True}
        },
        "validation_rules": {
            "ensure_solution_exists": True
        }
    },
]


def init_templates():
    """初始化模板数据"""
    # 创建数据库表（如果不存在）
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()

    try:
        # 清空现有模板
        db.query(KnowledgeTemplate).delete()
        db.commit()

        # 检查知识点是否存在
        knowledge_ids = {kp.id for kp in db.query(KnowledgePoint).all()}

        # 创建模板
        created_count = 0
        for template_data in TEMPLATES:
            # 跳过不存在知识点的模板
            if template_data["knowledge_id"] not in knowledge_ids:
                print(f"⚠️  知识点 {template_data['knowledge_id']} 不存在，跳过模板: {template_data['name']}")
                continue

            template = KnowledgeTemplate(
                knowledge_id=template_data["knowledge_id"],
                name=template_data["name"],
                structure=template_data["structure"],
                parameters=template_data["parameters"],
                level_rules=template_data["level_rules"],
                validation_rules=template_data.get("validation_rules"),
                is_active=True
            )
            db.add(template)
            created_count += 1

        db.commit()

        print(f"✅ 成功初始化 {created_count} 个参数化模板")

        # 显示创建的模板
        templates = db.query(KnowledgeTemplate).all()
        print("\n📋 模板列表:")
        for t in templates:
            kp = db.query(KnowledgePoint).filter(KnowledgePoint.id == t.knowledge_id).first()
            kp_name = kp.name if kp else "未知"
            print(f"  - [{t.knowledge_id}] {kp_name}: {t.name}")

    except Exception as e:
        print(f"❌ 初始化失败: {e}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    print("🚀 开始初始化参数化模板...")
    init_templates()
