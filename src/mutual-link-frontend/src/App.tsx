import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Home from "./pages/Home/Home";
import DoctorList from "./pages/DoctorList/DoctorList";
import ApprovalWaiting from "./pages/ApprovalWaiting/ApprovalWaiting";
import MedicalData from "./pages/MedicalData/MedicalData";
import Login from "./pages/Login/Login";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/home" element={<Home />}>
          <Route index element={<Navigate to="/home/doctor-list" replace />} />
          <Route path="doctor-list" element={<DoctorList />} />
          <Route path="approval-waiting" element={<ApprovalWaiting />} />
          <Route
            path="medical-data-send"
            element={<MedicalData type="send" />}
          />
          <Route
            path="medical-data-receive"
            element={<MedicalData type="receive" />}
          />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
