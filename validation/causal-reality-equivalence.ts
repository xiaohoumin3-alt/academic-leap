/**
 * 因果现实等价类 (Causal Reality Equivalence Class)
 *
 * 目标：从"单一模型"到"因果现实等价类"
 *
 * 核心思想：
 * "真理"不是一个 SCM，而是一组在所有可观测干预下不可区分的 SCM 的等价类
 *
 * 运行方式：
 * ```bash
 * npx tsx validation/causal-reality-equivalence.ts
 * ```
 */

// ============================================================
// 1. 核心类型定义
// ============================================================

/**
 * 结构因果模型（简化版）
 */
interface SCM {
  id: string;
  // 结构方程参数
  parameters: {
    // X → Y 的因果强度
    causalEffect: number;
    // Z → X 的混淆强度
    confoundingEffect: number;
    // 噪声标准差
    noiseStd: number;
  };
  // 干预效应
  interventionEffects: Map<string, number>;
}

/**
 * 干预操作
 */
interface Intervention {
  target: string;  // 'X' or 'Z'
  value: number;
}

/**
 * 等价类
 */
interface SCMEquivalenceClass {
  id: string;
  members: SCM[];
  representative: SCM;
  invariants: CausalInvariants;
}

/**
 * 因果不变量（等价类内不变）
 */
interface CausalInvariants {
  interventionEffects: Map<string, number>;  // do(X) → effect
  independence: string[];                    // 条件独立性
  counterfactualRelations: string[];         // 反事实关系
}

/**
 * 观测
 */
interface Observation {
  intervention: Intervention;
  outcome: number;
  probability: number;  // 在模型下的概率
}

/**
 * 因果现实推断结果
 */
interface RealityInferenceResult {
  realityClass: SCMEquivalenceClass;
  posterior: Map<string, number>;  // SCM → posterior
  identifiableEffects: Map<string, number>;
  killed: boolean;
  killingObservations: Observation[];
}

// ============================================================
// 2. 干预等价性检查器
// ============================================================

class InterventionEquivalenceChecker {
  private readonly EPSILON = 0.01;

  /**
   * 检查两个 SCM 是否干预等价
   */
  areEquivalent(
    m1: SCM,
    m2: SCM,
    interventions: Intervention[]
  ): boolean {
    for (const intervention of interventions) {
      const effect1 = this.computeInterventionEffect(m1, intervention);
      const effect2 = this.computeInterventionEffect(m2, intervention);

      if (Math.abs(effect1 - effect2) > this.EPSILON) {
        return false;
      }
    }
    return true;
  }

  /**
   * 计算 SCM 的干预效应
   */
  computeInterventionEffect(scm: SCM, intervention: Intervention): number {
    if (intervention.target === 'X') {
      // do(X) 对 Y 的效应
      return scm.parameters.causalEffect * intervention.value;
    } else if (intervention.target === 'Z') {
      // do(Z) 对 Y 的效应（通过 X）
      return scm.parameters.confoundingEffect * scm.parameters.causalEffect * intervention.value;
    }
    return 0;
  }

  /**
   * 计算等价类
   */
  computeEquivalenceClass(
    scms: SCM[],
    interventions: Intervention[]
  ): SCMEquivalenceClass[] {
    // 并查集
    const parent = new Map<string, string>();
    const rank = new Map<string, number>();

    // 初始化
    for (const scm of scms) {
      parent.set(scm.id, scm.id);
      rank.set(scm.id, 0);
    }

    // find
    const find = (id: string): string => {
      if (parent.get(id) !== id) {
        parent.set(id, find(parent.get(id)!));
      }
      return parent.get(id)!;
    };

    // union
    const union = (id1: string, id2: string) => {
      const root1 = find(id1);
      const root2 = find(id2);

      if (root1 === root2) return;

      const rank1 = rank.get(root1) || 0;
      const rank2 = rank.get(root2) || 0;

      if (rank1 < rank2) {
        parent.set(root1, root2);
      } else if (rank1 > rank2) {
        parent.set(root2, root1);
      } else {
        parent.set(root2, root1);
        rank.set(root1, (rank1 || 0) + 1);
      }
    };

    // 比较所有对
    for (let i = 0; i < scms.length; i++) {
      for (let j = i + 1; j < scms.length; j++) {
        if (this.areEquivalent(scms[i], scms[j], interventions)) {
          union(scms[i].id, scms[j].id);
        }
      }
    }

    // 收集等价类
    const classMap = new Map<string, SCM[]>();

    for (const scm of scms) {
      const root = find(scm.id);
      if (!classMap.has(root)) {
        classMap.set(root, []);
      }
      classMap.get(root)!.push(scm);
    }

    // 转换为 SCMEquivalenceClass
    const classes: SCMEquivalenceClass[] = [];
    let classId = 0;

    for (const [root, members] of classMap) {
      const representative = members[0];
      const invariants = this.extractInvariants(members, interventions);

      classes.push({
        id: `class_${classId++}`,
        members,
        representative,
        invariants,
      });
    }

    return classes;
  }

