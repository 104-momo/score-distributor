"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import {
  GraduationCap,
  FileSpreadsheet,
  Users,
  Settings2,
  Table2,
  Download,
  CheckCircle2,
  AlertCircle,
  Info,
  Sparkles,
  RotateCcw,
  Loader2,
  TrendingUp,
  ChevronRight,
  FileText,
  Github,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { FileUploader } from "@/components/score-tool/file-uploader";
import { PreviewTable } from "@/components/score-tool/preview-table";
import {
  parseMasterFile,
  parseSubTemplateFile,
  type ParsedMasterData,
} from "@/lib/excel-reader";
import {
  lookupAndDistribute,
  calculateStats,
  DEFAULT_CONFIG,
  type MasterRecord,
  type SubRecord,
  type GradeConfig,
  type CompositeMode,
} from "@/lib/score-utils";
import {
  generateExportExcel,
  generateMasterTemplate,
  generateSubTemplate,
  downloadBlob,
} from "@/lib/client-excel";

type SubSource = "template" | "master";

export default function Home() {
  const { toast } = useToast();

  const [masterData, setMasterData] = useState<ParsedMasterData | null>(null);
  const [masterFileName, setMasterFileName] = useState("");
  const [masterLoading, setMasterLoading] = useState(false);

  const [subSource, setSubSource] = useState<SubSource>("master");
  const [subFileName, setSubFileName] = useState("");
  const [subLoading, setSubLoading] = useState(false);
  const [subStudents, setSubStudents] = useState<
    { studentId: string; name: string }[]
  >([]);

  const [config, setConfig] = useState<GradeConfig>(DEFAULT_CONFIG);
  const [courseName, setCourseName] = useState("");
  const [className, setClassName] = useState("");
  const [teacherName, setTeacherName] = useState("");

  const [records, setRecords] = useState<SubRecord[]>([]);
  const [exporting, setExporting] = useState(false);
  const [exportFileName, setExportFileName] = useState("");
  // 标记用户是否手动编辑过文件名 (未编辑时跟随课程名自动生成)
  const [fileNameTouched, setFileNameTouched] = useState(false);

  // 智能默认文件名: 未手动编辑时跟随课程名/班级
  const effectiveFileName = useMemo(() => {
    if (fileNameTouched && exportFileName.trim()) {
      return exportFileName.trim();
    }
    if (courseName || className) {
      return [courseName, className].filter(Boolean).join("-") + "成绩明细表";
    }
    return "成绩明细表";
  }, [exportFileName, fileNameTouched, courseName, className]);

  const handleFileNameChange = (value: string) => {
    setExportFileName(value);
    setFileNameTouched(true);
  };

  // ===== 母表上传 =====
  const handleMasterUpload = useCallback(
    async (file: File) => {
      setMasterLoading(true);
      try {
        const parsed = await parseMasterFile(file);
        setMasterData(parsed);
        setMasterFileName(file.name);
        if (parsed.courseName && !courseName) setCourseName(parsed.courseName);
        if (parsed.className && !className) setClassName(parsed.className);
        if (parsed.teacherName && !teacherName) setTeacherName(parsed.teacherName);

        if (parsed.records.length === 0) {
          toast({
            title: "未识别到有效数据",
            description: "请检查母表是否包含「综合成绩」工作表",
            variant: "destructive",
          });
        } else {
          toast({
            title: "母表解析成功",
            description: `共识别 ${parsed.records.length} 名学生${
              parsed.warnings.length ? "（有警告）" : ""
            }`,
          });
        }
      } catch (err) {
        toast({
          title: "解析失败",
          description: err instanceof Error ? err.message : "文件格式错误",
          variant: "destructive",
        });
        setMasterData(null);
        setMasterFileName("");
      } finally {
        setMasterLoading(false);
      }
    },
    [toast, courseName, className, teacherName]
  );

  const handleMasterClear = () => {
    setMasterData(null);
    setMasterFileName("");
    setRecords([]);
  };

  // ===== 子表上传 =====
  const handleSubUpload = useCallback(
    async (file: File) => {
      setSubLoading(true);
      try {
        const parsed = await parseSubTemplateFile(file);
        setSubStudents(parsed.students);
        setSubFileName(file.name);
        if (parsed.courseName && !courseName) setCourseName(parsed.courseName);
        if (parsed.className && !className) setClassName(parsed.className);
        if (parsed.teacherName && !teacherName) setTeacherName(parsed.teacherName);

        if (parsed.students.length === 0) {
          toast({
            title: "未识别到学生",
            description: "请检查子表是否包含学号和姓名",
            variant: "destructive",
          });
        } else {
          toast({
            title: "子表名单解析成功",
            description: `共识别 ${parsed.students.length} 名学生`,
          });
        }
      } catch (err) {
        toast({
          title: "解析失败",
          description: err instanceof Error ? err.message : "文件格式错误",
          variant: "destructive",
        });
      } finally {
        setSubLoading(false);
      }
    },
    [toast, courseName, className, teacherName]
  );

  const handleSubClear = () => {
    setSubStudents([]);
    setSubFileName("");
  };

  // ===== 自动计算 =====
  const canCalculate = useMemo(() => {
    if (!masterData || masterData.records.length === 0) return false;
    if (subSource === "template" && subStudents.length === 0) return false;
    return true;
  }, [masterData, subSource, subStudents]);

  const currentStudents = useMemo(() => {
    if (subSource === "master" && masterData) {
      return masterData.records.map((r) => ({
        studentId: r.studentId,
        name: r.name,
      }));
    }
    return subStudents;
  }, [subSource, masterData, subStudents]);

  useEffect(() => {
    if (!canCalculate || !masterData) {
      setRecords([]);
      return;
    }
    const newRecords = lookupAndDistribute(
      masterData.records,
      currentStudents,
      config
    );
    setRecords(newRecords);
  }, [canCalculate, masterData, currentStudents, config]);

  // ===== 配置 =====
  const updateConfig = (updates: Partial<GradeConfig>) => {
    setConfig((prev) => ({ ...prev, ...updates }));
  };

  const weightsSum = useMemo(() => {
    return Math.round(
      (config.usualWeight + config.midtermWeight + config.finalWeight) * 100
    );
  }, [config.usualWeight, config.midtermWeight, config.finalWeight]);
  const weightsValid = weightsSum === 100;

  const stats = useMemo(() => calculateStats(records), [records]);

  // ===== 导出 =====
  const handleExport = async () => {
    if (records.length === 0) {
      toast({
        title: "无数据可导出",
        description: "请先完成成绩计算",
        variant: "destructive",
      });
      return;
    }
    setExporting(true);
    try {
      // 客户端直接生成 Excel Blob（无需服务端 API）
      const blob = await generateExportExcel({
        records,
        config,
        courseName,
        className,
        teacherName,
      });
      // 清理文件名中的非法字符 (Windows: \ / : * ? " < > |)
      const safeName = effectiveFileName.replace(/[\\/:*?"<>|]/g, "_");
      downloadBlob(blob, `${safeName}.xlsx`);
      toast({
        title: "导出成功",
        description: `已导出 ${records.length} 条记录至「${safeName}.xlsx」`,
      });
    } catch (err) {
      toast({
        title: "导出失败",
        description: err instanceof Error ? err.message : "未知错误",
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  };

  const handleReset = () => {
    setMasterData(null);
    setMasterFileName("");
    setSubStudents([]);
    setSubFileName("");
    setRecords([]);
    setConfig(DEFAULT_CONFIG);
    setCourseName("");
    setClassName("");
    setTeacherName("");
    setExportFileName("");
    setFileNameTouched(false);
  };

  const handleDownloadSample = async (type: "master" | "sub") => {
    try {
      const blob =
        type === "master"
          ? await generateMasterTemplate()
          : await generateSubTemplate();
      const filename =
        type === "master" ? "成绩母表模板.xlsx" : "子表名单模板.xlsx";
      downloadBlob(blob, filename);
      toast({
        title: "模板下载成功",
        description: `${filename} 已开始下载`,
      });
    } catch (err) {
      toast({
        title: "下载失败",
        description: err instanceof Error ? err.message : "未知错误",
        variant: "destructive",
      });
    }
  };

  const step1Done = !!masterData && masterData.records.length > 0;
  const step2Done = currentStudents.length > 0;
  const step3Done = weightsValid;
  const step4Done = records.length > 0;

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-emerald-50/30 via-background to-background dark:from-emerald-950/10">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-600 to-teal-600 text-white shadow-md">
                <GraduationCap className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-lg font-bold tracking-tight">
                  平时成绩小分自动计算工具
                </h1>
                <p className="text-xs text-muted-foreground hidden sm:block">
                  签到→出勤 · 课程积分+作业→课堂活动&课后活动 · 自动折算整数小分
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={handleReset} className="text-muted-foreground">
                <RotateCcw className="h-4 w-4" />
                <span className="hidden sm:inline">重置</span>
              </Button>
              <Button
                onClick={handleExport}
                disabled={!step4Done || exporting}
                className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white"
              >
                {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                导出Excel
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 mx-auto max-w-7xl w-full px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* 步骤指示器 */}
        <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto pb-2">
          <StepIndicator step={1} label="上传母表" done={step1Done} active={!step1Done} />
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
          <StepIndicator step={2} label="选择名单" done={step2Done} active={step1Done && !step2Done} />
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
          <StepIndicator step={3} label="配置规则" done={step3Done} active={step2Done} />
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
          <StepIndicator step={4} label="预览导出" done={step4Done} active={step3Done && !step4Done} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 左侧 */}
          <div className="lg:col-span-2 space-y-6">
            {/* Step 1 */}
            <Card className={step1Done ? "border-emerald-300" : ""}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <StepBadge number={1} done={step1Done} />
                  上传成绩母表
                </CardTitle>
                <CardDescription>
                  上传含「综合成绩」和「考试统计」工作表的母表，系统自动读取作业、签到、课程积分、期中、期末成绩
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <FileUploader
                  onFileSelect={handleMasterUpload}
                  label="点击或拖拽上传母表"
                  fileName={masterFileName}
                  loading={masterLoading}
                  onClear={handleMasterClear}
                />
                {masterData && masterData.records.length > 0 && (
                  <>
                    <div className="flex items-center justify-between rounded-lg bg-emerald-50 dark:bg-emerald-950/20 p-3">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                        <span className="text-sm font-medium">
                          已加载 {masterData.records.length} 名学生
                        </span>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => handleDownloadSample("master")} className="text-emerald-700">
                        <Download className="h-3.5 w-3.5" />
                        母表模板
                      </Button>
                    </div>
                    <div className="rounded-lg border max-h-44 overflow-auto custom-scrollbar">
                      <table className="w-full text-xs">
                        <thead className="sticky top-0 bg-muted">
                          <tr>
                            <th className="text-left p-2 font-medium">学号</th>
                            <th className="text-left p-2 font-medium">姓名</th>
                            <th className="text-right p-2 font-medium" title="作业(100%)">作业</th>
                            <th className="text-right p-2 font-medium" title="签到(100%)">签到</th>
                            <th className="text-right p-2 font-medium" title="课程积分(100%)">课程积分</th>
                            <th className="text-right p-2 font-medium" title="期中">期中</th>
                          </tr>
                        </thead>
                        <tbody>
                          {masterData.records.slice(0, 8).map((r, i) => (
                            <tr key={i} className="border-t">
                              <td className="p-2 font-mono">{r.studentId}</td>
                              <td className="p-2">{r.name}</td>
                              <td className="p-2 text-right">{r.homework}</td>
                              <td className="p-2 text-right">{r.attendance}</td>
                              <td className="p-2 text-right">{r.coursePoints}</td>
                              <td className="p-2 text-right">{r.midterm}</td>
                            </tr>
                          ))}
                          {masterData.records.length > 8 && (
                            <tr className="border-t">
                              <td colSpan={6} className="p-2 text-center text-muted-foreground">
                                还有 {masterData.records.length - 8} 条记录...
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Step 2 */}
            <Card className={!step1Done ? "opacity-60" : step2Done ? "border-emerald-300" : ""}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <StepBadge number={2} done={step2Done} />
                  选择子表学生来源
                </CardTitle>
                <CardDescription>
                  使用母表全部学生，或上传子表名单（按学号+姓名匹配）
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs value={subSource} onValueChange={(v) => setSubSource(v as SubSource)}>
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="master" disabled={!step1Done}>
                      <Users className="h-4 w-4 mr-1.5" />
                      使用母表全部学生
                    </TabsTrigger>
                    <TabsTrigger value="template" disabled={!step1Done}>
                      <FileSpreadsheet className="h-4 w-4 mr-1.5" />
                      上传子表名单
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="master" className="mt-4">
                    {masterData ? (
                      <Alert className="border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/20">
                        <Info className="h-4 w-4 text-emerald-600" />
                        <AlertDescription>
                          将使用母表中全部 <strong>{masterData.records.length}</strong> 名学生生成成绩明细表
                        </AlertDescription>
                      </Alert>
                    ) : (
                      <Alert><Info className="h-4 w-4" /><AlertDescription>请先上传母表</AlertDescription></Alert>
                    )}
                  </TabsContent>
                  <TabsContent value="template" className="mt-4 space-y-3">
                    <FileUploader
                      onFileSelect={handleSubUpload}
                      label="上传子表名单"
                      fileName={subFileName}
                      loading={subLoading}
                      onClear={handleSubClear}
                      variant="compact"
                    />
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        {subStudents.length > 0 ? `已加载 ${subStudents.length} 名学生` : "未上传名单"}
                      </span>
                      <Button variant="ghost" size="sm" onClick={() => handleDownloadSample("sub")} className="text-emerald-700">
                        <Download className="h-3.5 w-3.5" />
                        子表模板
                      </Button>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

            {/* Step 3 */}
            <Card className={!step2Done ? "opacity-60" : step3Done ? "border-emerald-300" : "border-amber-300"}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <StepBadge number={3} done={step3Done} />
                  配置成绩构成与折算规则
                </CardTitle>
                <CardDescription>
                  设置综合分数计算方式和成绩权重
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* 课程信息 */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="course" className="text-xs">课程名称</Label>
                    <Input id="course" placeholder="如：影视制片管理" value={courseName} onChange={(e) => setCourseName(e.target.value)} className="h-9" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="class" className="text-xs">班级</Label>
                    <Input id="class" placeholder="如：新媒体摄影2307" value={className} onChange={(e) => setClassName(e.target.value)} className="h-9" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="teacher" className="text-xs">任课教师</Label>
                    <Input id="teacher" placeholder="如：葛老师" value={teacherName} onChange={(e) => setTeacherName(e.target.value)} className="h-9" />
                  </div>
                </div>

                <Separator />

                {/* 成绩构成权重 */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-emerald-600" />
                    成绩构成权重
                  </Label>
                  <div className="grid grid-cols-3 gap-3">
                    <WeightInput label="平时" value={config.usualWeight} onChange={(v) => updateConfig({ usualWeight: v })} disabled />
                    <WeightInput label="期中" value={config.midtermWeight} onChange={(v) => updateConfig({ midtermWeight: v })} />
                    <WeightInput label="期末" value={config.finalWeight} onChange={(v) => updateConfig({ finalWeight: v })} />
                  </div>
                  <WeightBar usual={config.usualWeight} midterm={config.midtermWeight} final={config.finalWeight} />
                  <div className="flex items-center justify-between">
                    <Label htmlFor="calc-total" className="text-xs text-muted-foreground">计算总评成绩和等级</Label>
                    <Switch id="calc-total" checked={config.calculateTotal} onCheckedChange={(v) => updateConfig({ calculateTotal: v, calculateGrade: v })} />
                  </div>
                </div>

                <Separator />

                {/* 综合分数计算方式 */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-emerald-600" />
                    综合分数计算方式
                    <span className="text-xs font-normal text-muted-foreground">(用于课堂活动&课后活动)</span>
                  </Label>
                  <Select
                    value={config.compositeMode}
                    onValueChange={(v) => updateConfig({ compositeMode: v as CompositeMode })}
                  >
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="average">平均: (课程积分 + 作业) / 2  [推荐]</SelectItem>
                      <SelectItem value="homework_only">仅作业</SelectItem>
                      <SelectItem value="course_points_only">仅课程积分</SelectItem>
                      <SelectItem value="max">取最大值: max(课程积分, 作业)</SelectItem>
                      <SelectItem value="weighted">加权: 课程积分×权重 + 作业×(1-权重)</SelectItem>
                    </SelectContent>
                  </Select>
                  {config.compositeMode === "weighted" && (
                    <div className="grid grid-cols-2 gap-3">
                      <WeightInput label="课程积分权重" value={config.compositeWeight} onChange={(v) => updateConfig({ compositeWeight: v })} isPercent />
                      <div className="flex items-end">
                        <p className="text-xs text-muted-foreground pb-2">
                          作业权重 = {Math.round((1 - config.compositeWeight) * 100)}%
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <Separator />

                {/* 折算规则说明 */}
                <div className="rounded-lg border border-emerald-200 bg-emerald-50/30 dark:bg-emerald-950/10 p-3 space-y-2">
                  <p className="text-xs font-medium text-emerald-800 dark:text-emerald-300">折算规则</p>
                  <div className="space-y-1 text-xs text-muted-foreground">
                    <p>• <b className="text-foreground">出勤(10分)</b> = round(母表签到百分制 / 10)</p>
                    <p>• <b className="text-foreground">课堂活动(10分)</b> = round(综合分数 / 10)，按 3:3:4 拆分到课堂参与·笔记·随堂考</p>
                    <p>• <b className="text-foreground">课后活动(10分)</b> = round(综合分数 / 10)，按 2:3:2:3 拆分到作业1·2·3·4</p>
                    <p>• <b className="text-foreground">平时总成绩(百分制)</b> = (出勤+课堂活动+课后活动) / 30 × 100</p>
                    <p>• <b className="text-foreground">总评成绩</b> = 平时×{Math.round(config.usualWeight * 100)}% + 期中×{Math.round(config.midtermWeight * 100)}% + 期末×{Math.round(config.finalWeight * 100)}%</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 右侧 */}
          <div className="space-y-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Table2 className="h-4 w-4 text-emerald-600" />
                  数据统计
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <StatCard label="学生总数" value={stats.total} accent="neutral" />
                  <StatCard label="成功匹配" value={stats.matched} accent="green" />
                  <StatCard label="姓名不符" value={stats.nameMismatch} accent="amber" />
                  <StatCard label="未找到" value={stats.notFound} accent="red" />
                </div>
                {records.length > 0 && (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground">平均分（已匹配学生）</p>
                      <div className="space-y-1.5">
                        <AvgBar label="出勤" value={stats.avgAttendance} max={10} />
                        <AvgBar label="课堂活动" value={stats.avgClassActivity} max={10} />
                        <AvgBar label="课后活动" value={stats.avgAfterClass} max={10} />
                        <AvgBar label="平时(百分制)" value={stats.avgUsual} max={100} />
                        <AvgBar label="期中" value={stats.avgMidterm} max={100} />
                        {config.calculateTotal && <AvgBar label="总评" value={stats.avgTotal} max={100} highlight />}
                      </div>
                    </div>
                    {config.calculateGrade && (
                      <>
                        <Separator />
                        <div className="space-y-2">
                          <p className="text-xs font-medium text-muted-foreground">等级分布</p>
                          <div className="grid grid-cols-5 gap-1">
                            <GradeBox label="优" value={stats.gradeDist.excellent} color="bg-emerald-500" />
                            <GradeBox label="良" value={stats.gradeDist.good} color="bg-teal-500" />
                            <GradeBox label="中" value={stats.gradeDist.medium} color="bg-cyan-500" />
                            <GradeBox label="及格" value={stats.gradeDist.pass} color="bg-amber-500" />
                            <GradeBox label="不及格" value={stats.gradeDist.fail} color="bg-red-500" />
                          </div>
                        </div>
                      </>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            {/* 导出 */}
            {step4Done && (
              <Card className="border-emerald-300 bg-emerald-50/30 dark:bg-emerald-950/10">
                <CardContent className="pt-6 space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-emerald-800 dark:text-emerald-300">
                    <CheckCircle2 className="h-5 w-5" />
                    已生成 {records.length} 条记录
                  </div>
                  {/* 文件名编辑 */}
                  <div className="space-y-1.5">
                    <Label htmlFor="export-name" className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5" />
                      导出文件名
                      {!fileNameTouched && (
                        <span className="text-[10px] text-emerald-600">(随课程名自动生成)</span>
                      )}
                    </Label>
                    <div className="relative">
                      <Input
                        id="export-name"
                        type="text"
                        value={fileNameTouched ? exportFileName : effectiveFileName}
                        placeholder="请输入文件名"
                        onChange={(e) => handleFileNameChange(e.target.value)}
                        className="h-9 pr-10"
                      />
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-medium text-emerald-700 dark:text-emerald-400 pointer-events-none">
                        .xlsx
                      </span>
                    </div>
                    {fileNameTouched && !exportFileName.trim() && (
                      <p className="text-[10px] text-amber-600">文件名不能为空，将使用默认名称</p>
                    )}
                  </div>
                  <Button
                    onClick={handleExport}
                    disabled={exporting}
                    className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white"
                    size="lg"
                  >
                    {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                    导出成绩明细表
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Step 4: 预览 */}
        {step4Done && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <StepBadge number={4} done={step4Done} />
                预览与手动调整
              </CardTitle>
              <CardDescription>
                可直接修改出勤、课堂参与、笔记、随堂考、作业1-4各项小分（整数），平时总分与总评成绩自动重算
              </CardDescription>
            </CardHeader>
            <CardContent>
              {stats.notFound > 0 && (
                <Alert variant="destructive" className="mb-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>有 {stats.notFound} 名学生在母表中未找到</AlertTitle>
                  <AlertDescription>
                    请检查学号是否一致（已自动忽略前导零差异）。未匹配学生的成绩显示为空。
                  </AlertDescription>
                </Alert>
              )}
              {stats.nameMismatch > 0 && (
                <Alert className="mb-4 border-amber-300 bg-amber-50/50 text-amber-900 dark:bg-amber-950/20">
                  <AlertCircle className="h-4 w-4 text-amber-600" />
                  <AlertTitle>有 {stats.nameMismatch} 名学生姓名不一致</AlertTitle>
                  <AlertDescription>
                    学号匹配但姓名不同，已使用母表成绩计算。请核对是否存在同名异人或录入错误。
                  </AlertDescription>
                </Alert>
              )}
              <PreviewTable
                records={records}
                config={config}
                onUpdateRecord={(index, record) => {
                  setRecords((prev) => {
                    const next = [...prev];
                    next[index] = record;
                    return next;
                  });
                }}
              />
              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <span className="inline-block w-3 h-3 rounded bg-red-200 dark:bg-red-900/40" />
                  未找到学号
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block w-3 h-3 rounded bg-amber-200 dark:bg-amber-900/40" />
                  姓名不一致
                </span>
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                  匹配成功
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 空状态 */}
        {!step1Done && (
          <Card className="border-dashed">
            <CardContent className="pt-6 flex flex-col items-center text-center py-12">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950/30 mb-4">
                <FileSpreadsheet className="h-8 w-8 text-emerald-600" />
              </div>
              <h3 className="text-lg font-semibold mb-2">开始使用</h3>
              <p className="text-sm text-muted-foreground max-w-md mb-4">
                上传含「综合成绩」工作表的母表Excel文件，系统自动按学号检索并折算平时小分到出勤·课堂活动·课后活动
              </p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => handleDownloadSample("master")}>
                  <Download className="h-4 w-4" />
                  下载母表模板
                </Button>
                <Button variant="ghost" onClick={() => handleDownloadSample("sub")}>
                  <Download className="h-4 w-4" />
                  下载子表模板
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-border/60 bg-background/50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
            <p>平时成绩小分自动计算工具 · 签到→出勤 · 课程积分+作业→课堂活动&课后活动</p>
            <p className="flex items-center gap-1">
              <Sparkles className="h-3 w-3 text-emerald-500" />
              所有解析在浏览器本地完成，数据不上传服务器
            </p>
          </div>
        </div>
      </footer>

      {/* 浮动按钮：下载最新源码 zip（含 Cloudflare 适配），用于本地推送到 GitHub */}
      <a
        href="/api/repo-download?XTransformPort=3000"
        className="fixed bottom-6 right-6 z-40 inline-flex items-center gap-2 rounded-full bg-gradient-to-br from-emerald-600 to-teal-600 px-4 py-3 text-sm font-medium text-white shadow-lg shadow-emerald-600/30 transition hover:scale-105 hover:shadow-emerald-600/50 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
        title="下载最新源码（含 Cloudflare 适配），解压后推送到 GitHub"
      >
        <Github className="h-4 w-4" />
        <span className="hidden sm:inline">下载新版源码（含 Cloudflare 适配）</span>
        <span className="sm:hidden">新版源码</span>
      </a>
    </div>
  );
}

// ===== 辅助组件 =====
function StepIndicator({ step, label, done, active }: { step: number; label: string; done: boolean; active: boolean }) {
  return (
    <div className="flex items-center gap-2 shrink-0">
      <StepBadge number={step} done={done} active={active} />
      <span className={`text-sm font-medium whitespace-nowrap ${done ? "text-emerald-700 dark:text-emerald-400" : active ? "text-foreground" : "text-muted-foreground"}`}>
        {label}
      </span>
    </div>
  );
}

function StepBadge({ number, done, active }: { number: number; done?: boolean; active?: boolean }) {
  if (done) {
    return (
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-white text-xs font-bold">
        <CheckCircle2 className="h-4 w-4" />
      </span>
    );
  }
  return (
    <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${active ? "bg-emerald-600 text-white" : "bg-muted text-muted-foreground"}`}>
      {number}
    </span>
  );
}

function WeightInput({ label, value, onChange, disabled, isPercent }: { label: string; value: number; onChange: (v: number) => void; disabled?: boolean; isPercent?: boolean }) {
  const displayValue = isPercent ? Math.round(value * 100) : Math.round(value * 100) / 100;
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="relative">
        <Input
          type="number"
          min={0}
          max={isPercent ? 100 : 1}
          step={isPercent ? 1 : 0.05}
          value={displayValue}
          disabled={disabled}
          onChange={(e) => {
            const v = parseFloat(e.target.value);
            onChange(isNaN(v) ? 0 : isPercent ? v / 100 : v);
          }}
          className="h-9 pr-7"
        />
        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
          {isPercent ? "%" : ""}
        </span>
      </div>
    </div>
  );
}

function WeightBar({ usual, midterm, final }: { usual: number; midterm: number; final: number }) {
  const total = usual + midterm + final;
  const valid = Math.abs(total - 1) < 0.01;
  return (
    <div className="space-y-1">
      <div className="flex h-2 rounded-full overflow-hidden bg-muted">
        <div className="bg-emerald-500 transition-all" style={{ width: `${(usual / total) * 100}%` }} />
        <div className="bg-teal-400 transition-all" style={{ width: `${(midterm / total) * 100}%` }} />
        <div className="bg-cyan-400 transition-all" style={{ width: `${(final / total) * 100}%` }} />
      </div>
      <p className={`text-xs ${valid ? "text-muted-foreground" : "text-amber-600"}`}>
        总和: {Math.round(total * 100)}% {valid ? "" : "(应为100%)"}
      </p>
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: number; accent: "neutral" | "green" | "amber" | "red" }) {
  const colors = {
    neutral: "bg-muted/50 text-foreground",
    green: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400",
    amber: "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400",
    red: "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400",
  };
  return (
    <div className={`rounded-lg p-3 ${colors[accent]}`}>
      <p className="text-2xl font-bold tabular-nums">{value}</p>
      <p className="text-xs opacity-80">{label}</p>
    </div>
  );
}

function AvgBar({ label, value, max, highlight }: { label: string; value: number; max: number; highlight?: boolean }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground w-16 shrink-0">{label}</span>
      <div className="flex-1 h-5 rounded-full bg-muted overflow-hidden relative">
        <div className={`h-full rounded-full transition-all ${highlight ? "bg-gradient-to-r from-emerald-500 to-teal-500" : "bg-emerald-400"}`} style={{ width: `${pct}%` }} />
        <span className="absolute inset-0 flex items-center justify-end pr-2 text-xs font-medium">
          {value}
          <span className="text-muted-foreground ml-0.5">/{max}</span>
        </span>
      </div>
    </div>
  );
}

function GradeBox({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="text-center rounded p-1.5 bg-muted/50">
      <div className={`mx-auto mb-1 h-1.5 w-8 rounded-full ${color}`} />
      <p className="text-sm font-bold">{value}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}
