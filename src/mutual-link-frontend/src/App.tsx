import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Home from "./pages/Home/Home";
import DoctorList from "./pages/DoctorList/DoctorList";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />}>
          <Route index element={<Navigate to="/doctor-list" replace />} />
          <Route path="doctor-list" element={<DoctorList />} />
          <Route path="approval-waiting" element={<div>승인대기</div>} />
          <Route
            path="medical-data-send"
            element={<div>진료데이터(송신)</div>}
          />
          <Route
            path="medical-data-receive"
            element={<div>진료데이터(수신)</div>}
          />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