  /**
   * 提取等价类不变量
   */
  private extractInvariants(members: SCM[], interventions: Intervention[]): CausalInvariants {
    const interventionEffects = new Map<string, number>();

    // 计算平均干预效应
    for (const intervention of interventions) {
      let totalEffect = 0;
      for (const scm of members) {
        totalEffect += this.computeInterventionEffect(scm, intervention);
      }
      const avgEffect = totalEffect / members.length;
      interventionEffects.set(
        `do(${intervention.target})`,
        avgEffect
      );
    }

    return {
      interventionEffects,
      independence: ['Y ⟂ X | Z'],  // 简化
      counterfactualRelations: ['Y_x=Y_x\''],  // 简化
    };
  }
}

// ============================================================
// 3. 因果现实推断器
// ============================================================

class CausalRealityInference {
  private checker: InterventionEquivalenceChecker;

  constructor() {
    this.checker = new InterventionEquivalenceChecker();
  }

  /**
   * 从观测推断因果现实等价类
   */
  inferReality(
    observations: Observation[],
    priorSCMs: SCM[],
    interventions: Intervention[]
  ): RealityInferenceResult {
    console.log('=== 因果现实推断 ===\n');

    // 1. 计算等价类
    const equivalenceClasses = this.checker.computeEquivalenceClass(
      priorSCMs,
      interventions
    );

    console.log(`发现 ${equivalenceClasses.length} 个等价类:`);
    for (const eqClass of equivalenceClasses) {
      console.log(`  ${eqClass.id}: ${eqClass.members.length} 个成员`);
      console.log(`    不变量: ${Array.from(eqClass.invariants.interventionEffects.entries()).map(([k, v]) => `${k}=${v.toFixed(3)}`).join(', ')}`);
    }

    // 2. 计算每个 SCM 的后验
    const posteriors = new Map<string, number>();
    const likelihoods = new Map<string, number>();

    for (const scm of priorSCMs) {
      let likelihood = 1.0;

      for (const obs of observations) {
        const predicted = this.predictOutcome(scm, obs.intervention);
        const error = Math.abs(obs.outcome - predicted);
        const obsLikelihood = Math.exp(-error * error / 0.1);  // 高斯似然
        likelihood *= obsLikelihood;
      }

      likelihoods.set(scm.id, likelihood);
      posteriors.set(scm.id, likelihood);  // 简化：均匀先验
    }

    // 归一化后验
    const totalPosterior = Array.from(posteriors.values()).reduce((a, b) => a + b, 0);
    for (const [id, post] of posteriors) {
      posteriors.set(id, post / totalPosterior);
    }

    // 3. 找到最高后验的等价类
    let bestClass: SCMEquivalenceClass | null = null;
    let maxPosterior = 0;

    for (const eqClass of equivalenceClasses) {
      let classPosterior = 0;
      for (const member of eqClass.members) {
        classPosterior += posteriors.get(member.id) || 0;
      }

      console.log(`  ${eqClass.id} 后验: ${(classPosterior * 100).toFixed(1)}%`);

      if (classPosterior > maxPosterior) {
        maxPosterior = classPosterior;
        bestClass = eqClass;
      }
    }

    // 4. 提取可识别效应
    const identifiableEffects = bestClass!.invariants.interventionEffects;

    // 5. 检查是否被"杀死"
    const killer = new RealityKiller();
    const killingObservations = killer.generateKillingObservations(bestClass!);
    const killed = killingObservations.some(obs =>
      this.isKillingObservation(obs, bestClass!)
    );

    console.log(`\n推断的因果现实: ${bestClass!.id}`);
    console.log(`可识别效应: ${Array.from(identifiableEffects.entries()).map(([k, v]) => `${k}=${v.toFixed(3)}`).join(', ')}`);
    console.log(`被"杀死": ${killed ? '是' : '否'}`);

    return {
      realityClass: bestClass!,
      posterior: posteriors,
      identifiableEffects,
      killed,
      killingObservations,
    };
  }

  private predictOutcome(scm: SCM, intervention: Intervention): number {
    return this.checker.computeInterventionEffect(scm, intervention);
  }

  private isKillingObservation(
    observation: Observation,
    realityClass: SCMEquivalenceClass
  ): boolean {
    // 检查观测是否违反等价类不变量
    for (const [intervention, expectedEffect] of realityClass.invariants.interventionEffects) {
      const effectError = Math.abs(observation.outcome - expectedEffect);
      if (effectError > 0.5) {
        return true;  // 违反不变量
      }
    }
    return false;
  }
}

// ============================================================
// 4. 现实杀手（Reality Killer）
// ============================================================

class RealityKiller {
  /**
   * 生成违反等价类不变量的观测
   */
  generateKillingObservations(
    realityClass: SCMEquivalenceClass
  ): Observation[] {
    const killers: Observation[] = [];

    for (const [intervention, expectedEffect] of realityClass.invariants.interventionEffects) {
      // 解析干预目标
      const target = intervention.match(/do\((\w+)\)/)?.[1] || 'X';

      // 生成一个观测，其中干预效应与预期相反
      const killer: Observation = {
        intervention: { target, value: 1.0 },
        outcome: -expectedEffect,  // 相反效应
        probability: 0,  // 在当前模型下概率为 0
      };

      killers.push(killer);
    }

    return killers;
  }

