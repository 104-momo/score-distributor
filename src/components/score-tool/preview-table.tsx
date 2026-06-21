"use client";

import { useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { AlertTriangle, SearchX, CheckCircle2 } from "lucide-react";
import type { SubRecord, GradeConfig } from "@/lib/score-utils";
import { ITEM_MAX, clampSubScore, recalculateRecord } from "@/lib/score-utils";

interface PreviewTableProps {
  records: SubRecord[];
  config: GradeConfig;
  onUpdateRecord: (index: number, record: SubRecord) => void;
}

interface EditableItemDef {
  key: keyof SubRecord;
  label: string;
  max: number;
  group: "attendance" | "class" | "after";
}

// 可编辑的小分项定义
const EDITABLE_ITEMS: EditableItemDef[] = [
  { key: "attendance", label: "出勤", max: ITEM_MAX.attendance, group: "attendance" },
  { key: "classParticipation", label: "课堂参与", max: ITEM_MAX.classParticipation, group: "class" },
  { key: "notes", label: "笔记", max: ITEM_MAX.notes, group: "class" },
  { key: "quiz", label: "随堂考", max: ITEM_MAX.quiz, group: "class" },
  { key: "hw1", label: "作业1", max: ITEM_MAX.hw1, group: "after" },
  { key: "hw2", label: "作业2", max: ITEM_MAX.hw2, group: "after" },
  { key: "hw3", label: "作业3", max: ITEM_MAX.hw3, group: "after" },
  { key: "hw4", label: "作业4", max: ITEM_MAX.hw4, group: "after" },
];

export function PreviewTable({
  records,
  config,
  onUpdateRecord,
}: PreviewTableProps) {
  const indexedRecords = useMemo(
    () => records.map((r, i) => ({ record: r, originalIndex: i })),
    [records]
  );

  const handleScoreChange = (
    originalIndex: number,
    field: keyof SubRecord,
    value: string
  ) => {
    const numValue = value === "" ? 0 : parseFloat(value);
    const itemDef = EDITABLE_ITEMS.find((it) => it.key === field);
    const max = itemDef?.max ?? 10;
    const oldRecord = records[originalIndex];
    const updated = recalculateRecord(
      { ...oldRecord, [field]: clampSubScore(numValue, max) },
      config
    );
    onUpdateRecord(originalIndex, updated);
  };

  const handleBlur = (
    originalIndex: number,
    field: keyof SubRecord,
    value: string
  ) => {
    const numValue = value === "" ? 0 : parseFloat(value);
    const itemDef = EDITABLE_ITEMS.find((it) => it.key === field);
    const max = itemDef?.max ?? 10;
    const clamped = clampSubScore(numValue, max);
    const oldRecord = records[originalIndex];
    if (oldRecord[field] !== clamped) {
      const updated = recalculateRecord(
        { ...oldRecord, [field]: clamped },
        config
      );
      onUpdateRecord(originalIndex, updated);
    }
  };

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <div className="max-h-[560px] overflow-auto custom-scrollbar">
        <Table>
          <TableHeader className="sticky top-0 z-10">
            {/* 第1层表头: 大分组 */}
            <TableRow className="bg-emerald-800 hover:bg-emerald-800 border-emerald-700">
              <TableHead
                rowSpan={2}
                className="text-white text-center font-semibold align-middle"
              >
                序号
              </TableHead>
              <TableHead
                rowSpan={2}
                className="text-white font-semibold align-middle"
              >
                学号
              </TableHead>
              <TableHead
                rowSpan={2}
                className="text-white font-semibold text-center align-middle"
              >
                姓名
              </TableHead>
              {/* 平时成绩(30%) - 跨9列 */}
              <TableHead
                colSpan={9}
                className="text-white font-semibold text-center bg-emerald-700 border-l border-emerald-600"
              >
                平时成绩（30%）
              </TableHead>
              <TableHead
                rowSpan={2}
                className="text-white font-semibold text-center align-middle bg-emerald-700 border-l border-emerald-600"
              >
                平时总成绩
                <span className="block text-[10px] font-normal text-emerald-100">
                  (百分制)
                </span>
              </TableHead>
              <TableHead
                rowSpan={2}
                className="text-white font-semibold text-center align-middle"
              >
                期中
                <span className="block text-[10px] font-normal text-emerald-100">
                  (20%)
                </span>
              </TableHead>
              <TableHead
                rowSpan={2}
                className="text-white font-semibold text-center align-middle"
              >
                期末
                <span className="block text-[10px] font-normal text-emerald-100">
                  (50%)
                </span>
              </TableHead>
              <TableHead
                rowSpan={2}
                className="text-white font-semibold text-center align-middle"
              >
                总评
              </TableHead>
              <TableHead
                rowSpan={2}
                className="text-white font-semibold text-center align-middle"
              >
                等级
              </TableHead>
              <TableHead
                rowSpan={2}
                className="text-white font-semibold text-center align-middle"
              >
                状态
              </TableHead>
            </TableRow>
            {/* 第2层表头: 子分组 */}
            <TableRow className="bg-emerald-700 hover:bg-emerald-700 border-emerald-600">
              {/* 出勤 */}
              <TableHead className="text-white text-center font-semibold text-xs bg-emerald-600">
                出勤
                <span className="block text-[10px] font-normal text-emerald-100">
                  /10
                </span>
              </TableHead>
              {/* 课堂活动10分 (3列) */}
              <TableHead className="text-white text-center font-semibold text-xs bg-teal-600">
                课堂参与
                <span className="block text-[10px] font-normal text-teal-100">
                  /3
                </span>
              </TableHead>
              <TableHead className="text-white text-center font-semibold text-xs bg-teal-600">
                笔记
                <span className="block text-[10px] font-normal text-teal-100">
                  /3
                </span>
              </TableHead>
              <TableHead className="text-white text-center font-semibold text-xs bg-teal-600">
                随堂考
                <span className="block text-[10px] font-normal text-teal-100">
                  /4
                </span>
              </TableHead>
              {/* 课后活动10分 (4列) */}
              <TableHead className="text-white text-center font-semibold text-xs bg-cyan-600">
                作业1
                <span className="block text-[10px] font-normal text-cyan-100">
                  /2
                </span>
              </TableHead>
              <TableHead className="text-white text-center font-semibold text-xs bg-cyan-600">
                作业2
                <span className="block text-[10px] font-normal text-cyan-100">
                  /3
                </span>
              </TableHead>
              <TableHead className="text-white text-center font-semibold text-xs bg-cyan-600">
                作业3
                <span className="block text-[10px] font-normal text-cyan-100">
                  /2
                </span>
              </TableHead>
              <TableHead className="text-white text-center font-semibold text-xs bg-cyan-600">
                作业4
                <span className="block text-[10px] font-normal text-cyan-100">
                  /3
                </span>
              </TableHead>
              <TableHead className="text-white text-center font-semibold text-xs bg-emerald-600">
                小计
                <span className="block text-[10px] font-normal text-emerald-100">
                  /30
                </span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {indexedRecords.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={16}
                  className="text-center text-muted-foreground py-12"
                >
                  暂无数据，请先上传母表并选择子表学生来源
                </TableCell>
              </TableRow>
            )}
            {indexedRecords.map(({ record, originalIndex }) => {
              const isNotFound = record.matchStatus === "not_found";
              const isMismatch = record.matchStatus === "name_mismatch";
              const rowBg = isNotFound
                ? "bg-red-50/60 dark:bg-red-950/20"
                : isMismatch
                ? "bg-amber-50/60 dark:bg-amber-950/20"
                : "hover:bg-muted/50";

              return (
                <TableRow key={originalIndex} className={rowBg}>
                  <TableCell className="text-center text-muted-foreground text-xs">
                    {originalIndex + 1}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {record.studentId}
                  </TableCell>
                  <TableCell className="text-center font-medium">
                    {record.name}
                  </TableCell>
                  {/* 8个可编辑小分 */}
                  {EDITABLE_ITEMS.map((item) => {
                    const value = record[item.key] as number;
                    const borderClass =
                      item.group === "attendance"
                        ? "border-l border-emerald-300/50"
                        : item.key === "classParticipation" ||
                          item.key === "hw1"
                        ? "border-l border-teal-300/50"
                        : "";
                    return (
                      <TableCell
                        key={item.key}
                        className={`text-center p-1 ${borderClass}`}
                      >
                        <Input
                          type="number"
                          min={0}
                          max={item.max}
                          step={1}
                          value={value}
                          disabled={isNotFound}
                          onChange={(e) =>
                            handleScoreChange(
                              originalIndex,
                              item.key,
                              e.target.value
                            )
                          }
                          onBlur={(e) =>
                            handleBlur(
                              originalIndex,
                              item.key,
                              e.target.value
                            )
                          }
                          className="h-8 w-12 text-center mx-auto text-xs"
                        />
                      </TableCell>
                    );
                  })}
                  {/* 平时小计 /30 */}
                  <TableCell className="text-center font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50/30 dark:bg-emerald-950/10">
                    {record.usualTotal}
                  </TableCell>
                  {/* 平时总成绩 百分制 */}
                  <TableCell className="text-center font-semibold text-emerald-700 dark:text-emerald-400">
                    {record.usualPercent}
                  </TableCell>
                  <TableCell className="text-center">
                    {record.midterm ?? "—"}
                  </TableCell>
                  <TableCell className="text-center">
                    {record.final ?? "—"}
                  </TableCell>
                  <TableCell className="text-center font-bold">
                    {record.totalScore ?? "—"}
                  </TableCell>
                  <TableCell className="text-center text-xs">
                    {record.grade || "—"}
                  </TableCell>
                  <TableCell className="text-center">
                    {record.matchStatus === "matched" && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span>
                              <CheckCircle2 className="inline h-4 w-4 text-emerald-600" />
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>匹配成功</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                    {record.matchStatus === "name_mismatch" && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span>
                              <AlertTriangle className="inline h-4 w-4 text-amber-500" />
                            </span>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            {record.warning}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                    {record.matchStatus === "not_found" && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span>
                              <SearchX className="inline h-4 w-4 text-red-500" />
                            </span>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            {record.warning}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
