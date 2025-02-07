import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Home from "./pages/Home/Home";
import DoctorList from "./pages/DoctorList/DoctorList";
import MedicalData from "./pages/MedicalData/MedicalData";
import Login from "./pages/Login/Login";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { Web3AuthProvider } from "./contexts/Web3AuthContext";
import PrivateRoute from "./components/PrivateRoute";
import UserManagement from "./pages/UserManagement/UserManagement";
import HospitalManagement from "./pages/HospitalManagement/HospitalManagement";
import {
  Layout,
  Badge,
  Button,
  Modal,
  List,
  Typography,
  App as AntApp,
} from "antd";
import { BellOutlined } from "@ant-design/icons";
import { useState } from "react";

// 내부 컴포넌트: AuthProvider 내부에서 useAuth 사용
function AppContent() {
  const { notifications, unreadCount, markNotificationAsRead } = useAuth();
  const [isNotificationModalVisible, setIsNotificationModalVisible] =
    useState(false);

  const handleNotificationClick = (notificationId: string) => {
    markNotificationAsRead(notificationId);
  };

  return (
    <BrowserRouter>
      <Modal
        title={`알림 ${unreadCount > 0 ? `(${unreadCount})` : ""}`}
        open={isNotificationModalVisible}
        onCancel={() => setIsNotificationModalVisible(false)}
        footer={null}
        width={400}
      >
        <List
          dataSource={notifications}
          renderItem={(notification) => (
            <List.Item
              onClick={() => handleNotificationClick(notification.id)}
              style={{
                cursor: "pointer",
                backgroundColor: notification.read ? "white" : "#f0f7ff",
                padding: "12px",
                borderRadius: "4px",
                marginBottom: "8px",
                transition: "background-color 0.3s ease",
              }}
              className="notification-item"
            >
              <List.Item.Meta
                title={notification.title}
                description={
                  <>
                    <Typography.Text>{notification.message}</Typography.Text>
                    <br />
                    <Typography.Text
                      type="secondary"
                      style={{ fontSize: "12px" }}
                    >
                      {new Date(notification.timestamp).toLocaleString()}
                    </Typography.Text>
                  </>
                }
              />
            </List.Item>
          )}
          locale={{ emptyText: "새로운 알림이 없습니다" }}
          style={{ maxHeight: "400px", overflowY: "auto" }}
        />
      </Modal>

      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route element={<PrivateRoute />}>
          <Route
            path="/home"
            element={
              <Home
                notificationCount={unreadCount}
                onNotificationClick={() => setIsNotificationModalVisible(true)}
              />
            }
          >
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
            <Route path="/home/user-management" element={<UserManagement />} />
            <Route
              path="/home/hospital-management"
              element={<HospitalManagement />}
            />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

// 외부 컴포넌트: Provider 설정
function App() {
  return (
    <AntApp>
      <Web3AuthProvider>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </Web3AuthProvider>
    </AntApp>
  );
}

export default App;
