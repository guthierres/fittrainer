import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dumbbell, User as UserIcon, Shield } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { User, Session } from '@supabase/supabase-js';

interface AuthProps {
  onAuthSuccess: (user: User, session: Session, userType: 'trainer' | 'admin') => void;
}

const AuthLogin = ({ onAuthSuccess }: AuthProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  
  // Trainer login state
  const [cpf, setCpf] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [isTrainerLoading, setIsTrainerLoading] = useState(false);
  
  // Admin login state
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [isAdminLoading, setIsAdminLoading] = useState(false);
  
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const formatCPF = (value: string) => {
    const numericValue = value.replace(/\D/g, "");
    if (numericValue.length <= 11) {
      const formatted = numericValue.replace(
        /(\d{3})(\d{3})(\d{3})(\d{2})/,
        "$1.$2.$3-$4"
      );
      return formatted;
    }
    return value;
  };

  const formatBirthDate = (value: string) => {
    const numericValue = value.replace(/\D/g, "");
    if (numericValue.length <= 8) {
      const formatted = numericValue.replace(
        /(\d{2})(\d{2})(\d{4})/,
        "$1/$2/$3"
      );
      return formatted;
    }
    return value;
  };

  const handleTrainerLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsTrainerLoading(true);

    try {
      // Remove formatting from CPF for database query
      const cleanCPF = cpf.replace(/\D/g, "");
      
      // Convert DD/MM/YYYY to YYYY-MM-DD for database query
      const [day, month, year] = birthDate.split("/");
      const dbBirthDate = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;

      const { data, error } = await supabase
        .from("personal_trainers")
        .select("*")
        .eq("cpf", cleanCPF)
        .eq("birth_date", dbBirthDate)
        .eq("active", true)
        .single();

      if (error || !data) {
        toast({
          title: "Erro no login",
          description: "CPF ou data de nascimento inválidos, ou personal trainer inativo.",
          variant: "destructive",
        });
        return;
      }

      // Create custom session with trainer data
      const customUser = {
        id: data.id,
        email: data.email || `${cleanCPF}@trainer.local`,
        app_metadata: {},
        user_metadata: {
          trainer_id: data.id,
          name: data.name,
          cpf: data.cpf,
          user_type: 'trainer'
        },
        aud: 'authenticated',
        created_at: new Date().toISOString()
      } as User;

      const customSession = {
        access_token: `trainer_${data.id}`,
        refresh_token: `refresh_trainer_${data.id}`,
        user: customUser,
        expires_at: Math.floor(Date.now() / 1000) + 86400 // 24 hours
      } as Session;

      onAuthSuccess(customUser, customSession, 'trainer');
      
      toast({
        title: "Login realizado com sucesso!",
        description: `Bem-vindo, ${data.name}!`,
      });
      
    } catch (error) {
      console.error("Login exception:", error);
      toast({
        title: "Erro no login",
        description: "Ocorreu um erro inesperado. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsTrainerLoading(false);
    }
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAdminLoading(true);

    try {
      const { data, error } = await supabase
        .from("super_admins")
        .select("*")
        .eq("email", adminEmail)
        .single();

      if (error || !data) {
        toast({
          title: "Erro no login",
          description: "Email inválido.",
          variant: "destructive",
        });
        return;
      }

      // Verify password using bcrypt
      const bcrypt = await import('bcryptjs');
      const isValidPassword = await bcrypt.compare(adminPassword, data.password_hash);
      
      if (isValidPassword) {
        // Create custom session with admin data
        const customUser = {
          id: data.id,
          email: data.email,
          app_metadata: {},
          user_metadata: {
            admin_id: data.id,
            name: data.name,
            user_type: 'admin'
          },
          aud: 'authenticated',
          created_at: new Date().toISOString()
        } as User;

        const customSession = {
          access_token: `admin_${data.id}`,
          refresh_token: `refresh_admin_${data.id}`,
          user: customUser,
          expires_at: Math.floor(Date.now() / 1000) + 86400 // 24 hours
        } as Session;

        onAuthSuccess(customUser, customSession, 'admin');
        
        toast({
          title: "Login realizado com sucesso!",
          description: `Bem-vindo, ${data.name}!`,
        });
      } else {
        toast({
          title: "Erro no login",
          description: "Email ou senha inválidos.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Admin login error:", error);
      toast({
        title: "Erro no login",
        description: "Ocorreu um erro inesperado. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsAdminLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 to-secondary/10 p-4">
      <Card className="w-full max-w-md glass-card">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <Dumbbell className="h-12 w-12 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold gradient-text">
            FitTrainer-Pro
          </CardTitle>
          <p className="text-muted-foreground">
            Sistema de gestão para personal trainers
          </p>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="trainer" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="trainer" className="flex items-center gap-2">
                <UserIcon className="h-4 w-4" />
                Personal
              </TabsTrigger>
              <TabsTrigger value="admin" className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Admin
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="trainer">
              <form onSubmit={handleTrainerLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="cpf">CPF</Label>
                  <Input
                    id="cpf"
                    type="text"
                    placeholder="000.000.000-00"
                    value={cpf}
                    onChange={(e) => setCpf(formatCPF(e.target.value))}
                    maxLength={14}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="birthDate">Data de Nascimento</Label>
                  <Input
                    id="birthDate"
                    type="text"
                    placeholder="DD/MM/AAAA"
                    value={birthDate}
                    onChange={(e) => setBirthDate(formatBirthDate(e.target.value))}
                    maxLength={10}
                    required
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full glass-button"
                  disabled={isTrainerLoading || !cpf || !birthDate}
                >
                  {isTrainerLoading ? "Entrando..." : "Entrar como Personal"}
                </Button>
              </form>
            </TabsContent>
            
            <TabsContent value="admin">
              <form onSubmit={handleAdminLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="adminEmail">Email</Label>
                  <Input
                    id="adminEmail"
                    type="email"
                    placeholder="admin@fittrainer.com"
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="adminPassword">Senha</Label>
                  <Input
                    id="adminPassword"
                    type="password"
                    placeholder="Sua senha"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    required
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full glass-button"
                  disabled={isAdminLoading || !adminEmail || !adminPassword}
                >
                  {isAdminLoading ? "Entrando..." : "Entrar como Admin"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default AuthLogin;