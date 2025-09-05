import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { X, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface CreateStudentProps {
  trainerId: string;
  onClose: () => void;
  onSuccess: () => void;
}

const CreateStudent = ({ trainerId, onClose, onSuccess }: CreateStudentProps) => {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    birth_date: "",
    weight: "",
    height: "",
    medical_restrictions: "",
  });
  
  const [goals, setGoals] = useState<string[]>([]);
  const [newGoal, setNewGoal] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const addGoal = () => {
    if (newGoal.trim() && !goals.includes(newGoal.trim())) {
      setGoals(prev => [...prev, newGoal.trim()]);
      setNewGoal("");
    }
  };

  const removeGoal = (goal: string) => {
    setGoals(prev => prev.filter(g => g !== goal));
  };

  const formatPhone = (value: string) => {
    const numericValue = value.replace(/\D/g, "");
    if (numericValue.length <= 11) {
      return numericValue.replace(
        /(\d{2})(\d{5})(\d{4})/,
        "($1) $2-$3"
      ).replace(
        /(\d{2})(\d{4})(\d{4})/,
        "($1) $2-$3"
      );
    }
    return value;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Convert DD/MM/YYYY to YYYY-MM-DD if birth_date is provided
      let dbBirthDate = null;
      if (formData.birth_date) {
        // Check if it's already in YYYY-MM-DD format (from date input)
        if (formData.birth_date.includes('-')) {
          dbBirthDate = formData.birth_date;
        } else if (formData.birth_date.includes('/')) {
          // Convert DD/MM/YYYY to YYYY-MM-DD
          const [day, month, year] = formData.birth_date.split("/");
          if (day && month && year) {
            dbBirthDate = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
          }
        }
      }

      // Generate a more robust unique token
      const generateUniqueToken = () => {
        const timestamp = Date.now().toString(36);
        const randomStr = Math.random().toString(36).substring(2);
        return `${timestamp}-${randomStr}`;
      };

      const studentData = {
        personal_trainer_id: trainerId,
        name: formData.name.trim(),
        email: formData.email ? formData.email.trim() : null,
        phone: formData.phone ? formData.phone.trim() : null,
        birth_date: dbBirthDate,
        weight: formData.weight ? parseFloat(formData.weight) : null,
        height: formData.height ? parseFloat(formData.height) : null,
        goals: goals.length > 0 ? goals : null,
        medical_restrictions: formData.medical_restrictions ? formData.medical_restrictions.trim() : null,
        unique_link_token: generateUniqueToken(),
        active: true,
      };

      console.log("Attempting to create student with data:", studentData);

      const { data, error } = await supabase
        .from("students")
        .insert(studentData)
        .select();

      if (error) {
        console.error("Database error:", error);
        toast({
          title: "Erro",
          description: `Não foi possível cadastrar o aluno: ${error.message}`,
          variant: "destructive",
        });
        return;
      }

      console.log("Student created successfully:", data);

      toast({
        title: "Sucesso!",
        description: `Aluno ${formData.name} cadastrado com sucesso!`,
      });

      onSuccess();
    } catch (error) {
      console.error("Error creating student:", error);
      toast({
        title: "Erro",
        description: "Ocorreu um erro inesperado. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Cadastrar Novo Aluno</CardTitle>
          <Button variant="outline" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Basic Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome Completo *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleInputChange("name", e.target.value)}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange("email", e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Telefone</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => handleInputChange("phone", formatPhone(e.target.value))}
                maxLength={15}
                placeholder="(11) 99999-9999"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="birth_date">Data de Nascimento</Label>
              <Input
                id="birth_date"
                type="date"
                value={formData.birth_date}
                onChange={(e) => handleInputChange("birth_date", e.target.value)}
                max={new Date().toISOString().split('T')[0]} // Prevent future dates
              />
            </div>
          </div>

          {/* Physical Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="weight">Peso (kg)</Label>
              <Input
                id="weight"
                type="number"
                step="0.1"
                min="1"
                max="300"
                value={formData.weight}
                onChange={(e) => handleInputChange("weight", e.target.value)}
                placeholder="70.5"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="height">Altura (m)</Label>
              <Input
                id="height"
                type="number"
                step="0.01"
                min="0.5"
                max="2.5"
                value={formData.height}
                onChange={(e) => handleInputChange("height", e.target.value)}
                placeholder="1.75"
              />
            </div>
          </div>

          {/* Goals */}
          <div className="space-y-2">
            <Label>Objetivos</Label>
            <div className="flex gap-2">
              <Input
                value={newGoal}
                onChange={(e) => setNewGoal(e.target.value)}
                placeholder="Ex: Perda de peso, Ganho de massa muscular"
                onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), addGoal())}
              />
              <Button type="button" onClick={addGoal} size="icon">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            
            {goals.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {goals.map((goal, index) => (
                  <Badge key={index} variant="secondary" className="flex items-center gap-1">
                    {goal}
                    <X
                      className="h-3 w-3 cursor-pointer"
                      onClick={() => removeGoal(goal)}
                    />
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Medical Restrictions */}
          <div className="space-y-2">
            <Label htmlFor="medical_restrictions">Restrições Médicas</Label>
            <Textarea
              id="medical_restrictions"
              value={formData.medical_restrictions}
              onChange={(e) => handleInputChange("medical_restrictions", e.target.value)}
              placeholder="Descreva qualquer restrição médica, lesão ou cuidado especial..."
              rows={3}
            />
          </div>

          {/* Submit Buttons */}
          <div className="flex gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Cancelar
            </Button>
            <Button 
              type="submit" 
              className="flex-1" 
              disabled={isLoading || !formData.name}
            >
              {isLoading ? "Cadastrando..." : "Cadastrar Aluno"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default CreateStudent;