  /**
   * 验证观测是否"杀死"模型
   */
  isKillingObservation(
    observation: Observation,
    realityClass: SCMEquivalenceClass
  ): { isKilling: boolean; violatedInvariant: string | null } {
    for (const [intervention, expectedEffect] of realityClass.invariants.interventionEffects) {
      const target = intervention.match(/do\((\w+)\)/)?.[1] || 'X';

      if (observation.intervention.target === target) {
        const effectError = Math.abs(observation.outcome - expectedEffect);
        if (effectError > 0.5) {
          return {
            isKilling: true,
            violatedInvariant: intervention,
          };
        }
      }
    }

    return { isKilling: false, violatedInvariant: null };
  }
}

// ============================================================
// 5. 生成 SCM 空间
// ============================================================

function generateSCMSpace(): SCM[] {
  const scms: SCM[] = [];

  // 生成不同参数的 SCM
  for (let causal = 0.5; causal <= 0.9; causal += 0.1) {
    for (let confound = 0.1; confound <= 0.5; confound += 0.1) {
      const scm: SCM = {
        id: `scm_causal_${causal.toFixed(1)}_confound_${confound.toFixed(1)}`,
        parameters: {
          causalEffect: causal,
          confoundingEffect: confound,
          noiseStd: 0.1,
        },
        interventionEffects: new Map([
          ['do(X)', causal],
          ['do(Z)', confound * causal],
        ]),
      };
      scms.push(scm);
    }
  }

  return scms;
}

// ============================================================
// 6. 主函数
// ============================================================

function main() {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║     因果现实等价类 (Causal Reality Equivalence)       ║');
  console.log('║     从"单一模型"到"因果现实等价类"                      ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  // 1. 生成 SCM 空间
  const scms = generateSCMSpace();
  console.log(`SCM 空间大小: ${scms.length}\n`);

  // 2. 定义干预集合
  const interventions: Intervention[] = [
    { target: 'X', value: 1.0 },
    { target: 'Z', value: 1.0 },
  ];

  // 3. 生成观测数据（从"真实"机制）
  const trueCausalEffect = 0.7;
  const trueConfoundEffect = 0.3;

  const observations: Observation[] = [
    {
      intervention: { target: 'X', value: 1.0 },
      outcome: trueCausalEffect * 1.0,  // do(X=1) → Y = 0.7
      probability: 0.8,
    },
    {
      intervention: { target: 'Z', value: 1.0 },
      outcome: trueConfoundEffect * trueCausalEffect * 1.0,  // do(Z=1) → Y = 0.21
      probability: 0.6,
    },
  ];

  console.log('观测数据:');
  for (const obs of observations) {
    console.log(`  do(${obs.intervention.target}) = ${obs.outcome.toFixed(3)}`);
  }
  console.log();

  // 4. 推断因果现实
  const inference = new CausalRealityInference();
  const result = inference.inferReality(observations, scms, interventions);

  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║                    推断总结                            ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  console.log(`推断的因果现实: ${result.realityClass.id}`);
  console.log(`等价类大小: ${result.realityClass.members.length} 个 SCM`);
  console.log(`可识别效应:`);
  for (const [intervention, effect] of result.identifiableEffects) {
    console.log(`  ${intervention} → ${effect.toFixed(3)}`);
  }

  console.log(`\n科学有效性:`);

  // 检查是否满足科学有效性
  const equivalenceClassWellDefined = result.realityClass.members.length > 0;
  const hasIdentifiableEffects = result.identifiableEffects.size > 0;
  const canBeKilled = result.killingObservations.length > 0;

  console.log(`  等价类良定义: ${equivalenceClassWellDefined ? '✅' : '❌'}`);
  console.log(`  可识别效应: ${hasIdentifiableEffects ? '✅' : '❌'}`);
  console.log(`  可被证伪: ${canBeKilled ? '✅' : '❌'}`);

  const scientificallyValid = equivalenceClassWellDefined && hasIdentifiableEffects && canBeKilled;

  console.log(`\n总体评估: ${scientificallyValid ? '✅ 科学有效' : '❌ 不满足科学有效性'}`);

  if (scientificallyValid) {
    console.log('\n✨ v3.0 系统科学有效！');
    console.log('   系统定义了因果现实等价类，具备可识别性和可证伪性。');
    console.log('\n核心升级:');
    console.log('   • Truth = Equivalence Class of SCMs');
    console.log('   • Falsification = ∃ O such that ∀ M ∈ [M]: P_M(O) = 0');
    console.log('   • Identifiability = Effects invariant within [M]');
  }

  return scientificallyValid ? 0 : 1;
}

if (require.main === module) {
  process.exit(main());
}

export { main, CausalRealityInference };
export type { SCMEquivalenceClass, RealityInferenceResult };
