import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { 
  Users, 
  Dumbbell, 
  LogOut, 
  Plus,
  Activity,
  Target,
  Calendar,
  TrendingUp
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import StudentList from "@/components/StudentList";
import CreateStudent from "@/components/CreateStudent";
import StudentTestCreator from "@/components/StudentTestCreator";
import WorkoutManager from "@/components/WorkoutManager";
import DietManager from "@/components/DietManager";
import ReportsManager from "@/components/ReportsManager";
import ExerciseManager from "@/components/ExerciseManager";

interface PersonalTrainer {
  id: string;
  name: string;
  cpf: string;
  email?: string;
  phone?: string;
  cref?: string;
  specializations?: string[];
}

interface DashboardStats {
  totalStudents: number;
  activeWorkouts: number;
  activeDiets: number;
  completedExercisesToday: number;
}

const Dashboard = () => {
  const [trainer, setTrainer] = useState<PersonalTrainer | null>(null);
  const [stats, setStats] = useState<DashboardStats>({
    totalStudents: 0,
    activeWorkouts: 0,
    activeDiets: 0,
    completedExercisesToday: 0
  });
  const [showCreateStudent, setShowCreateStudent] = useState(false);
  const [showTestCreator, setShowTestCreator] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const trainerData = localStorage.getItem("trainer");
    if (!trainerData) {
      navigate("/login");
      return;
    }
    
    const parsedTrainer = JSON.parse(trainerData);
    setTrainer(parsedTrainer);
    loadStats(parsedTrainer.id);
  }, [navigate]);

  const loadStats = async (trainerId: string) => {
    try {
      // Get total students
      const { data: students, error: studentsError } = await supabase
        .from("students")
        .select("id")
        .eq("personal_trainer_id", trainerId)
        .eq("active", true);

      // Get active workout plans
      const { data: workouts, error: workoutsError } = await supabase
        .from("workout_plans")
        .select("id")
        .eq("personal_trainer_id", trainerId)
        .eq("active", true);

      // Get active diet plans
      const { data: diets, error: dietsError } = await supabase
        .from("diet_plans")
        .select("id")
        .eq("personal_trainer_id", trainerId)
        .eq("active", true);

      // Get today's completed exercises
      const today = new Date().toISOString().split('T')[0];
      const { data: completions, error: completionsError } = await supabase
        .from("exercise_completions")
        .select("id, workout_exercise_id(workout_session_id(workout_plan_id(personal_trainer_id)))")
        .gte("completed_at", `${today}T00:00:00`)
        .lt("completed_at", `${today}T23:59:59`);

      if (!studentsError && !workoutsError && !dietsError && !completionsError) {
        setStats({
          totalStudents: students?.length || 0,
          activeWorkouts: workouts?.length || 0,
          activeDiets: diets?.length || 0,
          completedExercisesToday: completions?.length || 0
        });
      }
    } catch (error) {
      console.error("Error loading stats:", error);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("trainer");
    toast({
      title: "Logout realizado",
      description: "Você foi desconectado com sucesso.",
    });
    navigate("/login");
  };

  if (!trainer) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Dumbbell className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-2xl font-bold text-primary">FitTrainer-Pro</h1>
              <p className="text-sm text-muted-foreground">
                Olá, {trainer.name}
              </p>
            </div>
          </div>
          <Button variant="outline" onClick={handleLogout} size="sm">
            <LogOut className="h-4 w-4 mr-2" />
            Sair
          </Button>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="flex items-center p-4">
              <Users className="h-8 w-8 text-primary mr-3" />
              <div>
                <p className="text-2xl font-bold">{stats.totalStudents}</p>
                <p className="text-sm text-muted-foreground">Alunos Ativos</p>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="flex items-center p-4">
              <Dumbbell className="h-8 w-8 text-secondary mr-3" />
              <div>
                <p className="text-2xl font-bold">{stats.activeWorkouts}</p>
                <p className="text-sm text-muted-foreground">Treinos Ativos</p>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="flex items-center p-4">
              <Target className="h-8 w-8 text-success mr-3" />
              <div>
                <p className="text-2xl font-bold">{stats.activeDiets}</p>
                <p className="text-sm text-muted-foreground">Dietas Ativas</p>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="flex items-center p-4">
              <TrendingUp className="h-8 w-8 text-warning mr-3" />
              <div>
                <p className="text-2xl font-bold">{stats.completedExercisesToday}</p>
                <p className="text-sm text-muted-foreground">Exercícios Hoje</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="students" className="space-y-4">
          <TabsList className="grid grid-cols-5 w-full max-w-3xl">
            <TabsTrigger value="students">Alunos</TabsTrigger>
            <TabsTrigger value="exercises">Exercícios</TabsTrigger>
            <TabsTrigger value="workouts">Treinos</TabsTrigger>
            <TabsTrigger value="diets">Dietas</TabsTrigger>
            <TabsTrigger value="reports">Relatórios</TabsTrigger>
          </TabsList>

          <TabsContent value="students" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold">Gerenciar Alunos</h2>
              <div className="flex gap-2">
                <Button onClick={() => setShowTestCreator(true)} variant="outline">
                  Teste Debug
                </Button>
                <Button onClick={() => setShowCreateStudent(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Novo Aluno
                </Button>
              </div>
            </div>
            
            {showCreateStudent ? (
              <CreateStudent
                trainerId={trainer.id}
                onClose={() => setShowCreateStudent(false)}
                onSuccess={() => {
                  setShowCreateStudent(false);
                  loadStats(trainer.id);
                }}
              />
            ) : showTestCreator ? (
              <StudentTestCreator
                trainerId={trainer.id}
                onClose={() => setShowTestCreator(false)}
                onSuccess={() => {
                  setShowTestCreator(false);
                  loadStats(trainer.id);
                }}
              />
            ) : (
              <StudentList trainerId={trainer.id} />
            )}
          </TabsContent>

          <TabsContent value="exercises" className="space-y-4">
            <ExerciseManager trainerId={trainer.id} />
          </TabsContent>

          <TabsContent value="workouts" className="space-y-4">
            <WorkoutManager trainerId={trainer.id} />
          </TabsContent>

          <TabsContent value="diets" className="space-y-4">
            <DietManager trainerId={trainer.id} />
          </TabsContent>

          <TabsContent value="reports" className="space-y-4">
            <ReportsManager trainerId={trainer.id} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Dashboard;