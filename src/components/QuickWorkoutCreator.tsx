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

interface WorkoutExercise {
  exercise_id: string;
  exercise_name: string;
  sets: number;
  reps_min: number;
  reps_max: number;
  weight_kg: number;
  rest_seconds: number;
  order_index: number;
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
  const [sessions, setSessions] = useState<Array<{
    day: number;
    name: string;
    exercises: WorkoutExercise[];
  }>>([]);
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadExercises();
  }, []);

  const loadExercises = async () => {
    try {
      const { data, error } = await supabase
        .from("exercises")
        .select("id, name, category_id")
        .order("name");

      if (error) throw error;
      setExercises(data || []);
    } catch (error) {
      console.error("Error loading exercises:", error);
    }
  };

  const handleDayToggle = (day: number) => {
    if (selectedDays.includes(day)) {
      setSelectedDays(prev => prev.filter(d => d !== day));
      setSessions(prev => prev.filter(s => s.day !== day));
    } else {
      setSelectedDays(prev => [...prev, day]);
      setSessions(prev => [...prev, {
        day,
        name: `Treino ${DAYS_OF_WEEK.find(d => d.value === day)?.label}`,
        exercises: []
      }]);
    }
  };

  const addExerciseToSession = (sessionDay: number, exerciseId: string) => {
    const exercise = exercises.find(e => e.id === exerciseId);
    if (!exercise) return;

    const newExercise: WorkoutExercise = {
      exercise_id: exerciseId,
      exercise_name: exercise.name,
      sets: 3,
      reps_min: 8,
      reps_max: 12,
      weight_kg: 0,
      rest_seconds: 60,
      order_index: 0,
    };

    setSessions(prev => prev.map(session => {
      if (session.day === sessionDay) {
        const updatedExercises = [...session.exercises, newExercise];
        return {
          ...session,
          exercises: updatedExercises.map((ex, idx) => ({ ...ex, order_index: idx }))
        };
      }
      return session;
    }));
  };

  const updateExerciseInSession = (sessionDay: number, exerciseIndex: number, field: string, value: number) => {
    setSessions(prev => prev.map(session => {
      if (session.day === sessionDay) {
        const updatedExercises = session.exercises.map((ex, idx) => 
          idx === exerciseIndex ? { ...ex, [field]: value } : ex
        );
        return { ...session, exercises: updatedExercises };
      }
      return session;
    }));
  };

  const removeExerciseFromSession = (sessionDay: number, exerciseIndex: number) => {
    setSessions(prev => prev.map(session => {
      if (session.day === sessionDay) {
        const updatedExercises = session.exercises.filter((_, idx) => idx !== exerciseIndex);
        return {
          ...session,
          exercises: updatedExercises.map((ex, idx) => ({ ...ex, order_index: idx }))
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
          weight_kg: ex.weight_kg,
          rest_seconds: ex.rest_seconds,
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

          {/* Days Selection */}
          <div className="space-y-3">
            <Label>Dias da Semana</Label>
            <div className="flex flex-wrap gap-2">
              {DAYS_OF_WEEK.map(day => (
                <Badge
                  key={day.value}
                  variant={selectedDays.includes(day.value) ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => handleDayToggle(day.value)}
                >
                  {day.label}
                </Badge>
              ))}
            </div>
          </div>

          {/* Sessions */}
          {sessions.map(session => (
            <Card key={session.day} className="border-2">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">
                  {DAYS_OF_WEEK.find(d => d.value === session.day)?.label}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Select
                    onValueChange={(exerciseId) => addExerciseToSession(session.day, exerciseId)}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Adicionar exercício" />
                    </SelectTrigger>
                    <SelectContent>
                      {exercises.map(exercise => (
                        <SelectItem key={exercise.id} value={exercise.id}>
                          {exercise.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {session.exercises.map((exercise, idx) => (
                  <div key={idx} className="grid grid-cols-6 gap-2 items-end p-3 bg-muted rounded-lg">
                    <div className="col-span-2">
                      <Label className="text-xs">{exercise.exercise_name}</Label>
                    </div>
                    <div>
                      <Label className="text-xs">Séries</Label>
                      <Input
                        type="number"
                        value={exercise.sets}
                        onChange={(e) => updateExerciseInSession(session.day, idx, 'sets', parseInt(e.target.value) || 0)}
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
                          onChange={(e) => updateExerciseInSession(session.day, idx, 'reps_min', parseInt(e.target.value) || 0)}
                          min="1"
                          placeholder="Min"
                        />
                        <Input
                          type="number"
                          value={exercise.reps_max}
                          onChange={(e) => updateExerciseInSession(session.day, idx, 'reps_max', parseInt(e.target.value) || 0)}
                          min="1"
                          placeholder="Max"
                        />
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs">Peso (kg)</Label>
                      <Input
                        type="number"
                        step="0.5"
                        value={exercise.weight_kg}
                        onChange={(e) => updateExerciseInSession(session.day, idx, 'weight_kg', parseFloat(e.target.value) || 0)}
                        min="0"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => removeExerciseFromSession(session.day, idx)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}

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