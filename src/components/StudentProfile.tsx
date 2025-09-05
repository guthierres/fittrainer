import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  User, 
  Dumbbell, 
  Utensils, 
  Calendar,
  Phone,
  Mail,
  Target,
  Edit,
  Plus,
  X,
  ExternalLink
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import QuickWorkoutCreator from "./QuickWorkoutCreator";
import QuickDietCreator from "./QuickDietCreator";
import WorkoutPlanEditor from "./WorkoutPlanEditor";

interface Student {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  birth_date?: string;
  weight?: number;
  height?: number;
  goals?: string[];
  unique_link_token: string;
  created_at: string;
  medical_restrictions?: string;
}

interface WorkoutPlan {
  id: string;
  name: string;
  active: boolean;
  workout_sessions: WorkoutSession[];
}

interface WorkoutSession {
  id: string;
  name: string;
  day_of_week: number;
  workout_exercises: {
    id: string;
    exercise: {
      name: string;
      category: { name: string; emoji: string; };
    };
    sets: number;
    reps_min?: number;
    reps_max?: number;
    rest_seconds?: number;
  }[];
}

interface DietPlan {
  id: string;
  name: string;
  active: boolean;
  daily_calories?: number;
  daily_protein?: number;
  daily_carbs?: number;
  daily_fat?: number;
  meals: {
    id: string;
    name: string;
    time_of_day?: string;
    meal_foods: {
      id: string;
      food_name: string;
      quantity: number;
      unit: string;
    }[];
  }[];
}

interface StudentProfileProps {
  student: Student;
  trainerId: string;
  onClose: () => void;
}

const DAYS_OF_WEEK = [
  "Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"
];

