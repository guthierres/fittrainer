import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useState, useEffect } from "react";
import type { User, Session } from '@supabase/supabase-js';
import Index from "./pages/Index";
import AuthLogin from "./pages/AuthLogin";
import Dashboard from "./pages/Dashboard";
import StudentWorkout from "./pages/StudentWorkout";
import StudentDiet from "./pages/StudentDiet";
import SuperAdmin from "./pages/SuperAdmin";
import NotFound from "./pages/NotFound";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfService from "./pages/TermsOfService";

const queryClient = new QueryClient();

const App = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [userType, setUserType] = useState<'trainer' | 'admin' | null>(null);

  const handleAuthSuccess = (newUser: User, newSession: Session, type: 'trainer' | 'admin') => {
    setUser(newUser);
    setSession(newSession);
    setUserType(type);
    
    // Store in localStorage for persistence
    localStorage.setItem('auth_user', JSON.stringify(newUser));
    localStorage.setItem('auth_session', JSON.stringify(newSession));
    localStorage.setItem('user_type', type);
  };

  const handleLogout = () => {
    setUser(null);
    setSession(null);
    setUserType(null);
    localStorage.removeItem('auth_user');
    localStorage.removeItem('auth_session');
    localStorage.removeItem('user_type');
    localStorage.removeItem('trainer');
    localStorage.removeItem('superAdmin');
  };

  useEffect(() => {
    // Check for existing session on app load
    const storedUser = localStorage.getItem('auth_user');
    const storedSession = localStorage.getItem('auth_session');
    const storedUserType = localStorage.getItem('user_type');
    
    if (storedUser && storedSession && storedUserType) {
      try {
        const parsedUser = JSON.parse(storedUser);
        const parsedSession = JSON.parse(storedSession);
        
        // Check if session is still valid (24 hours)
        if (parsedSession.expires_at > Math.floor(Date.now() / 1000)) {
          setUser(parsedUser);
          setSession(parsedSession);
          setUserType(storedUserType as 'trainer' | 'admin');
        } else {
          handleLogout();
        }
      } catch (error) {
        console.error('Error parsing stored auth:', error);
        handleLogout();
      }
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route 
              path="/login" 
              element={
                user ? (
                  <Navigate to={userType === 'admin' ? '/super-admin' : '/dashboard'} replace />
                ) : (
                  <AuthLogin onAuthSuccess={handleAuthSuccess} />
                )
              } 
            />
            <Route 
              path="/dashboard" 
              element={
                user && userType === 'trainer' ? (
                  <Dashboard />
                ) : (
                  <Navigate to="/login" replace />
                )
              } 
            />
            <Route 
              path="/super-admin" 
              element={
                user && userType === 'admin' ? (
                  <SuperAdmin />
                ) : (
                  <Navigate to="/login" replace />
                )
              } 
            />
            <Route path="/student/:token" element={<StudentWorkout />} />
            <Route path="/student/:token/diet" element={<StudentDiet />} />
            <Route path="/privacy-policy" element={<PrivacyPolicy />} />
            <Route path="/terms-of-service" element={<TermsOfService />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
