import { useAuth } from "@/contexts/AuthContext";
import Dashboard from "./Dashboard";
import PatientDashboardLayout from "./PatientDashboard";
import PatientHome from "./PatientHome";

const DashboardRouter = () => {
  const { roles, isAdmin } = useAuth();

  const isPatient = roles.includes("patient") && !roles.includes("practitioner") && !isAdmin;

  if (isPatient) {
    return (
      <PatientDashboardLayout>
        <PatientHome />
      </PatientDashboardLayout>
    );
  }

  return <Dashboard />;
};

export default DashboardRouter;
