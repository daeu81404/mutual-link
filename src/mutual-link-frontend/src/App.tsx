import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Home from "./pages/Home/Home";
import DoctorList from "./pages/DoctorList/DoctorList";
import MedicalData from "./pages/MedicalData/MedicalData";
import Login from "./pages/Login/Login";
import { AuthProvider } from "./contexts/AuthContext";
import { Web3AuthProvider } from "./contexts/Web3AuthContext";
import PrivateRoute from "./components/PrivateRoute";
import UserManagement from "./pages/UserManagement/UserManagement";
import HospitalManagement from "./pages/HospitalManagement/HospitalManagement";

function App() {
  return (
    <Web3AuthProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/login" element={<Login />} />
            <Route element={<PrivateRoute />}>
              <Route path="/home" element={<Home />}>
                <Route
                  index
                  element={<Navigate to="/home/doctor-list" replace />}
                />
                <Route path="doctor-list" element={<DoctorList />} />
                <Route
                  path="medical-data-send"
                  element={<MedicalData type="send" />}
                />
                <Route
                  path="medical-data-receive"
                  element={<MedicalData type="receive" />}
                />
                <Route
                  path="/home/user-management"
                  element={<UserManagement />}
                />
                <Route
                  path="/home/hospital-management"
                  element={<HospitalManagement />}
                />
              </Route>
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </Web3AuthProvider>
  );
}

export default App;
