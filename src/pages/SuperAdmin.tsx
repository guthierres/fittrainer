import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Shield, 
  LogOut, 
  Users, 
  Activity, 
  BarChart3,
  UserCheck,
  UserX,
  Search,
  Download,
  UserPlus
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import CreatePersonalTrainer from "@/components/CreatePersonalTrainer";
import PersonalTrainerTestLogin from "@/components/PersonalTrainerTestLogin";

interface PersonalTrainer {
  id: string;
  name: string;
  cpf: string;
  email?: string;
  phone?: string;
  birth_date?: string;
  cref?: string;
  specializations?: string[];
  active: boolean;
  created_at: string;
  _count?: {
    students: number;
    workout_plans: number;
    diet_plans: number;
  };
}

const SuperAdminLogin = ({ onLogin }: { onLogin: () => void }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { data, error } = await supabase
        .from("super_admins")
        .select("*")
        .eq("email", email)
        .single();

      if (error || !data) {
        toast({
          title: "Erro no login",
          description: "Email ou senha inválidos.",
          variant: "destructive",
        });
        return;
      }

      // Simple password verification (in production, use proper hashing)
      if (email === "guthierresc@hotmail.com" && password === "Gutim@2028") {
        localStorage.setItem("superAdmin", JSON.stringify(data));
        toast({
          title: "Login realizado com sucesso!",
          description: `Bem-vindo, ${data.name}!`,
        });
        onLogin();
      } else {
        toast({
          title: "Erro no login",
          description: "Email ou senha inválidos.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Erro no login",
        description: "Ocorreu um erro inesperado. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-destructive/10 to-warning/10 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <Shield className="h-12 w-12 text-destructive" />
          </div>
          <CardTitle className="text-2xl font-bold text-destructive">
            Super Admin
          </CardTitle>
          <p className="text-muted-foreground">
            Acesso administrativo do sistema
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={isLoading || !email || !password}
            >
              {isLoading ? "Entrando..." : "Entrar"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

const SuperAdmin = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [trainers, setTrainers] = useState<PersonalTrainer[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [stats, setStats] = useState({
    totalTrainers: 0,
    activeTrainers: 0,
    totalStudents: 0,
    totalWorkouts: 0,
    totalDiets: 0
  });
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const adminData = localStorage.getItem("superAdmin");
    if (adminData) {
      setIsLoggedIn(true);
      loadTrainers();
      loadStats();
    }
  }, []);

  const loadTrainers = async () => {
    try {
      const { data, error } = await supabase
        .from("personal_trainers")
        .select(`
          *,
          students!inner(count),
          workout_plans!inner(count),
          diet_plans!inner(count)
        `)
        .order("created_at", { ascending: false });

      if (!error && data) {
        setTrainers(data);
      }
    } catch (error) {
      console.error("Error loading trainers:", error);
    }
  };

  const loadStats = async () => {
    try {
      const [trainersResult, studentsResult, workoutsResult, dietsResult] = await Promise.all([
        supabase.from("personal_trainers").select("id, active"),
        supabase.from("students").select("id, active"),
        supabase.from("workout_plans").select("id, active"),
        supabase.from("diet_plans").select("id, active")
      ]);

      setStats({
        totalTrainers: trainersResult.data?.length || 0,
        activeTrainers: trainersResult.data?.filter(t => t.active).length || 0,
        totalStudents: studentsResult.data?.filter(s => s.active).length || 0,
        totalWorkouts: workoutsResult.data?.filter(w => w.active).length || 0,
        totalDiets: dietsResult.data?.filter(d => d.active).length || 0
      });
    } catch (error) {
      console.error("Error loading stats:", error);
    }
  };

  const toggleTrainerStatus = async (trainerId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from("personal_trainers")
        .update({ active: !currentStatus })
        .eq("id", trainerId);

      if (!error) {
        toast({
          title: "Status atualizado",
          description: `Personal trainer ${!currentStatus ? 'ativado' : 'desativado'} com sucesso.`,
        });
        loadTrainers();
        loadStats();
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao atualizar status do personal trainer.",
        variant: "destructive",
      });
    }
  };

  const generateSystemReport = () => {
    const reportData = {
      geradoEm: new Date().toLocaleString('pt-BR'),
      stats,
      trainers: trainers.map(t => ({
        nome: t.name,
        cpf: t.cpf,
        email: t.email || 'N/A',
        telefone: t.phone || 'N/A',
        dataNascimento: t.birth_date ? new Date(t.birth_date).toLocaleDateString('pt-BR') : 'N/A',
        cref: t.cref || 'N/A',
        status: t.active ? 'Ativo' : 'Inativo',
        especialidades: t.specializations?.join(', ') || 'N/A',
        dataCadastro: new Date(t.created_at).toLocaleDateString('pt-BR')
      }))
    };

    // Generate CSV format for better compatibility
    const csvContent = [
      // Header
      'Nome,CPF,Email,Telefone,Data Nascimento,CREF,Status,Especialidades,Data Cadastro',
      // Data rows
      ...reportData.trainers.map(t => 
        `"${t.nome}","${t.cpf}","${t.email}","${t.telefone}","${t.dataNascimento}","${t.cref}","${t.status}","${t.especialidades}","${t.dataCadastro}"`
      )
    ].join('\n');

    const blob = new Blob([csvContent], {
      type: 'text/csv;charset=utf-8;'
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `relatorio-personal-trainers-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: "Relatório gerado",
      description: "Relatório de personal trainers exportado com sucesso!",
    });
  };

  const handleCreateSuccess = () => {
    setIsCreateDialogOpen(false);
    loadTrainers();
    loadStats();
  };

  const handleLogout = () => {
    localStorage.removeItem("superAdmin");
    toast({
      title: "Logout realizado",
      description: "Você foi desconectado com sucesso.",
    });
    navigate("/");
  };

  if (!isLoggedIn) {
    return <SuperAdminLogin onLogin={() => setIsLoggedIn(true)} />;
  }

  const filteredTrainers = trainers.filter(trainer =>
    trainer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    trainer.cpf.includes(searchTerm) ||
    trainer.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="h-8 w-8 text-destructive" />
            <div>
              <h1 className="text-2xl font-bold text-destructive">Super Admin</h1>
              <p className="text-sm text-muted-foreground">
                Painel de controle administrativo
              </p>
            </div>
          </div>
          <Button variant="outline" onClick={handleLogout} size="sm">
            <LogOut className="h-4 w-4 mr-2" />
            Sair
          </Button>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          <Card>
            <CardContent className="flex items-center p-4">
              <Users className="h-8 w-8 text-primary mr-3" />
              <div>
                <p className="text-2xl font-bold">{stats.totalTrainers}</p>
                <p className="text-sm text-muted-foreground">Total Trainers</p>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="flex items-center p-4">
              <UserCheck className="h-8 w-8 text-success mr-3" />
              <div>
                <p className="text-2xl font-bold">{stats.activeTrainers}</p>
                <p className="text-sm text-muted-foreground">Trainers Ativos</p>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="flex items-center p-4">
              <Users className="h-8 w-8 text-secondary mr-3" />
              <div>
                <p className="text-2xl font-bold">{stats.totalStudents}</p>
                <p className="text-sm text-muted-foreground">Total Alunos</p>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="flex items-center p-4">
              <Activity className="h-8 w-8 text-warning mr-3" />
              <div>
                <p className="text-2xl font-bold">{stats.totalWorkouts}</p>
                <p className="text-sm text-muted-foreground">Treinos Ativos</p>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="flex items-center p-4">
              <BarChart3 className="h-8 w-8 text-accent mr-3" />
              <div>
                <p className="text-2xl font-bold">{stats.totalDiets}</p>
                <p className="text-sm text-muted-foreground">Dietas Ativas</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="trainers" className="space-y-4">
          <TabsList className="grid grid-cols-3 w-full max-w-md">
            <TabsTrigger value="trainers">Personal Trainers</TabsTrigger>
            <TabsTrigger value="login-test">Teste de Login</TabsTrigger>
            <TabsTrigger value="reports">Relatórios</TabsTrigger>
          </TabsList>

          <TabsContent value="trainers" className="space-y-4">
            <div className="flex justify-between items-center gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome, CPF ou email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={() => setIsCreateDialogOpen(true)}>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Cadastrar Personal
                </Button>
                <Button onClick={generateSystemReport} variant="outline">
                  <Download className="h-4 w-4 mr-2" />
                  Exportar Relatório
                </Button>
              </div>
            </div>

            <div className="grid gap-4">
              {filteredTrainers.map((trainer) => (
                <Card key={trainer.id}>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold">{trainer.name}</h3>
                          <Badge variant={trainer.active ? "default" : "secondary"}>
                            {trainer.active ? "Ativo" : "Inativo"}
                          </Badge>
                        </div>
                        
                        <div className="grid md:grid-cols-2 gap-4 text-sm">
                          <div>
                            <p><strong>CPF:</strong> {trainer.cpf}</p>
                            <p><strong>Email:</strong> {trainer.email || 'N/A'}</p>
                            <p><strong>Telefone:</strong> {trainer.phone || 'N/A'}</p>
                          </div>
                          <div>
                            <p><strong>CREF:</strong> {trainer.cref || 'N/A'}</p>
                            <p><strong>Data de Nascimento:</strong> {trainer.birth_date ? new Date(trainer.birth_date).toLocaleDateString('pt-BR') : 'N/A'}</p>
                            <p><strong>Especialidades:</strong> {trainer.specializations?.join(', ') || 'N/A'}</p>
                            <p><strong>Cadastrado em:</strong> {new Date(trainer.created_at).toLocaleDateString('pt-BR')}</p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4">
                        {trainer.active ? (
                          <UserX className="h-5 w-5 text-destructive" />
                        ) : (
                          <UserCheck className="h-5 w-5 text-success" />
                        )}
                        <Switch
                          checked={trainer.active}
                          onCheckedChange={() => toggleTrainerStatus(trainer.id, trainer.active)}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="login-test" className="space-y-4">
            <PersonalTrainerTestLogin onClose={() => {}} />
          </TabsContent>

          <TabsContent value="reports" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Relatórios do Sistema</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground">
                  Gere relatórios detalhados sobre o desempenho do sistema e dos personal trainers.
                </p>
                <Button onClick={generateSystemReport} className="w-full">
                  <Download className="h-4 w-4 mr-2" />
                  Gerar Relatório Completo do Sistema
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Create Personal Trainer Dialog */}
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <CreatePersonalTrainer
              onClose={() => setIsCreateDialogOpen(false)}
              onSuccess={handleCreateSuccess}
            />
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default SuperAdmin;