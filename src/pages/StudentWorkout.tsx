import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Dumbbell, 
  CheckCircle,
  Clock,
  Target,
  User,
  Download
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Student {
  id: string;
  name: string;
  unique_link_token: string;
  personal_trainer_id: string;
}

interface WorkoutExercise {
  id: string;
  exercise: {
    name: string;
    category: {
      name: string;
      emoji: string;
    };
    muscle_groups: string[];
    equipment: string[];
  };
  sets: number;
  reps_min?: number;
  reps_max?: number;
  weight_kg?: number;
  rest_seconds?: number;
  notes?: string;
  isCompleted?: boolean;
}

interface WorkoutSession {
  id: string;
  name: string;
  description?: string;
  day_of_week: number;
  workout_exercises: WorkoutExercise[];
}

interface WorkoutPlan {
  id: string;
  name: string;
  description?: string;
  workout_sessions: WorkoutSession[];
  personal_trainer: {
    name: string;
    cref?: string;
  };
}

const StudentWorkout = () => {
  const { token } = useParams<{ token: string }>();
  const [student, setStudent] = useState<Student | null>(null);
  const [workoutPlan, setWorkoutPlan] = useState<WorkoutPlan | null>(null);
  const [selectedDay, setSelectedDay] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const daysOfWeek = [
    "Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"
  ];

  useEffect(() => {
    if (token) {
      loadStudentData();
    }
  }, [token]);

  const loadStudentData = async () => {
    try {
      setIsLoading(true);

      // Get student by token
      const { data: studentData, error: studentError } = await supabase
        .from("students")
        .select("*")
        .eq("unique_link_token", token)
        .eq("active", true)
        .single();

      if (studentError || !studentData) {
        toast({
          title: "Erro",
          description: "Link inválido ou expirado.",
          variant: "destructive",
        });
        return;
      }

      setStudent(studentData);

      // Get active workout plan with sessions and exercises
      const { data: workoutData, error: workoutError } = await supabase
        .from("workout_plans")
        .select(`
          id,
          name,
          description,
          personal_trainer:personal_trainers!inner(name, cref),
          workout_sessions!inner(
            id,
            name,
            description,
            day_of_week,
            workout_exercises!inner(
              id,
              sets,
              reps_min,
              reps_max,
              weight_kg,
              rest_seconds,
              notes,
              order_index,
              exercise:exercises!inner(
                name,
                muscle_groups,
                equipment,
                category:exercise_categories!inner(name, emoji)
              )
            )
          )
        `)
        .eq("student_id", studentData.id)
        .eq("active", true)
        .order("order_index", { foreignTable: "workout_sessions.workout_exercises" })
        .single();

      if (workoutError || !workoutData) {
        toast({
          title: "Aviso",
          description: "Nenhum treino ativo encontrado.",
        });
        return;
      }

      // Check completed exercises for today
      const today = new Date().toISOString().split('T')[0];
      const { data: completions } = await supabase
        .from("exercise_completions")
        .select("workout_exercise_id")
        .eq("student_id", studentData.id)
        .gte("completed_at", `${today}T00:00:00`)
        .lt("completed_at", `${today}T23:59:59`);

      const completedExerciseIds = new Set(
        completions?.map(c => c.workout_exercise_id) || []
      );

      // Mark exercises as completed
      workoutData.workout_sessions.forEach((session: any) => {
        session.workout_exercises.forEach((exercise: any) => {
          exercise.isCompleted = completedExerciseIds.has(exercise.id);
        });
      });

      setWorkoutPlan(workoutData as any);

    } catch (error) {
      console.error("Error loading student data:", error);
      toast({
        title: "Erro",
        description: "Erro ao carregar dados do treino.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const markExerciseAsCompleted = async (exerciseId: string) => {
    if (!student) return;

    try {
      const { error } = await supabase
        .from("exercise_completions")
        .insert({
          workout_exercise_id: exerciseId,
          student_id: student.id,
        });

      if (error) {
        toast({
          title: "Erro",
          description: "Não foi possível marcar o exercício como realizado.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Parabéns! 🎉",
        description: "Exercício marcado como realizado!",
      });

      // Reload data to update completion status
      loadStudentData();
    } catch (error) {
      console.error("Error marking exercise as completed:", error);
    }
  };

  const exportWorkout = () => {
    if (!workoutPlan || !student) return;

    const currentSession = workoutPlan.workout_sessions.find(
      s => s.day_of_week === selectedDay
    );

    if (!currentSession) return;

    const content = `
═══════════════════════════════════════
        COMPROVANTE DE TREINO
═══════════════════════════════════════

Personal Trainer: ${workoutPlan.personal_trainer.name}
${workoutPlan.personal_trainer.cref ? `CREF: ${workoutPlan.personal_trainer.cref}` : ''}

Aluno: ${student.name}
ID do Aluno: ${student.id}

Treino: ${currentSession.name}
Data: ${new Date().toLocaleDateString('pt-BR')}

EXERCÍCIOS:
${currentSession.workout_exercises.map((exercise, index) => `
${index + 1}. ${exercise.exercise.name}
   Categoria: ${exercise.exercise.category.emoji} ${exercise.exercise.category.name}
   Séries: ${exercise.sets}
   ${exercise.reps_min && exercise.reps_max 
     ? `Repetições: ${exercise.reps_min}-${exercise.reps_max}`
     : exercise.reps_min ? `Repetições: ${exercise.reps_min}` : ''
   }
   ${exercise.weight_kg ? `Peso: ${exercise.weight_kg}kg` : ''}
   ${exercise.rest_seconds ? `Descanso: ${exercise.rest_seconds}s` : ''}
   Status: ${exercise.isCompleted ? '✅ REALIZADO' : '⏳ PENDENTE'}
`).join('\n')}

════════════════════════════════════════

Sistema: FitTrainer-Pro
Link do aluno: ${window.location.origin}/student/${token}

Gerado em: ${new Date().toLocaleString('pt-BR')}
`;

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `treino-${student.name}-${new Date().toLocaleDateString('pt-BR')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Dumbbell className="h-12 w-12 text-primary mx-auto mb-4 animate-pulse" />
          <p>Carregando seu treino...</p>
        </div>
      </div>
    );
  }

  if (!student || !workoutPlan) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="text-center p-6">
            <p className="text-muted-foreground">
              Nenhum treino encontrado ou link inválido.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentSession = workoutPlan.workout_sessions.find(
    s => s.day_of_week === selectedDay
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Dumbbell className="h-8 w-8 text-primary" />
              <div>
                <h1 className="text-2xl font-bold text-primary">FitTrainer-Pro</h1>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <User className="h-4 w-4" />
                  {student.name}
                </div>
              </div>
            </div>
            <Button onClick={exportWorkout} variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Exportar
            </Button>
            <div className="flex gap-2">
              <Button 
                onClick={() => window.location.href = `/student/${token}/diet`}
                variant="secondary" 
                size="sm"
              >
                Ver Dieta
              </Button>
              <Button onClick={exportWorkout} variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Exportar Treino
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        {/* Navigation */}
        <div className="flex gap-2 mb-6">
          <Button 
            variant="default" 
            size="sm"
            onClick={() => window.location.pathname = `/student/${token}`}
          >
            🏋️‍♂️ Treinos
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => window.location.pathname = `/student/${token}/diet`}
          >
            🍎 Dieta
          </Button>
        </div>
        {/* Workout Plan Info */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              {workoutPlan.name}
            </CardTitle>
            {workoutPlan.description && (
              <p className="text-muted-foreground">{workoutPlan.description}</p>
            )}
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Personal Trainer: <strong>{workoutPlan.personal_trainer.name}</strong>
              {workoutPlan.personal_trainer.cref && (
                <span> - CREF: {workoutPlan.personal_trainer.cref}</span>
              )}
            </p>
          </CardContent>
        </Card>

        {/* Day Selector */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Selecionar Dia da Semana</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {daysOfWeek.map((day, index) => {
                const hasWorkout = workoutPlan.workout_sessions.some(
                  s => s.day_of_week === index
                );
                return (
                  <Button
                    key={index}
                    variant={selectedDay === index ? "default" : "outline"}
                    onClick={() => setSelectedDay(index)}
                    disabled={!hasWorkout}
                    size="sm"
                  >
                    {day}
                  </Button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Workout Exercises */}
        {currentSession ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Dumbbell className="h-5 w-5 text-secondary" />
                {currentSession.name}
              </CardTitle>
              {currentSession.description && (
                <p className="text-muted-foreground">{currentSession.description}</p>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {currentSession.workout_exercises.map((exercise, index) => (
                <div key={exercise.id} className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{index + 1}.</span>
                        <h3 className="font-semibold">{exercise.exercise.name}</h3>
                        <Badge variant="secondary">
                          {exercise.exercise.category.emoji} {exercise.exercise.category.name}
                        </Badge>
                        {exercise.isCompleted && (
                          <Badge className="bg-success text-success-foreground">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Realizado
                          </Badge>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                        <div>
                          <span className="text-muted-foreground">Séries:</span>
                          <span className="ml-2 font-medium">{exercise.sets}</span>
                        </div>
                        {(exercise.reps_min || exercise.reps_max) && (
                          <div>
                            <span className="text-muted-foreground">Reps:</span>
                            <span className="ml-2 font-medium">
                              {exercise.reps_min && exercise.reps_max
                                ? `${exercise.reps_min}-${exercise.reps_max}`
                                : exercise.reps_min || exercise.reps_max
                              }
                            </span>
                          </div>
                        )}
                        {exercise.weight_kg && (
                          <div>
                            <span className="text-muted-foreground">Peso:</span>
                            <span className="ml-2 font-medium">{exercise.weight_kg}kg</span>
                          </div>
                        )}
                        {exercise.rest_seconds && (
                          <div className="flex items-center">
                            <Clock className="h-3 w-3 text-muted-foreground mr-1" />
                            <span className="text-muted-foreground">Descanso:</span>
                            <span className="ml-2 font-medium">{exercise.rest_seconds}s</span>
                          </div>
                        )}
                      </div>

                      {exercise.exercise.muscle_groups?.length > 0 && (
                        <div className="text-sm">
                          <span className="text-muted-foreground">Músculos:</span>
                          <span className="ml-2">{exercise.exercise.muscle_groups.join(", ")}</span>
                        </div>
                      )}

                      {exercise.notes && (
                        <div className="text-sm">
                          <span className="text-muted-foreground">Observações:</span>
                          <span className="ml-2">{exercise.notes}</span>
                        </div>
                      )}
                    </div>
                    
                    {!exercise.isCompleted && (
                      <Button
                        onClick={() => markExerciseAsCompleted(exercise.id)}
                        size="sm"
                        className="bg-success hover:bg-success/90 text-success-foreground"
                      >
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Marcar como Feito
                      </Button>
                    )}
                  </div>
                  
                  {index < currentSession.workout_exercises.length - 1 && (
                    <Separator />
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="text-center py-8">
              <p className="text-muted-foreground">
                Nenhum treino programado para {daysOfWeek[selectedDay]}.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default StudentWorkout;