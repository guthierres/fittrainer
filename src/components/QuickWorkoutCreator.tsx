import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { X, Plus, Dumbbell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import EnhancedExerciseSelector from "./EnhancedExerciseSelector";

interface ExerciseCategory {
  id: string;
  name: string;
  emoji: string;
}

interface WorkoutExercise {
  exercise_id: string;
  exercise_name: string;
  sets: number;
  reps_min: number;
  reps_max: number;
  rest_minutes: number;
  order_index: number;
}

interface WorkoutSession {
  day: number;
  name: string;
  category_id: string;
  category_name: string;
  exercises: WorkoutExercise[];
}

interface QuickWorkoutCreatorProps {
  studentId: string;
  studentName: string;
  trainerId: string;
  onClose: () => void;
  onSuccess: () => void;
}

const DAYS_OF_WEEK = [
  { value: 0, label: "Domingo" },
  { value: 1, label: "Segunda-feira" },
  { value: 2, label: "Terça-feira" },
  { value: 3, label: "Quarta-feira" },
  { value: 4, label: "Quinta-feira" },
  { value: 5, label: "Sexta-feira" },
  { value: 6, label: "Sábado" },
];

const QuickWorkoutCreator = ({ studentId, studentName, trainerId, onClose, onSuccess }: QuickWorkoutCreatorProps) => {
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    frequency_per_week: 3,
    duration_weeks: 4,
  });
  
  const [categories, setCategories] = useState<ExerciseCategory[]>([]);
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      const { data, error } = await supabase
        .from("exercise_categories")
        .select("id, name, emoji")
        .order("name");

      if (!error && data) {
        setCategories(data);
      }
    } catch (error) {
      console.error("Error loading categories:", error);
    }
  };

  const addTrainingDay = (selectedDay: number) => {
    const dayInfo = DAYS_OF_WEEK.find(d => d.value === selectedDay);
    if (!dayInfo) return;
    
    const newSession: WorkoutSession = {
      day: selectedDay,
      name: `Treino ${dayInfo.label}`,
      category_id: "",
      category_name: "",
      exercises: []
    };
    setSessions(prev => [...prev, newSession]);
    setFormData(prev => ({ ...prev, frequency_per_week: sessions.length + 1 }));
  };

  const removeTrainingDay = (dayToRemove: number) => {
    setSessions(prev => prev.filter(session => session.day !== dayToRemove));
    setFormData(prev => ({ ...prev, frequency_per_week: Math.max(1, sessions.length - 1) }));
  };

  const updateSessionCategory = (sessionIndex: number, categoryId: string) => {
    const category = categories.find(c => c.id === categoryId);
    if (!category) return;

    setSessions(prev => prev.map((session, idx) => 
      idx === sessionIndex 
        ? { 
            ...session, 
            category_id: categoryId, 
            category_name: category.name,
            exercises: [] // Clear exercises when category changes
          }
        : session
    ));
  };

  const updateSessionExercises = (sessionIndex: number, exercises: WorkoutExercise[]) => {
    setSessions(prev => prev.map((session, idx) => 
      idx === sessionIndex ? { ...session, exercises } : session
    ));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sessions.length === 0) {
      toast({
        title: "Erro",
        description: "Selecione pelo menos um dia da semana para o treino.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      // Create workout plan
      const { data: workoutPlan, error: planError } = await supabase
        .from("workout_plans")
        .insert({
          name: formData.name,
          description: formData.description,
          student_id: studentId,
          personal_trainer_id: trainerId,
          frequency_per_week: formData.frequency_per_week,
          duration_weeks: formData.duration_weeks,
          active: true,
        })
        .select()
        .single();

      if (planError) throw planError;

      // Create sessions and exercises
      for (const session of sessions) {
        if (session.exercises.length === 0) continue;

        const { data: workoutSession, error: sessionError } = await supabase
          .from("workout_sessions")
          .insert({
            workout_plan_id: workoutPlan.id,
            name: session.name,
            day_of_week: session.day,
            description: `Treino para ${DAYS_OF_WEEK.find(d => d.value === session.day)?.label}`,
          })
          .select()
          .single();

        if (sessionError) throw sessionError;

        // Insert exercises for this session
        const exerciseInserts = session.exercises.map(ex => ({
          workout_session_id: workoutSession.id,
          exercise_id: ex.exercise_id,
          sets: ex.sets,
          reps_min: ex.reps_min,
          reps_max: ex.reps_max,
          rest_seconds: ex.rest_minutes * 60,
          order_index: ex.order_index,
        }));

        const { error: exerciseError } = await supabase
          .from("workout_exercises")
          .insert(exerciseInserts);

        if (exerciseError) throw exerciseError;
      }

      toast({
        title: "Sucesso!",
        description: `Treino criado para ${studentName}!`,
      });

      onSuccess();
    } catch (error) {
      console.error("Error creating workout:", error);
      toast({
        title: "Erro",
        description: "Não foi possível criar o treino. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="max-w-5xl mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Dumbbell className="h-5 w-5" />
            Criar Treino para {studentName}
          </CardTitle>
          <Button variant="outline" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome do Treino *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Ex: Treino de Hipertrofia"
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="duration">Duração (semanas)</Label>
              <Input
                id="duration"
                type="number"
                min="1"
                max="52"
                value={formData.duration_weeks}
                onChange={(e) => setFormData(prev => ({ ...prev, duration_weeks: parseInt(e.target.value) || 4 }))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Descreva os objetivos e características deste treino..."
              rows={3}
            />
          </div>

          {/* Training Days Management */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Dias de Treino ({sessions.length} dia{sessions.length !== 1 ? 's' : ''})</Label>
              <Select onValueChange={(day) => addTrainingDay(parseInt(day))}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="+ Adicionar dia" />
                </SelectTrigger>
                <SelectContent>
                  {DAYS_OF_WEEK.filter(day => 
                    !sessions.some(session => session.day === day.value)
                  ).map(day => (
                    <SelectItem key={day.value} value={day.value.toString()}>
                      {day.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {sessions.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {sessions.map((session, idx) => (
                  <Badge key={session.day} variant="default" className="flex items-center gap-2">
                    {DAYS_OF_WEEK.find(d => d.value === session.day)?.label}
                    <X 
                      className="h-3 w-3 cursor-pointer" 
                      onClick={() => removeTrainingDay(session.day)}
                    />
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Training Sessions */}
          {sessions.map((session, sessionIndex) => {            
            return (
              <Card key={session.day} className="border-2 border-primary/20">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <div className="bg-primary text-primary-foreground rounded-full w-8 h-8 flex items-center justify-center text-sm font-medium">
                        {sessionIndex + 1}
                      </div>
                      {DAYS_OF_WEEK.find(d => d.value === session.day)?.label}
                    </CardTitle>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => removeTrainingDay(session.day)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Category Selection */}
                  <div className="space-y-2">
                    <Label>Categoria do Treino</Label>
                    <Select
                      value={session.category_id}
                      onValueChange={(categoryId) => updateSessionCategory(sessionIndex, categoryId)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a categoria (ex: Peito, Pernas...)">
                          {session.category_name && (
                            <span className="flex items-center gap-2">
                              {categories.find(c => c.id === session.category_id)?.emoji} {session.category_name}
                            </span>
                          )}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map(category => (
                          <SelectItem key={category.id} value={category.id}>
                            <span className="flex items-center gap-2">
                              {category.emoji} {category.name}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Enhanced Exercise Selection */}
                  {session.category_id && (
                    <EnhancedExerciseSelector
                      selectedCategory={session.category_id}
                      selectedExercises={session.exercises}
                      onExercisesChange={(exercises) => updateSessionExercises(sessionIndex, exercises)}
                    />
                  )}
                </CardContent>
              </Card>
            );
          })}

          {sessions.length === 0 && (
            <Card className="border-dashed">
              <CardContent className="text-center py-8">
                <Dumbbell className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                <p className="text-muted-foreground">
                  Nenhum dia de treino selecionado
                </p>
                <p className="text-sm text-muted-foreground">
                  Use o seletor acima para adicionar dias de treino
                </p>
              </CardContent>
            </Card>
          )}

          {/* Submit Buttons */}
          <div className="flex gap-2 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Cancelar
            </Button>
            <Button 
              type="submit" 
              className="flex-1" 
              disabled={isLoading || !formData.name || sessions.length === 0}
            >
              {isLoading ? "Criando..." : "Criar Treino"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default QuickWorkoutCreator;