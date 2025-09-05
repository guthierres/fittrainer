import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { 
  User, 
  Calendar,
  Phone,
  Mail,
  ExternalLink,
  Dumbbell,
  Target,
  Utensils,
  Trash2
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import QuickWorkoutCreator from "./QuickWorkoutCreator";
import QuickDietCreator from "./QuickDietCreator";

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
}

interface StudentListProps {
  trainerId: string;
}

type DialogType = 'workout' | 'diet' | null;

const StudentList = ({ trainerId }: StudentListProps) => {
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogType, setDialogType] = useState<DialogType>(null);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadStudents();
  }, [trainerId]);

  const loadStudents = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from("students")
        .select("*")
        .eq("personal_trainer_id", trainerId)
        .eq("active", true)
        .order("created_at", { ascending: false });

      if (error) {
        toast({
          title: "Erro",
          description: "Não foi possível carregar a lista de alunos.",
          variant: "destructive",
        });
        return;
      }

      setStudents(data || []);
    } catch (error) {
      console.error("Error loading students:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const copyStudentLink = (token: string) => {
    const link = `${window.location.origin}/student/${token}`;
    navigator.clipboard.writeText(link);
    toast({
      title: "Link copiado!",
      description: "O link do aluno foi copiado para a área de transferência.",
    });
  };

  const deleteStudent = async (studentId: string, studentName: string) => {
    if (!confirm(`Tem certeza que deseja excluir o aluno ${studentName}?`)) return;

    try {
      const { error } = await supabase
        .from("students")
        .update({ active: false })
        .eq("id", studentId);

      if (error) throw error;

      toast({
        title: "Aluno excluído!",
        description: `${studentName} foi excluído com sucesso.`,
      });

      loadStudents();
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível excluir o aluno.",
        variant: "destructive",
      });
    }
  };

  const getStudentInitials = (name: string) => {
    return name
      .split(" ")
      .map(n => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
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

  const openWorkoutDialog = (student: Student) => {
    setSelectedStudent(student);
    setDialogType('workout');
  };

  const openDietDialog = (student: Student) => {
    setSelectedStudent(student);
    setDialogType('diet');
  };

  const closeDialog = () => {
    setDialogType(null);
    setSelectedStudent(null);
  };

  const handleSuccess = () => {
    closeDialog();
    loadStudents(); // Refresh the student list if needed
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-4">
              <div className="h-4 bg-muted rounded mb-2" />
              <div className="h-3 bg-muted rounded w-3/4" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (students.length === 0) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <User className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">
            Nenhum aluno cadastrado ainda.
          </p>
          <p className="text-sm text-muted-foreground">
            Clique em "Novo Aluno" para começar.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {students.map((student) => (
        <Card key={student.id} className="hover:shadow-lg transition-shadow">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <Avatar className="h-12 w-12">
                  <AvatarFallback className="bg-primary text-primary-foreground">
                    {getStudentInitials(student.name)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <CardTitle className="text-lg">{student.name}</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Desde {new Date(student.created_at).toLocaleDateString('pt-BR')}
                  </p>
                </div>
              </div>
            </div>
          </CardHeader>
          
          <CardContent className="space-y-3">
            {/* Contact Info */}
            {student.email && (
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="truncate">{student.email}</span>
              </div>
            )}
            
            {student.phone && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span>{student.phone}</span>
              </div>
            )}

            {/* Personal Info */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              {student.birth_date && (
                <div className="flex items-center gap-1">
                  <Calendar className="h-3 w-3 text-muted-foreground" />
                  <span>{calculateAge(student.birth_date)} anos</span>
                </div>
              )}
              
              {student.weight && (
                <div>
                  <span className="text-muted-foreground">Peso:</span>
                  <span className="ml-1 font-medium">{student.weight}kg</span>
                </div>
              )}
              
              {student.height && (
                <div>
                  <span className="text-muted-foreground">Altura:</span>
                  <span className="ml-1 font-medium">{student.height}m</span>
                </div>
              )}
            </div>

            {/* Goals */}
            {student.goals && student.goals.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Objetivos:</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {student.goals.map((goal, index) => (
                    <Badge key={index} variant="secondary" className="text-xs">
                      {goal}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="pt-2 space-y-2">
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => copyStudentLink(student.unique_link_token)}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Copiar Link do Aluno
              </Button>
              
              <div className="grid grid-cols-2 gap-2">
                <Button 
                  variant="secondary" 
                  size="sm"
                  onClick={() => openWorkoutDialog(student)}
                >
                  <Dumbbell className="h-4 w-4 mr-2" />
                  Treinos
                </Button>
                <Button 
                  variant="secondary" 
                  size="sm"
                  onClick={() => openDietDialog(student)}
                >
                  <Utensils className="h-4 w-4 mr-2" />
                  Dietas
                </Button>
              </div>
              
              <Button 
                variant="destructive" 
                size="sm"
                className="w-full"
                onClick={() => deleteStudent(student.id, student.name)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Excluir Aluno
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
      
      {/* Dialogs */}
      <Dialog open={dialogType === 'workout'} onOpenChange={() => setDialogType(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {selectedStudent && (
            <QuickWorkoutCreator
              studentId={selectedStudent.id}
              studentName={selectedStudent.name}
              trainerId={trainerId}
              onClose={closeDialog}
              onSuccess={handleSuccess}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={dialogType === 'diet'} onOpenChange={() => setDialogType(null)}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          {selectedStudent && (
            <QuickDietCreator
              studentId={selectedStudent.id}
              studentName={selectedStudent.name}
              trainerId={trainerId}
              onClose={closeDialog}
              onSuccess={handleSuccess}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StudentList;