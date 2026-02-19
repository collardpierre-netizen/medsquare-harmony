import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import PatientDashboardLayout from "@/pages/dashboard/PatientDashboard";
import { ReactNode } from "react";

const SmartDashboardLayout = ({ children }: { children: ReactNode }) => {
  const { roles, isAdmin } = useAuth();
  const isPatient = roles.includes("patient") && !roles.includes("practitioner") && !isAdmin;

  if (isPatient) {
    return <PatientDashboardLayout>{children}</PatientDashboardLayout>;
  }

  return <DashboardLayout>{children}</DashboardLayout>;
};

export default SmartDashboardLayout;
