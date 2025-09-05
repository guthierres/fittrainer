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
  Utensils,
  ArrowLeft,
  Printer,
  Calendar,
  TrendingUp,
  Dumbbell
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
  isCompleted?: boolean;
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
          personal_trainer:personal_trainers(name, cref),
          meals(
            id,
            name,
            time_of_day,
            order_index,
            meal_foods(
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
        meal.meal_foods.forEach((food: any) => {
          food.isCompleted = meal.isCompleted;
        });
      });

      setDietPlan(dietData as any);

    } catch (error) {
      console.error("Error loading student data:", error);
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
          description: "Não foi possível marcar a refeição como consumida.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Parabéns! 🎉",
        description: "Refeição marcada como consumida!",
      });

      // Reload data to update completion status
      loadStudentData();
    } catch (error) {
      console.error("Error marking meal as completed:", error);
    }
  };

  const exportDiet = () => {
    if (!dietPlan || !student) return;

    const totalCalories = dietPlan.meals.reduce((total, meal) => 
      total + meal.meal_foods.reduce((mealTotal, food) => 
        mealTotal + (food.calories || 0), 0), 0);

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

OBJETIVOS NUTRICIONAIS DIÁRIOS:
${dietPlan.daily_calories ? `Calorias: ${dietPlan.daily_calories} kcal` : ''}
${dietPlan.daily_protein ? `Proteínas: ${dietPlan.daily_protein}g` : ''}
${dietPlan.daily_carbs ? `Carboidratos: ${dietPlan.daily_carbs}g` : ''}
${dietPlan.daily_fat ? `Gorduras: ${dietPlan.daily_fat}g` : ''}

REFEIÇÕES:
${dietPlan.meals.map((meal, index) => `
${index + 1}. ${meal.name} ${meal.time_of_day ? `(${meal.time_of_day})` : ''}
   Status: ${meal.isCompleted ? '✅ CONSUMIDA' : '⏳ PENDENTE'}
   
   Alimentos:
${meal.meal_foods.map(food => `
   • ${food.food_name} - ${food.quantity}${food.unit}
     ${food.calories ? `Calorias: ${food.calories} kcal` : ''}
     ${food.protein ? `Proteínas: ${food.protein}g` : ''}
     ${food.carbs ? `Carboidratos: ${food.carbs}g` : ''}
     ${food.fat ? `Gorduras: ${food.fat}g` : ''}
     ${food.notes ? `Obs: ${food.notes}` : ''}
`).join('')}
`).join('\n')}

Total Calculado do Dia: ${totalCalories} kcal

════════════════════════════════════════

Sistema: FitTrainer-Pro
Link do aluno: ${window.location.origin}/student/${token}

Gerado em: ${new Date().toLocaleString('pt-BR')}
`;

    const blob = new Blob([content], { type: 'text/plain;charset=utf-utf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dieta-${student.name}-${new Date().toLocaleDateString('pt-BR')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const printThermalDiet = () => {
    if (!dietPlan || !student) return;

    const totalCalories = dietPlan.meals.reduce((total, meal) => 
      total + meal.meal_foods.reduce((mealTotal, food) => 
        mealTotal + (food.calories || 0), 0), 0);

    const printContent = `
<html>
<head>
  <style>
    @media print {
      @page { 
        margin: 0; 
        size: 80mm auto; 
      }
      body { 
        width: 80mm; 
        margin: 0; 
        padding: 2mm;
        font-family: 'Courier New', monospace; 
        font-size: 10px;
        line-height: 1.2;
      }
      .center { text-align: center; }
      .bold { font-weight: bold; }
      .separator { 
        border-top: 1px dashed #000; 
        margin: 2mm 0; 
      }
      .small { font-size: 8px; }
      .meal { margin: 2mm 0; }
      .food-item { margin: 1mm 0 1mm 3mm; }
    }
  </style>
</head>
<body>
  <div class="center bold">
    ========================================<br>
    COMPROVANTE DE DIETA<br>
    ========================================
  </div>
  
  <div class="separator"></div>
  
  <div class="bold">Personal Trainer:</div>
  <div>${dietPlan.personal_trainer.name}</div>
  ${dietPlan.personal_trainer.cref ? `<div class="small">CREF: ${dietPlan.personal_trainer.cref}</div>` : ''}
  
  <div class="separator"></div>
  
  <div class="bold">Aluno:</div>
  <div>${student.name}</div>
  <div class="small">ID: ${student.id}</div>
  
  <div class="separator"></div>
  
  <div class="bold">Plano Alimentar:</div>
  <div>${dietPlan.name}</div>
  <div class="small">Data: ${new Date().toLocaleDateString('pt-BR')}</div>
  
  <div class="separator"></div>
  
  <div class="bold">OBJETIVOS NUTRICIONAIS:</div>
  ${dietPlan.daily_calories ? `<div>Calorias: ${dietPlan.daily_calories} kcal</div>` : ''}
  ${dietPlan.daily_protein ? `<div>Proteínas: ${dietPlan.daily_protein}g</div>` : ''}
  ${dietPlan.daily_carbs ? `<div>Carboidratos: ${dietPlan.daily_carbs}g</div>` : ''}
  ${dietPlan.daily_fat ? `<div>Gorduras: ${dietPlan.daily_fat}g</div>` : ''}
  
  <div class="separator"></div>
  
  <div class="bold">REFEIÇÕES:</div>
  ${dietPlan.meals.map((meal, index) => `
    <div class="meal">
      <div class="bold">${index + 1}. ${meal.name}</div>
      ${meal.time_of_day ? `<div class="small">Horário: ${meal.time_of_day}</div>` : ''}
      <div class="small">Status: ${meal.isCompleted ? '✅ CONSUMIDA' : '⏳ PENDENTE'}</div>
      
      <div style="margin-top: 1mm;">
        ${meal.meal_foods.map(food => `
          <div class="food-item">
            <div class="bold">${food.food_name}</div>
            <div class="small">Qtd: ${food.quantity}${food.unit}</div>
            ${food.calories ? `<div class="small">Cal: ${food.calories} kcal</div>` : ''}
            ${food.protein ? `<div class="small">Prot: ${food.protein}g</div>` : ''}
            ${food.carbs ? `<div class="small">Carb: ${food.carbs}g</div>` : ''}
            ${food.fat ? `<div class="small">Gord: ${food.fat}g</div>` : ''}
            ${food.notes ? `<div class="small">Obs: ${food.notes}</div>` : ''}
          </div>
        `).join('')}
      </div>
    </div>
  `).join('')}
  
  <div class="separator"></div>
  
  <div class="bold center">Total do Dia: ${totalCalories} kcal</div>
  
  <div class="separator"></div>
  
  <div class="center small">
    Sistema: FitTrainer-Pro<br>
    ${new Date().toLocaleString('pt-BR')}
  </div>
  
  <script>
    window.onload = function() {
      window.print();
      window.onafterprint = function() {
        window.close();
      }
    }
  </script>
</body>
</html>`;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
    }
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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted/30">
        <Card className="max-w-md mx-4 shadow-lg">
          <CardContent className="text-center p-8 space-y-4">
            <div className="w-16 h-16 mx-auto bg-muted rounded-full flex items-center justify-center">
              <Apple className="h-8 w-8 text-muted-foreground" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-semibold">Dieta não encontrada</h3>
              <p className="text-muted-foreground text-sm">
                Nenhuma dieta ativa foi encontrada para este link ou o link pode estar inválido.
              </p>
            </div>
            <div className="flex flex-col gap-2 pt-4">
              <Button 
                onClick={() => window.history.back()}
                variant="default"
                className="w-full"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar
              </Button>
              <Button 
                onClick={() => window.location.href = '/'}
                variant="outline"
                className="w-full"
              >
                Ir para Início
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const totalDayCalories = dietPlan.meals.reduce((total, meal) => 
    total + meal.meal_foods.reduce((mealTotal, food) => 
      mealTotal + (food.calories || 0), 0), 0);

  const completedMeals = dietPlan.meals.filter(meal => meal.isCompleted).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/30">
      {/* Header */}
      <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-success/10 rounded-full">
                <Apple className="h-6 w-6 text-success" />
              </div>
              <div>
                <h1 className="text-xl lg:text-2xl font-bold text-primary">FitTrainer-Pro</h1>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <User className="h-4 w-4" />
                  {student.name} - Plano Alimentar
                  <Calendar className="h-4 w-4 ml-2" />
                  {new Date().toLocaleDateString('pt-BR')}
                </div>
              </div>
            </div>
            
            <div className="flex flex-wrap gap-2 w-full lg:w-auto">
              <Button 
                onClick={() => window.location.href = `/student/${token}`}
                variant="secondary" 
                size="sm"
                className="flex-1 lg:flex-none"
              >
                <Dumbbell className="h-4 w-4 mr-2" />
                Ver Treino
              </Button>
              <Button 
                onClick={exportDiet} 
                variant="outline" 
                size="sm"
                className="flex-1 lg:flex-none"
              >
                <Download className="h-4 w-4 mr-2" />
                Exportar
              </Button>
              <Button 
                onClick={printThermalDiet} 
                variant="default" 
                size="sm"
                className="flex-1 lg:flex-none bg-primary hover:bg-primary/90"
              >
                <Printer className="h-4 w-4 mr-2" />
                Imprimir
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        {/* Diet Plan Info */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-success" />
              {dietPlan.name}
            </CardTitle>
            {dietPlan.description && (
              <p className="text-muted-foreground">{dietPlan.description}</p>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Personal Trainer: <strong>{dietPlan.personal_trainer.name}</strong>
              {dietPlan.personal_trainer.cref && (
                <span> - CREF: {dietPlan.personal_trainer.cref}</span>
              )}
            </p>
            
            {/* Nutritional Goals */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {dietPlan.daily_calories && (
                <div className="text-center p-3 bg-muted/50 rounded-lg">
                  <p className="text-lg font-bold text-primary">{dietPlan.daily_calories}</p>
                  <p className="text-xs text-muted-foreground">kcal/dia</p>
                </div>
              )}
              {dietPlan.daily_protein && (
                <div className="text-center p-3 bg-muted/50 rounded-lg">
                  <p className="text-lg font-bold text-secondary">{dietPlan.daily_protein}g</p>
                  <p className="text-xs text-muted-foreground">Proteínas</p>
                </div>
              )}
              {dietPlan.daily_carbs && (
                <div className="text-center p-3 bg-muted/50 rounded-lg">
                  <p className="text-lg font-bold text-warning">{dietPlan.daily_carbs}g</p>
                  <p className="text-xs text-muted-foreground">Carboidratos</p>
                </div>
              )}
              {dietPlan.daily_fat && (
                <div className="text-center p-3 bg-muted/50 rounded-lg">
                  <p className="text-lg font-bold text-destructive">{dietPlan.daily_fat}g</p>
                  <p className="text-xs text-muted-foreground">Gorduras</p>
                </div>
              )}
            </div>

            {/* Progress Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gradient-to-r from-primary/5 to-success/5 rounded-lg border border-primary/10">
              <div className="text-center">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <TrendingUp className="h-4 w-4 text-success" />
                  <p className="text-sm text-muted-foreground">Progresso Hoje</p>
                </div>
                <p className="font-bold text-lg text-success">
                  {completedMeals} / {dietPlan.meals.length}
                </p>
                <p className="text-xs text-muted-foreground">refeições consumidas</p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <Target className="h-4 w-4 text-primary" />
                  <p className="text-sm text-muted-foreground">Calorias do Dia</p>
                </div>
                <p className="font-bold text-lg text-primary">{totalDayCalories}</p>
                <p className="text-xs text-muted-foreground">kcal calculadas</p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <CheckCircle className="h-4 w-4 text-secondary" />
                  <p className="text-sm text-muted-foreground">Taxa de Sucesso</p>
                </div>
                <p className="font-bold text-lg text-secondary">
                  {Math.round((completedMeals / dietPlan.meals.length) * 100)}%
                </p>
                <p className="text-xs text-muted-foreground">concluído hoje</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Meals */}
        <div className="space-y-4">
          {dietPlan.meals.map((meal, index) => (
            <Card key={meal.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Utensils className="h-5 w-5 text-secondary" />
                    <CardTitle className="text-lg">{meal.name}</CardTitle>
                    {meal.time_of_day && (
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {meal.time_of_day}
                      </div>
                    )}
                    {meal.isCompleted && (
                      <Badge className="bg-success text-success-foreground">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Consumida
                      </Badge>
                    )}
                  </div>
                  
                  {!meal.isCompleted && (
                    <Button
                      onClick={() => markMealAsCompleted(meal.id)}
                      size="sm"
                      className="bg-success hover:bg-success/90 text-success-foreground"
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Marcar como Consumida
                    </Button>
                  )}
                </div>
              </CardHeader>
              
              <CardContent className="space-y-3">
                {meal.meal_foods.map((food, foodIndex) => (
                  <div key={food.id} className="space-y-2">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <h4 className="font-medium">{food.food_name}</h4>
                        <p className="text-sm text-muted-foreground">
                          Quantidade: <strong>{food.quantity}{food.unit}</strong>
                        </p>
                        
                        {(food.calories || food.protein || food.carbs || food.fat) && (
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                            {food.calories && (
                              <div>
                                <span className="text-muted-foreground">Kcal:</span>
                                <span className="ml-1 font-medium">{food.calories}</span>
                              </div>
                            )}
                            {food.protein && (
                              <div>
                                <span className="text-muted-foreground">Prot:</span>
                                <span className="ml-1 font-medium">{food.protein}g</span>
                              </div>
                            )}
                            {food.carbs && (
                              <div>
                                <span className="text-muted-foreground">Carb:</span>
                                <span className="ml-1 font-medium">{food.carbs}g</span>
                              </div>
                            )}
                            {food.fat && (
                              <div>
                                <span className="text-muted-foreground">Gord:</span>
                                <span className="ml-1 font-medium">{food.fat}g</span>
                              </div>
                            )}
                          </div>
                        )}
                        
                        {food.notes && (
                          <p className="text-sm text-muted-foreground">
                            <strong>Obs:</strong> {food.notes}
                          </p>
                        )}
                      </div>
                    </div>
                    
                    {foodIndex < meal.meal_foods.length - 1 && (
                      <Separator className="my-2" />
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};

export default StudentDiet;