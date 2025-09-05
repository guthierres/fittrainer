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

interface Exercise {
  id: string;
  name: string;
  category_id: string;
}

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
  
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [categories, setCategories] = useState<ExerciseCategory[]>([]);
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Load exercises and categories in parallel
      const [exercisesResponse, categoriesResponse] = await Promise.all([
        supabase.from("exercises").select("id, name, category_id").order("name"),
        supabase.from("exercise_categories").select("id, name, emoji").order("name")
      ]);

      if (exercisesResponse.error) throw exercisesResponse.error;
      if (categoriesResponse.error) throw categoriesResponse.error;

      setExercises(exercisesResponse.data || []);
      setCategories(categoriesResponse.data || []);
    } catch (error) {
      console.error("Error loading data:", error);
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

  const addExerciseToSession = (sessionIndex: number, exerciseId: string) => {
    const exercise = exercises.find(e => e.id === exerciseId);
    if (!exercise) return;

    const newExercise: WorkoutExercise = {
      exercise_id: exerciseId,
      exercise_name: exercise.name,
      sets: 3,
      reps_min: 8,
      reps_max: 12,
      rest_minutes: 1,
      order_index: 0,
    };

    setSessions(prev => prev.map((session, idx) => {
      if (idx === sessionIndex) {
        const updatedExercises = [...session.exercises, newExercise];
        return {
          ...session,
          exercises: updatedExercises.map((ex, exIdx) => ({ ...ex, order_index: exIdx }))
        };
      }
      return session;
    }));
  };

  const updateExerciseInSession = (sessionIndex: number, exerciseIndex: number, field: string, value: number) => {
    setSessions(prev => prev.map((session, idx) => {
      if (idx === sessionIndex) {
        const updatedExercises = session.exercises.map((ex, exIdx) => 
          exIdx === exerciseIndex ? { ...ex, [field]: value } : ex
        );
        return { ...session, exercises: updatedExercises };
      }
      return session;
    }));
  };

  const removeExerciseFromSession = (sessionIndex: number, exerciseIndex: number) => {
    setSessions(prev => prev.map((session, idx) => {
      if (idx === sessionIndex) {
        const updatedExercises = session.exercises.filter((_, exIdx) => exIdx !== exerciseIndex);
        return {
          ...session,
          exercises: updatedExercises.map((ex, exIdx) => ({ ...ex, order_index: exIdx }))
        };
      }
      return session;
    }));
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
    <Card className="max-w-4xl mx-auto">
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
              <Label htmlFor="frequency">Frequência Semanal</Label>
              <Select
                value={formData.frequency_per_week.toString()}
                onValueChange={(value) => setFormData(prev => ({ ...prev, frequency_per_week: parseInt(value) }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1,2,3,4,5,6,7].map(freq => (
                    <SelectItem key={freq} value={freq.toString()}>
                      {freq}x por semana
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                  <SelectValue placeholder="Selecionar dia" />
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
            const categoryExercises = exercises.filter(ex => ex.category_id === session.category_id);
            
            return (
              <Card key={session.day} className="border-2">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">
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
                <CardContent className="space-y-4">
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

                  {/* Exercise Selection */}
                  {session.category_id && (
                    <div className="space-y-2">
                      <Label>Adicionar Exercícios</Label>
                      <Select
                        onValueChange={(exerciseId) => addExerciseToSession(sessionIndex, exerciseId)}
                        key={session.exercises.length} // Reset selection after adding
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={`Escolher exercício de ${session.category_name}`} />
                        </SelectTrigger>
                        <SelectContent>
                          {categoryExercises.map(exercise => (
                            <SelectItem key={exercise.id} value={exercise.id}>
                              {exercise.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Exercise List */}
                  {session.exercises.length > 0 && (
                    <div className="space-y-3">
                      <Label className="text-sm font-medium">Exercícios Selecionados:</Label>
                      {session.exercises.map((exercise, idx) => (
                        <div key={idx} className="grid grid-cols-6 gap-2 items-end p-3 bg-muted rounded-lg">
                          <div className="col-span-2">
                            <Label className="text-xs font-medium">{exercise.exercise_name}</Label>
                          </div>
                          <div>
                            <Label className="text-xs">Séries</Label>
                            <Input
                              type="number"
                              value={exercise.sets}
                              onChange={(e) => updateExerciseInSession(sessionIndex, idx, 'sets', parseInt(e.target.value) || 0)}
                              min="1"
                              max="10"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Reps</Label>
                            <div className="flex gap-1">
                              <Input
                                type="number"
                                value={exercise.reps_min}
                                onChange={(e) => updateExerciseInSession(sessionIndex, idx, 'reps_min', parseInt(e.target.value) || 0)}
                                min="1"
                                placeholder="Min"
                              />
                              <Input
                                type="number"
                                value={exercise.reps_max}
                                onChange={(e) => updateExerciseInSession(sessionIndex, idx, 'reps_max', parseInt(e.target.value) || 0)}
                                min="1"
                                placeholder="Max"
                              />
                            </div>
                          </div>
                          <div>
                            <Label className="text-xs">Descanso (min)</Label>
                            <Input
                              type="number"
                              step="0.5"
                              value={exercise.rest_minutes}
                              onChange={(e) => updateExerciseInSession(sessionIndex, idx, 'rest_minutes', parseFloat(e.target.value) || 0)}
                              min="0"
                            />
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => removeExerciseFromSession(sessionIndex, idx)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}

          {/* Submit Buttons */}
          <div className="flex gap-2 pt-4">
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