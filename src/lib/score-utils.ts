/**
 * 平时成绩小分自动计算工具 - 核心逻辑 (v2)
 *
 * 基于真实母表/子表结构:
 * - 母表"综合成绩"工作表: 作业(100%)、考试(100%)、签到(100%)、课程积分(100%)
 * - 母表"考试统计"工作表: 期中考试、期末考试 (原始卷面成绩)
 * - 子表"成绩明细表": 出勤(10分) + 课堂活动(10分) + 课后活动(10分) = 平时(30分)
 *
 * 业务规则:
 * 1. 出勤(10分) = round(签到百分制 / 10)
 * 2. 课堂活动(10分) = round(综合分数 / 10), 综合分数 = (课程积分 + 作业) / 2
 *    - 课堂活动10分 → 课堂参与(3) + 笔记(3) + 随堂考(4)
 * 3. 课后活动(10分) = round(综合分数 / 10)
 *    - 课后活动10分 → 作业1(2) + 作业2(3) + 作业3(2) + 作业4(3)
 * 4. 平时总成绩(百分制) = (出勤 + 课堂活动 + 课后活动) / 30 × 100
 * 5. 总评成绩 = 平时×30% + 期中×20% + 期末×50%
 */

// ============ 类型定义 ============

/** 母表记录 - 来自"综合成绩"工作表 */
export interface MasterRecord {
  studentId: string;
  name: string;
  homework: number; // 作业(100%) 百分制
  examScore: number; // 考试(100%) 百分制 (已折算)
  attendance: number; // 签到(100%) 百分制
  coursePoints: number; // 课程积分(100%) 百分制
  midterm: number; // 期中考试卷面成绩 (来自考试统计表)
  final: number; // 期末考试卷面成绩 (来自考试统计表)
  class?: string; // 班级
}

/** 子表小分子项 */
export interface SubScoreItems {
  // 出勤 (10分)
  attendance: number; // 出勤情况 (0-10)
  // 课堂活动 (10分) = 3+3+4
  classParticipation: number; // 课堂参与 (0-3)
  notes: number; // 笔记 (0-3)
  quiz: number; // 随堂考 (0-4)
  // 课后活动 (10分) = 2+3+2+3
  hw1: number; // 作业1 (0-2)
  hw2: number; // 作业2 (0-3)
  hw3: number; // 作业3 (0-2)
  hw4: number; // 作业4 (0-3)
}

/** 子表完整记录 */
export interface SubRecord extends SubScoreItems {
  studentId: string;
  name: string;
  classActivityTotal: number; // 课堂活动合计 (0-10) = 参与+笔记+随堂考
  afterClassTotal: number; // 课后活动合计 (0-10) = 作业1-4
  usualTotal: number; // 平时总分 (0-30) = 出勤+课堂活动+课后活动
  usualPercent: number; // 平时总成绩(百分制) = usualTotal/30*100
  midterm: number | null; // 期中成绩
  final: number | null; // 期末成绩
  totalScore: number | null; // 总评成绩
  grade: string; // 等级成绩
  // 原始母表数据 (用于参考)
  rawAttendance: number; // 母表签到百分制
  rawHomework: number; // 母表作业百分制
  rawCoursePoints: number; // 母表课程积分百分制
  compositeScore: number; // 综合分数 = (课程积分+作业)/2
  matchStatus: "matched" | "not_found" | "name_mismatch";
  warning?: string;
}

/** 综合分数计算方式 */
export type CompositeMode =
  | "average" // (课程积分 + 作业) / 2  [默认, 解决课程积分为0的问题]
  | "homework_only" // 仅作业 (课程积分不参与课堂/课后计算)
  | "course_points_only" // 仅课程积分
  | "max" // max(课程积分, 作业)
  | "weighted"; // 加权 (课程积分×权重 + 作业×(1-权重))

/** 成绩构成配置 */
export interface GradeConfig {
  compositeMode: CompositeMode;
  compositeWeight: number; // weighted模式下课程积分的权重 (0-1)
  usualWeight: number; // 平时占比 (默认0.3)
  midtermWeight: number; // 期中占比 (默认0.2)
  finalWeight: number; // 期末占比 (默认0.5)
  calculateTotal: boolean; // 是否计算总评成绩
  calculateGrade: boolean; // 是否计算等级
}

