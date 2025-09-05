import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  User, 
  Calendar,
  Phone,
  Mail,
  ExternalLink,
  Dumbbell,
  Target,
  Utensils,
  Trash2,
  Edit,
  Users,
  Copy
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import QuickWorkoutCreator from "./QuickWorkoutCreator";
import QuickDietCreator from "./QuickDietCreator";
import StudentProfile from "./StudentProfile";

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
  workoutPlans?: {
    id: string;
    name: string;
    active: boolean;
    workout_sessions: {
      id: string;
      name: string;
    }[];
  }[];
  dietPlans?: {
    id: string;
    name: string;
    active: boolean;
  }[];
}

interface StudentListProps {
  trainerId: string;
}

type DialogType = 'workout' | 'diet' | 'profile' | null;

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
        .select(`
          *,
          workout_plans(
            id,
            name,
            active,
            workout_sessions(id, name)
          ),
          diet_plans(
            id,
            name,
            active
          )
        `)
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

  const copyStudentLink = (student: Student) => {
    const link = `${window.location.origin}/student/${student.unique_link_token}`;
    navigator.clipboard.writeText(link);
    toast({
      title: "Link copiado!",
      description: `O link do aluno ${student.name} foi copiado para a área de transferência.`,
    });
  };

  const deleteStudent = async (studentId: string) => {
    try {
      const { error } = await supabase
        .from("students")
        .update({ active: false })
        .eq("id", studentId);

      if (error) throw error;

      toast({
        title: "Aluno excluído",
        description: "O aluno foi removido com sucesso.",
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

  // Dialog handlers
  const openProfileDialog = (student: Student) => {
    setSelectedStudent(student);
    setDialogType('profile');
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
    loadStudents();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="border-0 shadow-md">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-3">
                  <Skeleton className="w-12 h-12 rounded-full" />
                  <div className="space-y-2">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-16" />
                </div>
                <div className="flex gap-2">
                  <Skeleton className="h-6 w-16" />
                  <Skeleton className="h-6 w-12" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : students.length === 0 ? (
        <Card className="border-0 shadow-md">
          <CardContent className="text-center py-16">
            <div className="bg-muted/50 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-6">
              <Users className="h-10 w-10 text-muted-foreground/50" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Nenhum aluno cadastrado</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              Comece cadastrando seu primeiro aluno para criar treinos e dietas personalizadas.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {students.map((student) => (
            <Card key={student.id} className="hover-scale transition-all duration-300 border-0 shadow-md hover:shadow-xl bg-gradient-to-br from-card to-card/50">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground rounded-full w-12 h-12 flex items-center justify-center font-semibold text-lg">
                      {getStudentInitials(student.name)}
                    </div>
                    <div>
                      <CardTitle className="text-lg">{student.name}</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {student.email || student.phone || "Sem contato"}
                      </p>
                    </div>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-4">
                {/* Personal Info */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {student.birth_date && (
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span>{calculateAge(student.birth_date)} anos</span>
                    </div>
                  )}
                  {student.weight && (
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Peso:</span>
                      <span className="font-medium">{student.weight}kg</span>
                    </div>
                  )}
                </div>

                {/* Goals */}
                {student.goals && student.goals.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {student.goals.slice(0, 2).map((goal, index) => (
                      <Badge key={index} variant="secondary" className="text-xs">
                        {goal}
                      </Badge>
                    ))}
                    {student.goals.length > 2 && (
                      <Badge variant="outline" className="text-xs">
                        +{student.goals.length - 2}
                      </Badge>
                    )}
                  </div>
                )}

                {/* Plans Summary */}
                <div className="flex justify-between items-center pt-2 border-t">
                  <div className="flex gap-4 text-sm">
                    <div className="text-center">
                      <p className="font-semibold text-primary">{student.workoutPlans?.filter(w => w.active).length || 0}</p>
                      <p className="text-xs text-muted-foreground">Treinos</p>
                    </div>
                    <div className="text-center">
                      <p className="font-semibold text-success">{student.dietPlans?.filter(d => d.active).length || 0}</p>
                      <p className="text-xs text-muted-foreground">Dietas</p>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="grid grid-cols-2 gap-2 pt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyStudentLink(student)}
                    className="hover-scale text-xs"
                  >
                    <Copy className="h-3 w-3 mr-1" />
                    Link
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openProfileDialog(student)}
                    className="hover-scale text-xs"
                  >
                    <User className="h-3 w-3 mr-1" />
                    Perfil
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openWorkoutDialog(student)}
                    className="hover-scale text-xs bg-primary/5 hover:bg-primary/10 border-primary/20"
                  >
                    <Dumbbell className="h-3 w-3 mr-1" />
                    Treino
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openDietDialog(student)}
                    className="hover-scale text-xs bg-success/5 hover:bg-success/10 border-success/20"
                  >
                    <Utensils className="h-3 w-3 mr-1" />
                    Dieta
                  </Button>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => deleteStudent(student.id)}
                  className="w-full text-destructive hover:text-destructive hover:bg-destructive/10 text-xs"
                >
                  <Trash2 className="h-3 w-3 mr-1" />
                  Excluir Aluno
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Profile Dialog */}
      <Dialog open={dialogType === 'profile'} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="max-w-6xl w-full max-h-[95vh] overflow-hidden bg-card/95 backdrop-blur border-0 shadow-2xl animate-scale-in">
          {selectedStudent && (
            <StudentProfile
              student={selectedStudent}
              trainerId={trainerId}
              onClose={closeDialog}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Workout Dialog */}
      <Dialog open={dialogType === 'workout'} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="max-w-4xl w-full max-h-[95vh] overflow-hidden bg-card/95 backdrop-blur border-0 shadow-2xl animate-scale-in">
          <DialogHeader className="pb-4">
            <DialogTitle className="text-xl font-bold bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent">
              Gerenciar Treino - {selectedStudent?.name}
            </DialogTitle>
          </DialogHeader>
          {selectedStudent && (
            <div className="overflow-y-auto max-h-[80vh]">
              <QuickWorkoutCreator
                trainerId={trainerId}
                studentId={selectedStudent.id}
                studentName={selectedStudent.name}
                onClose={closeDialog}
                onSuccess={handleSuccess}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Diet Dialog */}
      <Dialog open={dialogType === 'diet'} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="max-w-4xl w-full max-h-[95vh] overflow-hidden bg-card/95 backdrop-blur border-0 shadow-2xl animate-scale-in">
          <DialogHeader className="pb-4">
            <DialogTitle className="text-xl font-bold bg-gradient-to-r from-success to-success/80 bg-clip-text text-transparent">
              Gerenciar Dieta - {selectedStudent?.name}
            </DialogTitle>
          </DialogHeader>
          {selectedStudent && (
            <div className="overflow-y-auto max-h-[80vh]">
              <QuickDietCreator
                trainerId={trainerId}
                studentId={selectedStudent.id}
                studentName={selectedStudent.name}
                onClose={closeDialog}
                onSuccess={handleSuccess}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StudentList;