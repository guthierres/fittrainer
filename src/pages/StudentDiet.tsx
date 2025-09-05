import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Apple, 
  CheckCircle,
  Clock,
  Target,
  User,
  Download,
  Utensils
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Student {
  id: string;
  name: string;
  unique_link_token: string;
  personal_trainer_id: string;
}

interface MealFood {
  id: string;
  food_name: string;
  quantity: number;
  unit: string;
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  notes?: string;
}

interface Meal {
  id: string;
  name: string;
  time_of_day?: string;
  order_index: number;
  meal_foods: MealFood[];
  isCompleted?: boolean;
}

interface DietPlan {
  id: string;
  name: string;
  description?: string;
  daily_calories?: number;
  daily_protein?: number;
  daily_carbs?: number;
  daily_fat?: number;
  meals: Meal[];
  personal_trainer: {
    name: string;
    cref?: string;
  };
}

const StudentDiet = () => {
  const { token } = useParams<{ token: string }>();
  const [student, setStudent] = useState<Student | null>(null);
  const [dietPlan, setDietPlan] = useState<DietPlan | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    if (token) {
      loadStudentDietData();
    }
  }, [token]);

  const loadStudentDietData = async () => {
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

      // Get active diet plan with meals and foods
      const { data: dietData, error: dietError } = await supabase
        .from("diet_plans")
        .select(`
          id,
          name,
          description,
          daily_calories,
          daily_protein,
          daily_carbs,
          daily_fat,
          personal_trainer:personal_trainers!inner(name, cref),
          meals!inner(
            id,
            name,
            time_of_day,
            order_index,
            meal_foods!inner(
              id,
              food_name,
              quantity,
              unit,
              calories,
              protein,
              carbs,
              fat,
              notes
            )
          )
        `)
        .eq("student_id", studentData.id)
        .eq("active", true)
        .order("order_index", { foreignTable: "meals" })
        .single();

      if (dietError || !dietData) {
        toast({
          title: "Aviso",
          description: "Nenhuma dieta ativa encontrada.",
        });
        return;
      }

      // Check completed meals for today
      const today = new Date().toISOString().split('T')[0];
      const { data: completions } = await supabase
        .from("meal_completions")
        .select("meal_id")
        .eq("student_id", studentData.id)
        .gte("completed_at", `${today}T00:00:00`)
        .lt("completed_at", `${today}T23:59:59`);

      const completedMealIds = new Set(
        completions?.map(c => c.meal_id) || []
      );

      // Mark meals as completed
      dietData.meals.forEach((meal: any) => {
        meal.isCompleted = completedMealIds.has(meal.id);
      });

      setDietPlan(dietData as any);

    } catch (error) {
      console.error("Error loading student diet data:", error);
      toast({
        title: "Erro",
        description: "Erro ao carregar dados da dieta.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const markMealAsCompleted = async (mealId: string) => {
    if (!student) return;

    try {
      const { error } = await supabase
        .from("meal_completions")
        .insert({
          meal_id: mealId,
          student_id: student.id,
        });

      if (error) {
        toast({
          title: "Erro",
          description: "Não foi possível marcar a refeição como realizada.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Parabéns! 🍽️",
        description: "Refeição marcada como realizada!",
      });

      // Reload data to update completion status
      loadStudentDietData();
    } catch (error) {
      console.error("Error marking meal as completed:", error);
    }
  };

  const calculateMealTotals = (meal: Meal) => {
    return meal.meal_foods.reduce(
      (totals, food) => ({
        calories: totals.calories + (food.calories || 0),
        protein: totals.protein + (food.protein || 0),
        carbs: totals.carbs + (food.carbs || 0),
        fat: totals.fat + (food.fat || 0),
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );
  };

  const exportDiet = () => {
    if (!dietPlan || !student) return;

    const content = `
═══════════════════════════════════════
        COMPROVANTE DE DIETA
═══════════════════════════════════════

Personal Trainer: ${dietPlan.personal_trainer.name}
${dietPlan.personal_trainer.cref ? `CREF: ${dietPlan.personal_trainer.cref}` : ''}

Aluno: ${student.name}
ID do Aluno: ${student.id}

Plano Alimentar: ${dietPlan.name}
Data: ${new Date().toLocaleDateString('pt-BR')}

${dietPlan.description ? `Descrição: ${dietPlan.description}` : ''}

VALORES DIÁRIOS:
${dietPlan.daily_calories ? `• Calorias: ${dietPlan.daily_calories} kcal` : ''}
${dietPlan.daily_protein ? `• Proteínas: ${dietPlan.daily_protein}g` : ''}
${dietPlan.daily_carbs ? `• Carboidratos: ${dietPlan.daily_carbs}g` : ''}
${dietPlan.daily_fat ? `• Gorduras: ${dietPlan.daily_fat}g` : ''}

REFEIÇÕES:
${dietPlan.meals.map((meal, index) => {
  const totals = calculateMealTotals(meal);
  return `
${index + 1}. ${meal.name} ${meal.time_of_day ? `(${meal.time_of_day})` : ''}
   Status: ${meal.isCompleted ? '✅ REALIZADA' : '⏳ PENDENTE'}
   
   Alimentos:
${meal.meal_foods.map(food => `   • ${food.food_name}: ${food.quantity}${food.unit}${food.calories ? ` (${food.calories} kcal)` : ''}`).join('\n')}
   
   Totais da refeição:
   • Calorias: ${totals.calories.toFixed(1)} kcal
   • Proteínas: ${totals.protein.toFixed(1)}g
   • Carboidratos: ${totals.carbs.toFixed(1)}g
   • Gorduras: ${totals.fat.toFixed(1)}g
`;
}).join('\n')}

════════════════════════════════════════

Sistema: FitTrainer-Pro
Link do aluno: ${window.location.origin}/student/${token}

Gerado em: ${new Date().toLocaleString('pt-BR')}
`;

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dieta-${student.name}-${new Date().toLocaleDateString('pt-BR')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Apple className="h-12 w-12 text-primary mx-auto mb-4 animate-pulse" />
          <p>Carregando sua dieta...</p>
        </div>
      </div>
    );
  }

  if (!student || !dietPlan) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="text-center p-6">
            <p className="text-muted-foreground">
              Nenhuma dieta encontrada ou link inválido.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Apple className="h-8 w-8 text-primary" />
              <div>
                <h1 className="text-2xl font-bold text-primary">FitTrainer-Pro</h1>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <User className="h-4 w-4" />
                  {student.name}
                </div>
              </div>
            </div>
            <Button onClick={exportDiet} variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Exportar
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        {/* Navigation */}
        <div className="flex gap-2 mb-6">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => window.location.pathname = `/student/${token}`}
          >
            🏋️‍♂️ Treinos
          </Button>
          <Button 
            variant="default" 
            size="sm"
            onClick={() => window.location.pathname = `/student/${token}/diet`}
          >
            🍎 Dieta
          </Button>
        </div>
        {/* Diet Plan Info */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              {dietPlan.name}
            </CardTitle>
            {dietPlan.description && (
              <p className="text-muted-foreground">{dietPlan.description}</p>
            )}
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              {dietPlan.daily_calories && (
                <div className="text-center">
                  <p className="text-2xl font-bold text-primary">{dietPlan.daily_calories}</p>
                  <p className="text-muted-foreground">Calorias</p>
                </div>
              )}
              {dietPlan.daily_protein && (
                <div className="text-center">
                  <p className="text-2xl font-bold text-secondary">{dietPlan.daily_protein}g</p>
                  <p className="text-muted-foreground">Proteínas</p>
                </div>
              )}
              {dietPlan.daily_carbs && (
                <div className="text-center">
                  <p className="text-2xl font-bold text-warning">{dietPlan.daily_carbs}g</p>
                  <p className="text-muted-foreground">Carboidratos</p>
                </div>
              )}
              {dietPlan.daily_fat && (
                <div className="text-center">
                  <p className="text-2xl font-bold text-success">{dietPlan.daily_fat}g</p>
                  <p className="text-muted-foreground">Gorduras</p>
                </div>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-4">
              Personal Trainer: <strong>{dietPlan.personal_trainer.name}</strong>
              {dietPlan.personal_trainer.cref && (
                <span> - CREF: {dietPlan.personal_trainer.cref}</span>
              )}
            </p>
          </CardContent>
        </Card>

        {/* Meals */}
        <div className="space-y-4">
          {dietPlan.meals.map((meal, index) => {
            const totals = calculateMealTotals(meal);
            return (
              <Card key={meal.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Utensils className="h-5 w-5 text-secondary" />
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          {meal.name}
                          {meal.time_of_day && (
                            <Badge variant="outline" className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {meal.time_of_day}
                            </Badge>
                          )}
                          {meal.isCompleted && (
                            <Badge className="bg-success text-success-foreground">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Realizada
                            </Badge>
                          )}
                        </CardTitle>
                      </div>
                    </div>
                    
                    {!meal.isCompleted && (
                      <Button
                        onClick={() => markMealAsCompleted(meal.id)}
                        size="sm"
                        className="bg-success hover:bg-success/90 text-success-foreground"
                      >
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Marcar como Feita
                      </Button>
                    )}
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-4">
                  {/* Foods */}
                  <div className="space-y-2">
                    {meal.meal_foods.map((food, foodIndex) => (
                      <div key={food.id} className="flex justify-between items-center">
                        <div className="space-y-1">
                          <p className="font-medium">{food.food_name}</p>
                          <p className="text-sm text-muted-foreground">
                            {food.quantity}{food.unit}
                            {food.calories && ` • ${food.calories} kcal`}
                          </p>
                          {food.notes && (
                            <p className="text-xs text-muted-foreground italic">
                              {food.notes}
                            </p>
                          )}
                        </div>
                        
                        {(food.protein || food.carbs || food.fat) && (
                          <div className="text-xs text-muted-foreground">
                            <div className="grid grid-cols-3 gap-2 text-center">
                              {food.protein && <span>P: {food.protein}g</span>}
                              {food.carbs && <span>C: {food.carbs}g</span>}
                              {food.fat && <span>G: {food.fat}g</span>}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  <Separator />

                  {/* Meal Totals */}
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-sm font-medium mb-2">Totais da Refeição:</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                      <div className="text-center">
                        <span className="text-primary font-bold">{totals.calories.toFixed(0)}</span>
                        <p className="text-xs text-muted-foreground">kcal</p>
                      </div>
                      <div className="text-center">
                        <span className="text-secondary font-bold">{totals.protein.toFixed(1)}g</span>
                        <p className="text-xs text-muted-foreground">Proteína</p>
                      </div>
                      <div className="text-center">
                        <span className="text-warning font-bold">{totals.carbs.toFixed(1)}g</span>
                        <p className="text-xs text-muted-foreground">Carbo</p>
                      </div>
                      <div className="text-center">
                        <span className="text-success font-bold">{totals.fat.toFixed(1)}g</span>
                        <p className="text-xs text-muted-foreground">Gordura</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default StudentDiet;