export const DEFAULT_CONFIG: GradeConfig = {
  compositeMode: "average",
  compositeWeight: 0.5,
  usualWeight: 0.3,
  midtermWeight: 0.2,
  finalWeight: 0.5,
  calculateTotal: true,
  calculateGrade: true,
};

// ============ 子项满分定义 ============

export const ITEM_MAX = {
  attendance: 10,
  classParticipation: 3,
  notes: 3,
  quiz: 4,
  hw1: 2,
  hw2: 3,
  hw3: 2,
  hw4: 3,
} as const;

/** 课堂活动子项及满分 (顺序用于余数分配) */
const CLASS_ACTIVITY_ITEMS: { key: keyof SubScoreItems; max: number }[] = [
  { key: "classParticipation", max: 3 },
  { key: "notes", max: 3 },
  { key: "quiz", max: 4 },
];

/** 课后活动子项及满分 */
const AFTER_CLASS_ITEMS: { key: keyof SubScoreItems; max: number }[] = [
  { key: "hw1", max: 2 },
  { key: "hw2", max: 3 },
  { key: "hw3", max: 2 },
  { key: "hw4", max: 3 },
];

// ============ 核心计算函数 ============

/**
 * 计算综合分数
 */
export function calcCompositeScore(
  homework: number,
  coursePoints: number,
  config: GradeConfig
): number {
  const hw = clamp(homework, 0, 100);
  const cp = clamp(coursePoints, 0, 100);

  switch (config.compositeMode) {
    case "homework_only":
      return hw;
    case "course_points_only":
      return cp;
    case "max":
      return Math.max(hw, cp);
    case "weighted":
      return cp * config.compositeWeight + hw * (1 - config.compositeWeight);
    case "average":
    default:
      return (hw + cp) / 2;
  }
}

/**
 * 将一个目标总分按子项满分比例拆分为整数
 * 确保各子项不超过满分，且总和等于目标
 */
function distributeToItems(
  target: number,
  items: { key: keyof SubScoreItems; max: number }[]
): Partial<SubScoreItems> {
  const totalMax = items.reduce((s, it) => s + it.max, 0);
  const clampedTarget = Math.max(0, Math.min(totalMax, target));

  // 按满分比例计算初始值
  const raw = items.map((it) => ({
    key: it.key,
    max: it.max,
    value: (clampedTarget * it.max) / totalMax,
  }));

  // 取整
  let allocated = raw.map((r) => ({
    ...r,
    int: Math.min(r.max, Math.floor(r.value)),
  }));

  let remainder = clampedTarget - allocated.reduce((s, a) => s + a.int, 0);

  // 按小数部分降序分配余数
  const fracs = allocated
    .map((a, i) => ({ i, frac: raw[i].value - a.int }))
    .sort((a, b) => b.frac - a.frac);

  for (const { i } of fracs) {
    if (remainder <= 0) break;
    if (allocated[i].int < allocated[i].max) {
      allocated[i].int++;
      remainder--;
    }
  }

  // 兜底: 若仍有余数(因某些项已满)，分配到未满项
  let guard = 0;
  while (remainder > 0 && guard < items.length * 2) {
    for (let i = 0; i < allocated.length && remainder > 0; i++) {
      if (allocated[i].int < allocated[i].max) {
        allocated[i].int++;
        remainder--;
      }
    }
    guard++;
  }

  const result: Partial<SubScoreItems> = {};
  allocated.forEach((a) => {
    (result as Record<string, number>)[a.key] = a.int;
  });
  return result;
}

/**
 * 计算单条记录的所有小分
 */
