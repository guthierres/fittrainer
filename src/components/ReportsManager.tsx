import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  BarChart3, 
  Download, 
  TrendingUp,
  Users,
  Activity,
  Target,
  Calendar,
  FileText,
  Printer
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { addDays, format, subDays } from "date-fns";

interface Student {
  id: string;
  name: string;
}

interface ReportData {
  student_name: string;
  student_email?: string;
  student_phone?: string;
  trainer_name: string;
  trainer_cpf: string;
  trainer_cref?: string;
  workout_completions: number;
  diet_completions: number;
  total_exercises: number;
  completed_exercises: number;
  completion_rate: number;
  period_start: string;
  period_end: string;
  report_date: string;
}

const ReportsManager = ({ trainerId }: { trainerId: string }) => {
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<string>("all");
  const [dateRange, setDateRange] = useState({
    from: subDays(new Date(), 30),
    to: new Date(),
  });
  const [reportData, setReportData] = useState<ReportData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadStudents();
  }, [trainerId]);

  const loadStudents = async () => {
    try {
      const { data, error } = await supabase
        .from("students")
        .select("id, name")
        .eq("personal_trainer_id", trainerId)
        .eq("active", true)
        .order("name");

      if (!error && data) {
        setStudents(data);
      }
    } catch (error) {
      console.error("Error loading students:", error);
    }
  };

  const generateReport = async () => {
    if (!dateRange?.from || !dateRange?.to) {
      toast({
        title: "Erro",
        description: "Selecione um período válido para o relatório.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      // Get trainer info
      const { data: trainerData } = await supabase
        .from("personal_trainers")
        .select("name, cpf, cref")
        .eq("id", trainerId)
        .single();

      // Get students data
      let studentsData;
      if (selectedStudent === "all") {
        const { data } = await supabase
          .from("students")
          .select("*")
          .eq("personal_trainer_id", trainerId)
          .eq("active", true);
        studentsData = data;
      } else {
        const { data } = await supabase
          .from("students")
          .select("*")
          .eq("id", selectedStudent);
        studentsData = data;
      }

      const reports: ReportData[] = [];

      for (const student of studentsData || []) {
        // Get exercise completions
        const { data: exerciseCompletions } = await supabase
          .from("exercise_completions")
          .select(`
            *,
            workout_exercise_id!inner(
              workout_session_id!inner(
                workout_plan_id!inner(
                  personal_trainer_id
                )
              )
            )
          `)
          .eq("student_id", student.id)
          .gte("completed_at", dateRange.from.toISOString())
          .lte("completed_at", dateRange.to.toISOString());

        // Get meal completions
        const { data: mealCompletions } = await supabase
          .from("meal_completions")
          .select(`
            *,
            meal_id!inner(
              diet_plan_id!inner(
                personal_trainer_id
              )
            )
          `)
          .eq("student_id", student.id)
          .gte("completed_at", dateRange.from.toISOString())
          .lte("completed_at", dateRange.to.toISOString());

        // Get total exercises assigned to student
        const { data: totalExercises } = await supabase
          .from("workout_exercises")
          .select(`
            *,
            workout_session_id!inner(
              workout_plan_id!inner(
                personal_trainer_id,
                student_id
              )
            )
          `)
          .eq("workout_session_id.workout_plan_id.student_id", student.id)
          .eq("workout_session_id.workout_plan_id.personal_trainer_id", trainerId);

        const completedExercises = exerciseCompletions?.length || 0;
        const totalExercisesCount = totalExercises?.length || 0;
        const completionRate = totalExercisesCount > 0 ? 
          (completedExercises / totalExercisesCount) * 100 : 0;

        reports.push({
          student_name: student.name,
          student_email: student.email,
          student_phone: student.phone,
          trainer_name: trainerData?.name || "",
          trainer_cpf: trainerData?.cpf || "",
          trainer_cref: trainerData?.cref,
          workout_completions: completedExercises,
          diet_completions: mealCompletions?.length || 0,
          total_exercises: totalExercisesCount,
          completed_exercises: completedExercises,
          completion_rate: Math.round(completionRate * 100) / 100,
          period_start: format(dateRange.from, "dd/MM/yyyy"),
          period_end: format(dateRange.to, "dd/MM/yyyy"),
          report_date: format(new Date(), "dd/MM/yyyy 'às' HH:mm")
        });
      }

      setReportData(reports);
      
      toast({
        title: "Relatório gerado",
        description: "Relatório de desempenho gerado com sucesso.",
      });

    } catch (error) {
      console.error("Error generating report:", error);
      toast({
        title: "Erro",
        description: "Erro ao gerar relatório.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const exportToPDF = (report: ReportData) => {
    // Create a detailed bank-like receipt format
    const reportContent = `
      ══════════════════════════════════════════════════════════════
                          FITTRAINER-PRO
                     COMPROVANTE DE DESEMPENHO
      ══════════════════════════════════════════════════════════════
      
      Data de Emissão: ${report.report_date}
      Período do Relatório: ${report.period_start} à ${report.period_end}
      
      ──────────────────────────────────────────────────────────────
                        DADOS DO PERSONAL TRAINER
      ──────────────────────────────────────────────────────────────
      Nome: ${report.trainer_name}
      CPF: ${report.trainer_cpf}
      ${report.trainer_cref ? `CREF: ${report.trainer_cref}` : ''}
      
      ──────────────────────────────────────────────────────────────
                            DADOS DO ALUNO
      ──────────────────────────────────────────────────────────────
      Nome: ${report.student_name}
      ${report.student_email ? `E-mail: ${report.student_email}` : ''}
      ${report.student_phone ? `Telefone: ${report.student_phone}` : ''}
      
      ──────────────────────────────────────────────────────────────
                        RESUMO DE ATIVIDADES
      ──────────────────────────────────────────────────────────────
      Exercícios Realizados: ${report.completed_exercises}
      Total de Exercícios: ${report.total_exercises}
      Taxa de Conclusão: ${report.completion_rate}%
      
      Treinos Completados: ${report.workout_completions}
      Refeições Registradas: ${report.diet_completions}
      
      ──────────────────────────────────────────────────────────────
                          ANÁLISE DE DESEMPENHO
      ──────────────────────────────────────────────────────────────
      ${report.completion_rate >= 80 ? 
        "✓ EXCELENTE - Aluno demonstra alta dedicação e consistência" :
        report.completion_rate >= 60 ?
        "⚠ BOM - Aluno apresenta bom engajamento, pode melhorar" :
        "⚠ ATENÇÃO - Aluno precisa de maior acompanhamento"
      }
      
      Recomendações:
      ${report.completion_rate < 60 ? 
        "• Revisar objetivos e motivação do aluno\n      • Considerar ajustes no plano de treino\n      • Aumentar frequência de acompanhamento" :
        report.completion_rate < 80 ?
        "• Manter motivação atual\n      • Considerar desafios adicionais\n      • Revisar possíveis obstáculos" :
        "• Parabenizar pelo excelente desempenho\n      • Considerar evolução dos exercícios\n      • Manter rotina estabelecida"
      }
      
      ══════════════════════════════════════════════════════════════
      Este documento foi gerado automaticamente pelo sistema
      FitTrainer-Pro em ${new Date().toLocaleString('pt-BR')}
      
      Para dúvidas ou mais informações, entre em contato com
      seu personal trainer.
      ══════════════════════════════════════════════════════════════
    `;

    // Create and download the file
    const blob = new Blob([reportContent], { type: 'text/plain; charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `comprovante-${report.student_name.replace(/\s+/g, '-')}-${format(new Date(), 'yyyy-MM-dd')}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: "Comprovante exportado",
      description: `Comprovante de ${report.student_name} exportado com sucesso.`,
    });
  };

  const exportAllReports = () => {
    const allReportsContent = {
      metadata: {
        generated_at: new Date().toISOString(),
        trainer_id: trainerId,
        period: {
          start: dateRange?.from?.toISOString(),
          end: dateRange?.to?.toISOString()
        },
        total_students: reportData.length
      },
      reports: reportData
    };

    const blob = new Blob([JSON.stringify(allReportsContent, null, 2)], {
      type: 'application/json'
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `relatorio-geral-${format(new Date(), 'yyyy-MM-dd-HHmm')}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Relatórios de Desempenho</h2>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Gerar Relatório
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Data Início</label>
              <Input
                type="date"
                value={dateRange?.from ? format(dateRange.from, "yyyy-MM-dd") : ""}
                onChange={(e) => {
                  const date = new Date(e.target.value);
                  setDateRange({
                    from: date,
                    to: dateRange?.to || addDays(date, 30)
                  });
                }}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Aluno</label>
              <Select value={selectedStudent} onValueChange={setSelectedStudent}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar aluno" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os alunos</SelectItem>
                  {students.map((student) => (
                    <SelectItem key={student.id} value={student.id}>
                      {student.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="flex gap-2">
            <Button onClick={generateReport} disabled={isLoading} className="flex-1">
              {isLoading ? "Gerando..." : "Gerar Relatório"}
            </Button>
            {reportData.length > 0 && (
              <Button variant="outline" onClick={exportAllReports}>
                <Download className="h-4 w-4 mr-2" />
                Exportar Tudo
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Resultados dos Relatórios */}
      {reportData.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">
              Relatórios Gerados ({reportData.length})
            </h3>
          </div>

          <div className="grid gap-4">
            {reportData.map((report, index) => (
              <Card key={index}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5" />
                        Relatório - {report.student_name}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground">
                        Período: {report.period_start} à {report.period_end}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Badge 
                        variant={
                          report.completion_rate >= 80 ? "default" :
                          report.completion_rate >= 60 ? "secondary" : "destructive"
                        }
                      >
                        {report.completion_rate}% Conclusão
                      </Badge>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => exportToPDF(report)}
                      >
                        <Printer className="h-4 w-4 mr-2" />
                        Comprovante
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Activity className="h-4 w-4 text-primary" />
                        <span className="text-sm font-medium">Treinos</span>
                      </div>
                      <div className="text-lg font-bold">
                        {report.completed_exercises}/{report.total_exercises}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Exercícios completados
                      </p>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Target className="h-4 w-4 text-success" />
                        <span className="text-sm font-medium">Dieta</span>
                      </div>
                      <div className="text-lg font-bold">
                        {report.diet_completions}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Refeições registradas
                      </p>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-warning" />
                        <span className="text-sm font-medium">Performance</span>
                      </div>
                      <div className="text-lg font-bold">
                        {report.completion_rate >= 80 ? "Excelente" :
                         report.completion_rate >= 60 ? "Bom" : "Atenção"}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Avaliação geral
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 p-3 bg-muted/50 rounded">
                    <p className="text-sm">
                      <strong>Dados do Aluno:</strong> {report.student_name}
                      {report.student_email && ` • ${report.student_email}`}
                      {report.student_phone && ` • ${report.student_phone}`}
                    </p>
                    <p className="text-sm">
                      <strong>Personal Trainer:</strong> {report.trainer_name} ({report.trainer_cpf})
                      {report.trainer_cref && ` • CREF: ${report.trainer_cref}`}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {reportData.length === 0 && !isLoading && (
        <Card>
          <CardContent className="text-center py-8">
            <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              Configure os filtros e gere relatórios de desempenho dos seus alunos.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ReportsManager;