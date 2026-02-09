import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import Index from "./pages/Index";
import Centre from "./pages/Centre";
import Praticiens from "./pages/Praticiens";
import PraticienDetail from "./pages/PraticienDetail";
import Espaces from "./pages/Espaces";
import Activites from "./pages/Activites";
import ActiviteDetail from "./pages/ActiviteDetail";
import Contact from "./pages/Contact";
import Login from "./pages/Login";
import Dashboard from "./pages/dashboard/Dashboard";
import Profile from "./pages/dashboard/Profile";
import Bookings from "./pages/dashboard/Bookings";
import Activities from "./pages/dashboard/Activities";
import Documents from "./pages/dashboard/Documents";
import AdminPractitioners from "./pages/dashboard/AdminPractitioners";
import AdminRooms from "./pages/dashboard/AdminRooms";
import AdminBookings from "./pages/dashboard/AdminBookings";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Public pages */}
            <Route path="/" element={<Index />} />
            <Route path="/centre" element={<Centre />} />
            <Route path="/praticiens" element={<Praticiens />} />
            <Route path="/praticiens/:id" element={<PraticienDetail />} />
            <Route path="/espaces" element={<Espaces />} />
            <Route path="/activites" element={<Activites />} />
            <Route path="/activites/:id" element={<ActiviteDetail />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/login" element={<Login />} />

            {/* Protected practitioner pages */}
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/dashboard/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/dashboard/bookings" element={<ProtectedRoute><Bookings /></ProtectedRoute>} />
            <Route path="/dashboard/activities" element={<ProtectedRoute><Activities /></ProtectedRoute>} />
            <Route path="/dashboard/documents" element={<ProtectedRoute><Documents /></ProtectedRoute>} />

            {/* Protected admin pages */}
            <Route path="/dashboard/admin/practitioners" element={<ProtectedRoute requireAdmin><AdminPractitioners /></ProtectedRoute>} />
            <Route path="/dashboard/admin/rooms" element={<ProtectedRoute requireAdmin><AdminRooms /></ProtectedRoute>} />
            <Route path="/dashboard/admin/bookings" element={<ProtectedRoute requireAdmin><AdminBookings /></ProtectedRoute>} />

            {/* Catch-all */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
