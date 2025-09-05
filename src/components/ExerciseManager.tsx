import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { 
  Plus, 
  Edit,
  Trash2,
  Dumbbell,
  Save
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Exercise {
  id: string;
  name: string;
  description?: string;
  instructions?: string;
  category_id: string;
  muscle_groups?: string[];
  equipment?: string[];
  personal_trainer_id?: string;
}

interface ExerciseCategory {
  id: string;
  name: string;
  emoji?: string;
}

interface ExerciseManagerProps {
  trainerId: string;
}

const ExerciseManager = ({ trainerId }: ExerciseManagerProps) => {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [categories, setCategories] = useState<ExerciseCategory[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [editingExercise, setEditingExercise] = useState<Exercise | null>(null);
  const [newExercise, setNewExercise] = useState<Partial<Exercise>>({
    name: "",
    description: "",
    instructions: "",
    category_id: "",
    muscle_groups: [],
    equipment: [],
  });
  const { toast } = useToast();

  useEffect(() => {
    loadExercises();
    loadCategories();
  }, [trainerId]);

  const loadExercises = async () => {
    try {
      const { data, error } = await supabase
        .from("exercises")
        .select(`
          *,
          exercise_categories(name, emoji)
        `)
        .or(`personal_trainer_id.is.null,personal_trainer_id.eq.${trainerId}`)
        .order("name");

      if (error) throw error;
      setExercises(data || []);
    } catch (error) {
      console.error("Error loading exercises:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os exercícios.",
        variant: "destructive",
      });
    }
  };

  const loadCategories = async () => {
    try {
      const { data, error } = await supabase
        .from("exercise_categories")
        .select("*")
        .order("name");

      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      console.error("Error loading categories:", error);
    }
  };

  const handleCreateExercise = async () => {
    if (!newExercise.name || !newExercise.category_id) {
      toast({
        title: "Erro",
        description: "Nome e categoria são obrigatórios.",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from("exercises")
        .insert({
          name: newExercise.name!,
          description: newExercise.description,
          instructions: newExercise.instructions,
          category_id: newExercise.category_id!,
          muscle_groups: newExercise.muscle_groups,
          equipment: newExercise.equipment,
          personal_trainer_id: trainerId,
        });

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Exercício criado com sucesso!",
      });

      setNewExercise({
        name: "",
        description: "",
        instructions: "",
        category_id: "",
        muscle_groups: [],
        equipment: [],
      });
      setIsCreating(false);
      loadExercises();
    } catch (error) {
      console.error("Error creating exercise:", error);
      toast({
        title: "Erro",
        description: "Não foi possível criar o exercício.",
        variant: "destructive",
      });
    }
  };

  const handleUpdateExercise = async () => {
    if (!editingExercise || !editingExercise.name || !editingExercise.category_id) {
      toast({
        title: "Erro",
        description: "Nome e categoria são obrigatórios.",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from("exercises")
        .update({
          name: editingExercise.name,
          description: editingExercise.description,
          instructions: editingExercise.instructions,
          category_id: editingExercise.category_id,
          muscle_groups: editingExercise.muscle_groups,
          equipment: editingExercise.equipment,
        })
        .eq("id", editingExercise.id);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Exercício atualizado com sucesso!",
      });

      setEditingExercise(null);
      loadExercises();
    } catch (error) {
      console.error("Error updating exercise:", error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o exercício.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteExercise = async (exerciseId: string) => {
    if (!confirm("Tem certeza que deseja excluir este exercício?")) return;

    try {
      const { error } = await supabase
        .from("exercises")
        .delete()
        .eq("id", exerciseId);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Exercício excluído com sucesso!",
      });

      loadExercises();
    } catch (error) {
      console.error("Error deleting exercise:", error);
      toast({
        title: "Erro",
        description: "Não foi possível excluir o exercício.",
        variant: "destructive",
      });
    }
  };

  const addTag = (field: 'muscle_groups' | 'equipment', value: string, isEditing = false) => {
    if (!value.trim()) return;
    
    if (isEditing && editingExercise) {
      const currentArray = editingExercise[field] || [];
      if (!currentArray.includes(value)) {
        setEditingExercise({
          ...editingExercise,
          [field]: [...currentArray, value]
        });
      }
    } else {
      const currentArray = newExercise[field] || [];
      if (!currentArray.includes(value)) {
        setNewExercise({
          ...newExercise,
          [field]: [...currentArray, value]
        });
      }
    }
  };

  const removeTag = (field: 'muscle_groups' | 'equipment', value: string, isEditing = false) => {
    if (isEditing && editingExercise) {
      const currentArray = editingExercise[field] || [];
      setEditingExercise({
        ...editingExercise,
        [field]: currentArray.filter(item => item !== value)
      });
    } else {
      const currentArray = newExercise[field] || [];
      setNewExercise({
        ...newExercise,
        [field]: currentArray.filter(item => item !== value)
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold gradient-text">Gerenciar Exercícios</h2>
        <Button 
          onClick={() => setIsCreating(true)}
          className="glass-button"
        >
          <Plus className="h-4 w-4 mr-2" />
          Criar Exercício
        </Button>
      </div>

      {isCreating && (
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Dumbbell className="h-5 w-5" />
              Criar Novo Exercício
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Nome do Exercício</Label>
                <Input
                  value={newExercise.name || ""}
                  onChange={(e) => setNewExercise({ ...newExercise, name: e.target.value })}
                  placeholder="Ex: Supino reto"
                />
              </div>
              <div>
                <Label>Categoria</Label>
                <Select
                  value={newExercise.category_id || ""}
                  onValueChange={(value) => setNewExercise({ ...newExercise, category_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.emoji} {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Descrição</Label>
              <Textarea
                value={newExercise.description || ""}
                onChange={(e) => setNewExercise({ ...newExercise, description: e.target.value })}
                placeholder="Descrição breve do exercício..."
              />
            </div>

            <div>
              <Label>Instruções</Label>
              <Textarea
                value={newExercise.instructions || ""}
                onChange={(e) => setNewExercise({ ...newExercise, instructions: e.target.value })}
                placeholder="Instruções detalhadas de execução..."
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button 
                variant="outline" 
                onClick={() => {
                  setIsCreating(false);
                  setNewExercise({
                    name: "",
                    description: "",
                    instructions: "",
                    category_id: "",
                    muscle_groups: [],
                    equipment: [],
                  });
                }}
              >
                Cancelar
              </Button>
              <Button onClick={handleCreateExercise}>
                <Save className="h-4 w-4 mr-2" />
                Salvar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4">
        {exercises.map((exercise) => (
          <Card key={exercise.id} className="glass-card">
            <CardContent className="p-6">
              {editingExercise?.id === exercise.id ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Nome do Exercício</Label>
                      <Input
                        value={editingExercise.name}
                        onChange={(e) => setEditingExercise({ ...editingExercise, name: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Categoria</Label>
                      <Select
                        value={editingExercise.category_id}
                        onValueChange={(value) => setEditingExercise({ ...editingExercise, category_id: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map((category) => (
                            <SelectItem key={category.id} value={category.id}>
                              {category.emoji} {category.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <Label>Descrição</Label>
                    <Textarea
                      value={editingExercise.description || ""}
                      onChange={(e) => setEditingExercise({ ...editingExercise, description: e.target.value })}
                    />
                  </div>

                  <div>
                    <Label>Instruções</Label>
                    <Textarea
                      value={editingExercise.instructions || ""}
                      onChange={(e) => setEditingExercise({ ...editingExercise, instructions: e.target.value })}
                    />
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button 
                      variant="outline" 
                      onClick={() => setEditingExercise(null)}
                    >
                      Cancelar
                    </Button>
                    <Button onClick={handleUpdateExercise}>
                      <Save className="h-4 w-4 mr-2" />
                      Salvar
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg">{exercise.name}</h3>
                    <p className="text-muted-foreground">{exercise.description}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="secondary">
                        {categories.find(c => c.id === exercise.category_id)?.name}
                      </Badge>
                      {exercise.personal_trainer_id && (
                        <Badge variant="outline">Personalizado</Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {exercise.personal_trainer_id === trainerId && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditingExercise(exercise)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteExercise(exercise.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default ExerciseManager;