export function calculateScores(
  master: MasterRecord,
  config: GradeConfig
): SubScoreItems & {
  classActivityTotal: number;
  afterClassTotal: number;
  usualTotal: number;
  usualPercent: number;
  compositeScore: number;
} {
  // 1. 出勤 (10分) = round(签到/10)
  const attendance = clamp(
    Math.round(master.attendance / 10),
    0,
    ITEM_MAX.attendance
  );

  // 2. 综合分数
  const compositeScore = calcCompositeScore(
    master.homework,
    master.coursePoints,
    config
  );

  // 3. 课堂活动 (10分) = round(综合分数/10)
  const classActivityTarget = clamp(
    Math.round(compositeScore / 10),
    0,
    10
  );
  const classItems = distributeToItems(classActivityTarget, CLASS_ACTIVITY_ITEMS);

  // 4. 课后活动 (10分) = round(综合分数/10)
  const afterClassTarget = clamp(
    Math.round(compositeScore / 10),
    0,
    10
  );
  const afterItems = distributeToItems(afterClassTarget, AFTER_CLASS_ITEMS);

  const scores: SubScoreItems = {
    attendance,
    classParticipation: (classItems.classParticipation as number) ?? 0,
    notes: (classItems.notes as number) ?? 0,
    quiz: (classItems.quiz as number) ?? 0,
    hw1: (afterItems.hw1 as number) ?? 0,
    hw2: (afterItems.hw2 as number) ?? 0,
    hw3: (afterItems.hw3 as number) ?? 0,
    hw4: (afterItems.hw4 as number) ?? 0,
  };

  const classActivityTotal =
    scores.classParticipation + scores.notes + scores.quiz;
  const afterClassTotal = scores.hw1 + scores.hw2 + scores.hw3 + scores.hw4;
  const usualTotal = attendance + classActivityTotal + afterClassTotal;
  // 平时总成绩(百分制) 取整
  const usualPercent = Math.round((usualTotal / 30) * 100);

  // ===== 平时分低于60时自动提升到60 =====
  if (usualPercent < 60) {
    const targetTotal = 18; // ceil(60 / 100 * 30), 需至少18分才能达到平时分60
    let remaining = targetTotal - usualTotal;

    if (remaining > 0) {
      // 所有子项及其当前值、上限
      const boostItems: { key: keyof SubScoreItems; current: number; max: number }[] = [
        { key: 'attendance', current: scores.attendance, max: ITEM_MAX.attendance },
        { key: 'classParticipation', current: scores.classParticipation, max: ITEM_MAX.classParticipation },
        { key: 'notes', current: scores.notes, max: ITEM_MAX.notes },
        { key: 'quiz', current: scores.quiz, max: ITEM_MAX.quiz },
        { key: 'hw1', current: scores.hw1, max: ITEM_MAX.hw1 },
        { key: 'hw2', current: scores.hw2, max: ITEM_MAX.hw2 },
        { key: 'hw3', current: scores.hw3, max: ITEM_MAX.hw3 },
        { key: 'hw4', current: scores.hw4, max: ITEM_MAX.hw4 },
      ];

      while (remaining > 0) {
        const available = boostItems.filter(i => i.current < i.max);
        if (available.length === 0) break;

        const totalRemaining = available.reduce((s, i) => s + (i.max - i.current), 0);
        if (totalRemaining <= 0) break;

        let allocatedThisRound = 0;
        for (const item of available) {
          const capacity = item.max - item.current;
          if (capacity <= 0) continue;
          const share = Math.min(capacity, Math.max(1, Math.round((capacity / totalRemaining) * remaining)));
          if (share > 0) {
            (scores as unknown as Record<string, number>)[item.key] += share;
            item.current += share;
            remaining -= share;
            allocatedThisRound += share;
          }
        }
        if (allocatedThisRound === 0) break;
      }
    }
  }

  // 确保所有子项不超过上限（经过可能的提升后）
  const finalAttendance = Math.min(scores.attendance, ITEM_MAX.attendance);
  const finalClassParticipation = Math.min(scores.classParticipation, ITEM_MAX.classParticipation);
  const finalNotes = Math.min(scores.notes, ITEM_MAX.notes);
  const finalQuiz = Math.min(scores.quiz, ITEM_MAX.quiz);
  const finalHw1 = Math.min(scores.hw1, ITEM_MAX.hw1);
  const finalHw2 = Math.min(scores.hw2, ITEM_MAX.hw2);
  const finalHw3 = Math.min(scores.hw3, ITEM_MAX.hw3);
  const finalHw4 = Math.min(scores.hw4, ITEM_MAX.hw4);

  const finalClassActivityTotal = finalClassParticipation + finalNotes + finalQuiz;
  const finalAfterClassTotal = finalHw1 + finalHw2 + finalHw3 + finalHw4;
  const finalUsualTotal = finalAttendance + finalClassActivityTotal + finalAfterClassTotal;
  const finalUsualPercent = Math.max(60, Math.round((finalUsualTotal / 30) * 100));

  return {
    attendance: finalAttendance,
    classParticipation: finalClassParticipation,
    notes: finalNotes,
    quiz: finalQuiz,
    hw1: finalHw1,
    hw2: finalHw2,
    hw3: finalHw3,
    hw4: finalHw4,
    classActivityTotal: finalClassActivityTotal,
    afterClassTotal: finalAfterClassTotal,
    usualTotal: finalUsualTotal,
    usualPercent: finalUsualPercent,
    compositeScore: Math.round(compositeScore),
  };
}

