import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { X, Plus, Dumbbell, Save } from "lucide-react";
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
  id: string;
  exercise_id: string;
  exercise_name: string;
  sets: number;
  reps_min: number;
  reps_max: number;
  rest_minutes: number;
  order_index: number;
}

interface WorkoutSession {
  id: string;
  name: string;
  day_of_week: number;
  workout_plan_id: string;
  exercises: WorkoutExercise[];
}

interface EditWorkoutSessionProps {
  session: WorkoutSession;
  isOpen: boolean;
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

const EditWorkoutSession = ({ session, isOpen, onClose, onSuccess }: EditWorkoutSessionProps) => {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [categories, setCategories] = useState<ExerciseCategory[]>([]);
  const [sessionData, setSessionData] = useState<WorkoutSession>(session);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
      loadData();
      loadCurrentExercises();
    }
  }, [isOpen, session.id]);

  const loadData = async () => {
    try {
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

  const loadCurrentExercises = async () => {
    try {
      const { data, error } = await supabase
        .from("workout_exercises")
        .select(`
          id,
          exercise_id,
          sets,
          reps_min,
          reps_max,
          rest_seconds,
          order_index,
          exercises(name)
        `)
        .eq("workout_session_id", session.id)
        .order("order_index");

      if (error) throw error;

      const workoutExercises: WorkoutExercise[] = (data || []).map(ex => ({
        id: ex.id,
        exercise_id: ex.exercise_id,
        exercise_name: ex.exercises?.name || "",
        sets: ex.sets,
        reps_min: ex.reps_min || 8,
        reps_max: ex.reps_max || 12,
        rest_minutes: Math.round((ex.rest_seconds || 60) / 60), // Convert seconds to minutes
        order_index: ex.order_index,
      }));

      setSessionData(prev => ({ ...prev, exercises: workoutExercises }));
    } catch (error) {
      console.error("Error loading current exercises:", error);
    }
  };

  const addExercise = (exerciseId: string) => {
    const exercise = exercises.find(e => e.id === exerciseId);
    if (!exercise) return;

    const newExercise: WorkoutExercise = {
      id: "", // New exercise, no ID yet
      exercise_id: exerciseId,
      exercise_name: exercise.name,
      sets: 3,
      reps_min: 8,
      reps_max: 12,
      rest_minutes: 1,
      order_index: sessionData.exercises.length,
    };

    setSessionData(prev => ({
      ...prev,
      exercises: [...prev.exercises, newExercise].map((ex, idx) => ({ ...ex, order_index: idx }))
    }));
  };

  const updateExercise = (index: number, field: string, value: number) => {
    setSessionData(prev => ({
      ...prev,
      exercises: prev.exercises.map((ex, idx) => 
        idx === index ? { ...ex, [field]: value } : ex
      )
    }));
  };

  const removeExercise = (index: number) => {
    setSessionData(prev => ({
      ...prev,
      exercises: prev.exercises
        .filter((_, idx) => idx !== index)
        .map((ex, idx) => ({ ...ex, order_index: idx }))
    }));
  };

  const handleSave = async () => {
    setIsLoading(true);
    try {
      // Delete all existing exercises for this session
      const { error: deleteError } = await supabase
        .from("workout_exercises")
        .delete()
        .eq("workout_session_id", session.id);

      if (deleteError) throw deleteError;

      // Insert updated exercises
      if (sessionData.exercises.length > 0) {
        const exercisesToInsert = sessionData.exercises.map(ex => ({
          workout_session_id: session.id,
          exercise_id: ex.exercise_id,
          sets: ex.sets,
          reps_min: ex.reps_min,
          reps_max: ex.reps_max,
          rest_seconds: ex.rest_minutes * 60, // Convert minutes back to seconds for database
          order_index: ex.order_index,
        }));

        const { error: insertError } = await supabase
          .from("workout_exercises")
          .insert(exercisesToInsert);

        if (insertError) throw insertError;
      }

      toast({
        title: "Sucesso!",
        description: "Treino atualizado com sucesso!",
      });

      onSuccess();
    } catch (error) {
      console.error("Error updating workout:", error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o treino. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const categoryExercises = exercises.filter(ex => ex.category_id === selectedCategory);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-full h-full sm:h-auto sm:max-w-5xl sm:max-h-[90vh] p-0 gap-0 flex flex-col">
        <DialogHeader className="px-4 sm:px-6 py-4 border-b flex-shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Dumbbell className="h-4 w-4 sm:h-5 sm:w-5" />
            <span className="truncate">Editar Treino - {session.name}</span>
          </DialogTitle>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            {DAYS_OF_WEEK.find(d => d.value === session.day_of_week)?.label}
          </p>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {/* Add Exercise Section */}
          <Card className="border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base sm:text-lg">Adicionar Exercício</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Categoria</Label>
                  <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Selecione a categoria" />
                    </SelectTrigger>
                    <SelectContent className="max-h-48 z-50">
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
                
                {selectedCategory && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Exercício</Label>
                    <Select onValueChange={addExercise}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Escolher exercício" />
                      </SelectTrigger>
                      <SelectContent className="max-h-48 z-50">
                        {categoryExercises.map(exercise => (
                          <SelectItem key={exercise.id} value={exercise.id}>
                            {exercise.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Exercises List */}
          {sessionData.exercises.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base sm:text-lg">Exercícios do Treino ({sessionData.exercises.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {sessionData.exercises.map((exercise, idx) => (
                    <div key={idx} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 lg:gap-3 items-end p-3 bg-muted rounded-lg">
                      <div className="col-span-1 sm:col-span-2 lg:col-span-1">
                        <Label className="text-xs font-medium block mb-1">{exercise.exercise_name}</Label>
                      </div>
                      <div>
                        <Label className="text-xs block mb-1">Séries</Label>
                        <Input
                          type="number"
                          value={exercise.sets}
                          onChange={(e) => updateExercise(idx, 'sets', parseInt(e.target.value) || 0)}
                          min="1"
                          max="10"
                          className="h-9"
                        />
                      </div>
                      <div>
                        <Label className="text-xs block mb-1">Repetições</Label>
                        <div className="flex gap-1">
                          <Input
                            type="number"
                            value={exercise.reps_min}
                            onChange={(e) => updateExercise(idx, 'reps_min', parseInt(e.target.value) || 0)}
                            min="1"
                            placeholder="Min"
                            className="h-9"
                          />
                          <Input
                            type="number"
                            value={exercise.reps_max}
                            onChange={(e) => updateExercise(idx, 'reps_max', parseInt(e.target.value) || 0)}
                            min="1"
                            placeholder="Max"
                            className="h-9"
                          />
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs block mb-1">Descanso (min)</Label>
                        <Input
                          type="number"
                          step="0.5"
                          value={exercise.rest_minutes}
                          onChange={(e) => updateExercise(idx, 'rest_minutes', parseFloat(e.target.value) || 0)}
                          min="0"
                          className="h-9"
                        />
                      </div>
                      <div className="flex justify-end sm:justify-start">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => removeExercise(idx)}
                          className="w-full sm:w-auto"
                        >
                          <X className="h-4 w-4" />
                          <span className="ml-2 sm:hidden">Remover</span>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex-shrink-0 flex flex-col sm:flex-row gap-2 p-4 sm:p-6 pt-4 border-t bg-background">
          <Button type="button" variant="outline" onClick={onClose} className="flex-1 h-10">
            Cancelar
          </Button>
          <Button 
            onClick={handleSave} 
            className="flex-1 h-10" 
            disabled={isLoading}
          >
            {isLoading ? "Salvando..." : (
              <>
                <Save className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
                <span className="text-sm">Salvar Treino</span>
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EditWorkoutSession;