const StudentProfile = ({ student, trainerId, onClose }: StudentProfileProps) => {
  const [workoutPlans, setWorkoutPlans] = useState<WorkoutPlan[]>([]);
  const [dietPlans, setDietPlans] = useState<DietPlan[]>([]);
  const [selectedWorkoutPlan, setSelectedWorkoutPlan] = useState<WorkoutPlan | null>(null);
  const [selectedDietPlan, setSelectedDietPlan] = useState<DietPlan | null>(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [showWorkoutCreator, setShowWorkoutCreator] = useState(false);
  const [showDietCreator, setShowDietCreator] = useState(false);
  const [showWorkoutEditor, setShowWorkoutEditor] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadStudentData();
  }, [student.id]);

  const loadStudentData = async () => {
    try {
      setIsLoading(true);
      
      // Load workout plans
      const { data: workouts, error: workoutError } = await supabase
        .from("workout_plans")
        .select(`
          id,
          name,
          active,
          workout_sessions(
            id,
            name,
            day_of_week,
            workout_exercises(
              id,
              sets,
              reps_min,
              reps_max,
              rest_seconds,
              exercise:exercises(
                name,
                category:exercise_categories(name, emoji)
              )
            )
          )
        `)
        .eq("student_id", student.id)
        .order("created_at", { ascending: false });

      if (!workoutError && workouts) {
        setWorkoutPlans(workouts);
      }

      // Load diet plans
      const { data: diets, error: dietError } = await supabase
        .from("diet_plans")
        .select(`
          id,
          name,
          active,
          daily_calories,
          daily_protein,
          daily_carbs,
          daily_fat,
          meals(
            id,
            name,
            time_of_day,
            meal_foods(
              id,
              food_name,
              quantity,
              unit
            )
          )
        `)
        .eq("student_id", student.id)
        .order("created_at", { ascending: false });

      if (!dietError && diets) {
        setDietPlans(diets);
      }

    } catch (error) {
      console.error("Error loading student data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const calculateAge = (birthDate: string) => {
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    
    return age;
  };

  const copyStudentLink = () => {
    const link = `${window.location.origin}/student/${student.unique_link_token}`;
    navigator.clipboard.writeText(link);
    toast({
      title: "Link copiado!",
      description: "O link do aluno foi copiado para a área de transferência.",
    });
  };

  const toggleWorkoutStatus = async (workoutId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from("workout_plans")
        .update({ active: !currentStatus })
        .eq("id", workoutId);

      if (!error) {
        toast({
          title: "Status atualizado",
          description: `Treino ${!currentStatus ? 'ativado' : 'desativado'} com sucesso.`,
        });
        loadStudentData();
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao atualizar status do treino.",
        variant: "destructive",
      });
    }
  };

  const toggleDietStatus = async (dietId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from("diet_plans")
        .update({ active: !currentStatus })
        .eq("id", dietId);

      if (!error) {
        toast({
          title: "Status atualizado",
          description: `Dieta ${!currentStatus ? 'ativada' : 'desativada'} com sucesso.`,
        });
        loadStudentData();
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao atualizar status da dieta.",
        variant: "destructive",
      });
    }
  };

  const handleWorkoutSuccess = () => {
    setShowWorkoutCreator(false);
    setShowWorkoutEditor(false);
    setSelectedWorkoutPlan(null);
    loadStudentData();
  };

  const handleDietSuccess = () => {
    setShowDietCreator(false);
    loadStudentData();
  };

  return (
    <div className="max-w-6xl mx-auto">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-primary text-primary-foreground rounded-full w-12 h-12 flex items-center justify-center">
                <User className="h-6 w-6" />
              </div>
              <div>
                <CardTitle className="text-xl">{student.name}</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Prontuário Completo do Aluno
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2 lg:grid-cols-4 h-auto">
              <TabsTrigger value="overview" className="text-xs lg:text-sm py-2">
                Visão Geral
              </TabsTrigger>
              <TabsTrigger value="workouts" className="text-xs lg:text-sm py-2">
                <span className="hidden sm:inline">Treinos ({workoutPlans.length})</span>
                <span className="sm:hidden">Treinos</span>
              </TabsTrigger>
              <TabsTrigger value="diets" className="text-xs lg:text-sm py-2">
                <span className="hidden sm:inline">Dietas ({dietPlans.length})</span>
                <span className="sm:hidden">Dietas</span>
              </TabsTrigger>
              <TabsTrigger value="link" className="text-xs lg:text-sm py-2">
                <span className="hidden sm:inline">Link do Aluno</span>
                <span className="sm:hidden">Link</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              {/* Personal Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5" />
                    Informações Pessoais
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4">
                  {student.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{student.email}</span>
                    </div>
                  )}
                  
                  {student.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{student.phone}</span>
                    </div>
                  )}
                  
                  {student.birth_date && (
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{calculateAge(student.birth_date)} anos</span>
                    </div>
                  )}
                  
                  {student.weight && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">Peso:</span>
                      <span className="ml-1 font-medium">{student.weight}kg</span>
                    </div>
                  )}
                  
                  {student.height && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">Altura:</span>
                      <span className="ml-1 font-medium">{student.height}m</span>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Goals */}
              {student.goals && student.goals.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Target className="h-5 w-5" />
                      Objetivos
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {student.goals.map((goal, index) => (
                        <Badge key={index} variant="secondary">
                          {goal}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Medical Restrictions */}
              {student.medical_restrictions && (
                <Card>
                  <CardHeader>
                    <CardTitle>Restrições Médicas</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm">{student.medical_restrictions}</p>
                  </CardContent>
                </Card>
              )}

              {/* Quick Stats */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 lg:gap-4">
                <Card>
                  <CardContent className="text-center p-4">
                    <Dumbbell className="h-8 w-8 text-primary mx-auto mb-2" />
                    <p className="text-2xl font-bold">{workoutPlans.filter(w => w.active).length}</p>
                    <p className="text-sm text-muted-foreground">Treinos Ativos</p>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="text-center p-4">
                    <Utensils className="h-8 w-8 text-success mx-auto mb-2" />
                    <p className="text-2xl font-bold">{dietPlans.filter(d => d.active).length}</p>
                    <p className="text-sm text-muted-foreground">Dietas Ativas</p>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="text-center p-4">
                    <Calendar className="h-8 w-8 text-secondary mx-auto mb-2" />
                    <p className="text-2xl font-bold">
                      {Math.ceil((new Date().getTime() - new Date(student.created_at).getTime()) / (1000 * 60 * 60 * 24))}
                    </p>
                    <p className="text-sm text-muted-foreground">Dias como Aluno</p>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="workouts" className="space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <h3 className="text-lg font-semibold">Planos de Treino</h3>
                <Button onClick={() => setShowWorkoutCreator(true)} className="w-full sm:w-auto">
                  <Plus className="h-4 w-4 mr-2" />
                  Novo Treino
                </Button>
              </div>
              
              {workoutPlans.length === 0 ? (
                <Card>
                  <CardContent className="text-center py-8">
                    <Dumbbell className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                    <p className="text-muted-foreground">Nenhum treino cadastrado</p>
                    <p className="text-sm text-muted-foreground">
                      Clique em "Novo Treino" para começar
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {workoutPlans.map((workout) => (
                    <Card key={workout.id} className={workout.active ? "border-primary/50" : "border-muted"}>
                      <CardHeader>
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                            <CardTitle className="text-base lg:text-lg">{workout.name}</CardTitle>
                            <Badge variant={workout.active ? "default" : "secondary"} className="w-fit">
                              {workout.active ? "Ativo" : "Inativo"}
                            </Badge>
                          </div>
                          <div className="flex flex-col sm:flex-row gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full sm:w-auto"
                              onClick={() => {
                                setSelectedWorkoutPlan(workout);
                                setShowWorkoutEditor(true);
                              }}
                            >
                              <Edit className="h-4 w-4 mr-2" />
                              <span className="hidden sm:inline">Editar</span>
                              <span className="sm:hidden">Editar Treino</span>
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full sm:w-auto"
                              onClick={() => toggleWorkoutStatus(workout.id, workout.active)}
                            >
                              {workout.active ? "Desativar" : "Ativar"}
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="grid gap-2">
                          <p className="text-sm text-muted-foreground">
                            {workout.workout_sessions.length} sessões de treino
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {workout.workout_sessions.map((session) => (
                              <Badge key={session.id} variant="outline" className="text-xs">
                                {DAYS_OF_WEEK[session.day_of_week]}: {session.workout_exercises.length} exercícios
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="diets" className="space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <h3 className="text-lg font-semibold">Planos Alimentares</h3>
                <Button onClick={() => setShowDietCreator(true)} className="w-full sm:w-auto">
                  <Plus className="h-4 w-4 mr-2" />
                  Nova Dieta
                </Button>
              </div>
              
              {dietPlans.length === 0 ? (
                <Card>
                  <CardContent className="text-center py-8">
                    <Utensils className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                    <p className="text-muted-foreground">Nenhuma dieta cadastrada</p>
                    <p className="text-sm text-muted-foreground">
                      Clique em "Nova Dieta" para começar
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {dietPlans.map((diet) => (
                    <Card key={diet.id} className={diet.active ? "border-success/50" : "border-muted"}>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <CardTitle className="text-lg">{diet.name}</CardTitle>
                            <Badge variant={diet.active ? "default" : "secondary"}>
                              {diet.active ? "Ativo" : "Inativo"}
                            </Badge>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => toggleDietStatus(diet.id, diet.active)}
                          >
                            {diet.active ? "Desativar" : "Ativar"}
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
                          {diet.daily_calories && (
                            <div className="text-center">
                              <p className="text-lg font-bold text-primary">{diet.daily_calories}</p>
                              <p className="text-xs text-muted-foreground">kcal/dia</p>
                            </div>
                          )}
                          {diet.daily_protein && (
                            <div className="text-center">
                              <p className="text-lg font-bold text-secondary">{diet.daily_protein}g</p>
                              <p className="text-xs text-muted-foreground">Proteínas</p>
                            </div>
                          )}
                          {diet.daily_carbs && (
                            <div className="text-center">
                              <p className="text-lg font-bold text-warning">{diet.daily_carbs}g</p>
                              <p className="text-xs text-muted-foreground">Carboidratos</p>
                            </div>
                          )}
                          {diet.daily_fat && (
                            <div className="text-center">
                              <p className="text-lg font-bold text-destructive">{diet.daily_fat}g</p>
                              <p className="text-xs text-muted-foreground">Gorduras</p>
                            </div>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-2">
                          {diet.meals.length} refeições cadastradas
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="link" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ExternalLink className="h-5 w-5" />
                    Link de Acesso do Aluno
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Compartilhe este link com o aluno para que ele possa acessar seus treinos e dietas:
                  </p>
                  
                  <div className="flex flex-col sm:flex-row gap-2">
                    <div className="flex-1 p-3 bg-muted rounded-lg">
                      <code className="text-xs sm:text-sm break-all">
                        {`${window.location.origin}/student/${student.unique_link_token}`}
                      </code>
                    </div>
                    <Button onClick={copyStudentLink} className="w-full sm:w-auto">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Copiar
                    </Button>
                  </div>
                  
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <h4 className="font-medium mb-2">Como usar:</h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• O aluno pode acessar este link de qualquer dispositivo</li>
                      <li>• Não é necessário criar conta ou fazer login</li>
                      <li>• O link permanece válido enquanto o aluno estiver ativo</li>
                      <li>• O aluno pode marcar exercícios e refeições como concluídas</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Dialogs */}
      <Dialog open={showWorkoutCreator} onOpenChange={setShowWorkoutCreator}>
        <DialogContent className="w-[95vw] max-w-5xl h-[90vh] max-h-[90vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-lg sm:text-xl">Criar Novo Treino</DialogTitle>
          </DialogHeader>
          <QuickWorkoutCreator
            studentId={student.id}
            studentName={student.name}
            trainerId={trainerId}
            onClose={() => setShowWorkoutCreator(false)}
            onSuccess={handleWorkoutSuccess}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={showDietCreator} onOpenChange={setShowDietCreator}>
        <DialogContent className="w-[95vw] max-w-6xl h-[90vh] max-h-[90vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-lg sm:text-xl">Criar Nova Dieta</DialogTitle>
          </DialogHeader>
          <QuickDietCreator
            studentId={student.id}
            studentName={student.name}
            trainerId={trainerId}
            onClose={() => setShowDietCreator(false)}
            onSuccess={handleDietSuccess}
          />
        </DialogContent>
      </Dialog>

      {/* Workout Editor Dialog */}
      {selectedWorkoutPlan && (
        <WorkoutPlanEditor
          workoutPlan={selectedWorkoutPlan}
          studentId={student.id}
          trainerId={trainerId}
          isOpen={showWorkoutEditor}
          onClose={() => {
            setShowWorkoutEditor(false);
            setSelectedWorkoutPlan(null);
          }}
          onSuccess={handleWorkoutSuccess}
        />
      )}
    </div>
  );
};

export default StudentProfile;