/**
 * 计算等级成绩
 */
export function calcGrade(score: number | null): string {
  if (score == null) return "";
  if (score >= 90) return "优";
  if (score >= 80) return "良";
  if (score >= 70) return "中";
  if (score >= 60) return "及格";
  return "不及格";
}

// ============ 检索与匹配 ============

/**
 * 从母表按学号检索并计算所有子表记录
 */
export function lookupAndDistribute(
  masterRecords: MasterRecord[],
  subStudents: { studentId: string; name: string }[],
  config: GradeConfig
): SubRecord[] {
  const masterMap = new Map<string, MasterRecord>();
  for (const record of masterRecords) {
    const key = normalizeId(record.studentId);
    if (key) masterMap.set(key, record);
  }

  return subStudents.map((student) => {
    const key = normalizeId(student.studentId);
    const matched = key ? masterMap.get(key) : undefined;

    if (!matched) {
      return {
        studentId: student.studentId,
        name: student.name,
        attendance: 0,
        classParticipation: 0,
        notes: 0,
        quiz: 0,
        hw1: 0,
        hw2: 0,
        hw3: 0,
        hw4: 0,
        classActivityTotal: 0,
        afterClassTotal: 0,
        usualTotal: 0,
        usualPercent: 0,
        midterm: null,
        final: null,
        totalScore: null,
        grade: "",
        rawAttendance: 0,
        rawHomework: 0,
        rawCoursePoints: 0,
        compositeScore: 0,
        matchStatus: "not_found",
        warning: "母表中未找到该学号",
      };
    }

    const nameMatch = normalizeName(matched.name) === normalizeName(student.name);
    const warning = nameMatch
      ? undefined
      : `母表姓名为「${matched.name}」，与子表「${student.name}」不一致`;

    const calc = calculateScores(matched, config);

    // 期中/期末成绩取整
    const midterm = matched.midterm != null ? Math.round(matched.midterm) : null;
    const final = matched.final != null ? Math.round(matched.final) : null;

    let totalScore: number | null = null;
    if (config.calculateTotal) {
      const usualPart = calc.usualPercent * config.usualWeight;
      const midtermPart = midterm != null ? midterm * config.midtermWeight : 0;
      const finalPart = final != null ? final * config.finalWeight : 0;
      // 总评成绩取整
      totalScore = Math.round(usualPart + midtermPart + finalPart);
    }

    const grade = config.calculateGrade ? calcGrade(totalScore) : "";

    return {
      studentId: student.studentId,
      name: student.name,
      attendance: calc.attendance,
      classParticipation: calc.classParticipation,
      notes: calc.notes,
      quiz: calc.quiz,
      hw1: calc.hw1,
      hw2: calc.hw2,
      hw3: calc.hw3,
      hw4: calc.hw4,
      classActivityTotal: calc.classActivityTotal,
      afterClassTotal: calc.afterClassTotal,
      usualTotal: calc.usualTotal,
      usualPercent: calc.usualPercent,
      midterm,
      final,
      totalScore,
      grade,
      rawAttendance: Math.round(matched.attendance),
      rawHomework: Math.round(matched.homework),
      rawCoursePoints: Math.round(matched.coursePoints),
      compositeScore: calc.compositeScore,
      matchStatus: nameMatch ? "matched" : "name_mismatch",
      warning,
    };
  });
}

// ============ 手动编辑后重算 ============

/**
 * 重新计算单条记录的派生字段 (手动修改小分后调用)
 */
