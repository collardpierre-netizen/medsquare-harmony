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
import EspaceDetail from "./pages/EspaceDetail";
import Activites from "./pages/Activites";
import ActiviteDetail from "./pages/ActiviteDetail";
import Contact from "./pages/Contact";
import Login from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import DashboardRouter from "./pages/dashboard/DashboardRouter";
import Profile from "./pages/dashboard/Profile";
import Bookings from "./pages/dashboard/Bookings";
import Activities from "./pages/dashboard/Activities";
import Documents from "./pages/dashboard/Documents";
import MyRooms from "./pages/dashboard/MyRooms";
import AdminPractitioners from "./pages/dashboard/AdminPractitioners";
import AdminRooms from "./pages/dashboard/AdminRooms";
import AdminBookings from "./pages/dashboard/AdminBookings";
import MyRegistrations from "./pages/dashboard/MyRegistrations";
import AdminAnalytics from "./pages/dashboard/AdminAnalytics";
import AdminSiteSettings from "./pages/dashboard/AdminSiteSettings";
import DailyExport from "./pages/dashboard/DailyExport";
import PractitionerGuide from "./pages/dashboard/PractitionerGuide";
import LegalDocuments from "./pages/dashboard/LegalDocuments";
import AdminLegalDocuments from "./pages/dashboard/AdminLegalDocuments";
import NotFound from "./pages/NotFound";
import Reviews from "./pages/dashboard/Reviews";
import QnA from "./pages/dashboard/QnA";
import GuestRegistration from "./pages/GuestRegistration";
import Widget from "./pages/Widget";
import ScrollToTop from "./components/ScrollToTop";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <ScrollToTop />
          <Routes>
            {/* Public pages */}
            <Route path="/" element={<Index />} />
            <Route path="/centre" element={<Centre />} />
            <Route path="/praticiens" element={<Praticiens />} />
            <Route path="/praticiens/:id" element={<PraticienDetail />} />
            <Route path="/espaces" element={<Espaces />} />
            <Route path="/espaces/:id" element={<EspaceDetail />} />
            <Route path="/activites" element={<Activites />} />
            <Route path="/activites/:id" element={<ActiviteDetail />} />
            <Route path="/mon-inscription" element={<GuestRegistration />} />
            <Route path="/widget/:id" element={<Widget />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/login" element={<Login />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />

            {/* Protected dashboard - routes to patient or practitioner based on role */}
            <Route path="/dashboard" element={<ProtectedRoute><DashboardRouter /></ProtectedRoute>} />
            <Route path="/dashboard/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/dashboard/registrations" element={<ProtectedRoute><MyRegistrations /></ProtectedRoute>} />

            {/* Protected practitioner-only pages */}
            <Route path="/dashboard/bookings" element={<ProtectedRoute allowedRoles={["practitioner"]}><Bookings /></ProtectedRoute>} />
            <Route path="/dashboard/activities" element={<ProtectedRoute allowedRoles={["practitioner"]}><Activities /></ProtectedRoute>} />
            <Route path="/dashboard/rooms" element={<ProtectedRoute allowedRoles={["practitioner"]}><MyRooms /></ProtectedRoute>} />
            <Route path="/dashboard/documents" element={<ProtectedRoute allowedRoles={["practitioner"]}><Documents /></ProtectedRoute>} />
            <Route path="/dashboard/export" element={<ProtectedRoute allowedRoles={["practitioner"]}><DailyExport /></ProtectedRoute>} />
            <Route path="/dashboard/guide" element={<ProtectedRoute allowedRoles={["practitioner"]}><PractitionerGuide /></ProtectedRoute>} />
            <Route path="/dashboard/legal-documents" element={<ProtectedRoute allowedRoles={["practitioner"]}><LegalDocuments /></ProtectedRoute>} />
            <Route path="/dashboard/reviews" element={<ProtectedRoute allowedRoles={["practitioner"]}><Reviews /></ProtectedRoute>} />

            {/* Protected admin pages */}
            <Route path="/dashboard/admin/practitioners" element={<ProtectedRoute requireAdmin><AdminPractitioners /></ProtectedRoute>} />
            <Route path="/dashboard/admin/rooms" element={<ProtectedRoute requireAdmin><AdminRooms /></ProtectedRoute>} />
            <Route path="/dashboard/admin/bookings" element={<ProtectedRoute requireAdmin><AdminBookings /></ProtectedRoute>} />
            <Route path="/dashboard/admin/analytics" element={<ProtectedRoute requireAdmin><AdminAnalytics /></ProtectedRoute>} />
            <Route path="/dashboard/admin/site-settings" element={<ProtectedRoute requireAdmin><AdminSiteSettings /></ProtectedRoute>} />
            <Route path="/dashboard/admin/legal-documents" element={<ProtectedRoute requireAdmin><AdminLegalDocuments /></ProtectedRoute>} />

            {/* Catch-all */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