export function recalculateRecord(
  record: SubRecord,
  config: GradeConfig
): SubRecord {
  const attendance = clampInt(record.attendance, ITEM_MAX.attendance);
  const classParticipation = clampInt(record.classParticipation, ITEM_MAX.classParticipation);
  const notes = clampInt(record.notes, ITEM_MAX.notes);
  const quiz = clampInt(record.quiz, ITEM_MAX.quiz);
  const hw1 = clampInt(record.hw1, ITEM_MAX.hw1);
  const hw2 = clampInt(record.hw2, ITEM_MAX.hw2);
  const hw3 = clampInt(record.hw3, ITEM_MAX.hw3);
  const hw4 = clampInt(record.hw4, ITEM_MAX.hw4);

  const classActivityTotal = classParticipation + notes + quiz;
  const afterClassTotal = hw1 + hw2 + hw3 + hw4;
  const usualTotal = attendance + classActivityTotal + afterClassTotal;
  // 平时总成绩(百分制) 取整
  const usualPercent = Math.round((usualTotal / 30) * 100);

  // 平时分低于60时自动提升到60
  const boostedUsualPercent = Math.max(60, usualPercent);

  // 如果平时分被提升，则总评成绩需要使用提升后的平时分
  const effectiveUsualPercent = boostedUsualPercent;

  let totalScore: number | null = null;
  if (config.calculateTotal && record.midterm != null) {
    const usualPart = effectiveUsualPercent * config.usualWeight;
    const midtermPart = record.midterm * config.midtermWeight;
    const finalPart = (record.final ?? 0) * config.finalWeight;
    // 总评成绩取整
    totalScore = Math.round(usualPart + midtermPart + finalPart);
  }

  const grade = config.calculateGrade ? calcGrade(totalScore) : "";

  return {
    ...record,
    attendance,
    classParticipation,
    notes,
    quiz,
    hw1,
    hw2,
    hw3,
    hw4,
    classActivityTotal,
    afterClassTotal,
    usualTotal,
    usualPercent: effectiveUsualPercent,
    totalScore,
    grade,
  };
}

// ============ 统计 ============

export interface Stats {
  total: number;
  matched: number;
  notFound: number;
  nameMismatch: number;
  avgAttendance: number;
  avgClassActivity: number;
  avgAfterClass: number;
  avgUsual: number;
  avgMidterm: number;
  avgFinal: number;
  avgTotal: number;
  gradeDist: { excellent: number; good: number; medium: number; pass: number; fail: number };
}

export function calculateStats(records: SubRecord[]): Stats {
  const total = records.length;
  if (total === 0) {
    return {
      total: 0, matched: 0, notFound: 0, nameMismatch: 0,
      avgAttendance: 0, avgClassActivity: 0, avgAfterClass: 0,
      avgUsual: 0, avgMidterm: 0, avgFinal: 0, avgTotal: 0,
      gradeDist: { excellent: 0, good: 0, medium: 0, pass: 0, fail: 0 },
    };
  }

  const matched = records.filter((r) => r.matchStatus === "matched").length;
  const notFound = records.filter((r) => r.matchStatus === "not_found").length;
  const nameMismatch = records.filter((r) => r.matchStatus === "name_mismatch").length;

  const valid = records.filter((r) => r.matchStatus !== "not_found");
  const n = valid.length || 1;
  // 平均值取整
  const avg = (fn: (r: SubRecord) => number) =>
    Math.round(valid.reduce((s, r) => s + fn(r), 0) / n);

  const gradeDist = { excellent: 0, good: 0, medium: 0, pass: 0, fail: 0 };
  valid.forEach((r) => {
    if (r.totalScore == null) return;
    if (r.totalScore >= 90) gradeDist.excellent++;
    else if (r.totalScore >= 80) gradeDist.good++;
    else if (r.totalScore >= 70) gradeDist.medium++;
    else if (r.totalScore >= 60) gradeDist.pass++;
    else gradeDist.fail++;
  });

  return {
    total, matched, notFound, nameMismatch,
    avgAttendance: avg((r) => r.attendance),
    avgClassActivity: avg((r) => r.classActivityTotal),
    avgAfterClass: avg((r) => r.afterClassTotal),
    avgUsual: avg((r) => r.usualPercent),
    avgMidterm: avg((r) => r.midterm ?? 0),
    avgFinal: avg((r) => r.final ?? 0),
    avgTotal: avg((r) => r.totalScore ?? 0),
    gradeDist,
  };
}

// ============ 工具函数 ============

function clamp(v: number, min: number, max: number): number {
  if (isNaN(v)) return min;
  return Math.max(min, Math.min(max, v));
}

function clampInt(v: number, max: number): number {
  const n = Math.round(v);
  if (isNaN(n)) return 0;
  return Math.max(0, Math.min(max, n));
}

export function clampSubScore(value: number, max: number): number {
  return clampInt(value, max);
}

function normalizeId(id: string): string {
  return String(id).trim().replace(/^0+/, "");
}

function normalizeName(name: string): string {
  return String(name).trim().replace(/\s+/g, "");
}
