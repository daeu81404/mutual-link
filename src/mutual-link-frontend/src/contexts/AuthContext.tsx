import {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
} from "react";
import { useWeb3Auth } from "./Web3AuthContext";
import { Spin, message } from "antd";
import {
  subscribeToReferralUpdates,
  saveNotificationHistory,
  getUnreadNotifications,
} from "../firebase/notification";

export interface Notification {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  referralId: string;
  status: string;
}

interface UserInfo {
  hospital: string;
  department: string;
  name: string;
  role?: "admin" | "user";
  email: string;
  phone: string;
  publicKey?: string;
  privateKey?: string;
  id?: string;
}

interface AuthContextType {
  isLoggedIn: boolean;
  userInfo: UserInfo | null;
  notifications: Notification[];
  unreadCount: number;
  markNotificationAsRead: (id: string) => void;
  clearNotifications: () => void;
  login: (userData: any) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

function AuthProvider({ children }: { children: ReactNode }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { checkConnection, web3auth } = useWeb3Auth();
  const [unsubscribeNotifications, setUnsubscribeNotifications] = useState<
    (() => void) | null
  >(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markNotificationAsRead = async (id: string) => {
    const notification = notifications.find((n) => n.id === id);
    if (notification && !notification.read && userInfo?.email) {
      try {
        // Firebase에 알림 확인 기록
        await saveNotificationHistory(userInfo.email, notification.referralId);

        // 상태 업데이트 - 해당 알림을 목록에서 제거
        setNotifications((prev) => prev.filter((n) => n.id !== id));
      } catch (error) {
        console.error("알림 확인 처리 실패:", error);
      }
    }
  };

  const clearNotifications = () => {
    setNotifications([]);
  };

  const loadUnreadNotifications = async (email: string) => {
    try {
      const unreadNotifications = await getUnreadNotifications(email);
      const formattedNotifications: Notification[] = unreadNotifications.map(
        (notification) => ({
          id: `${notification.referralId}-${notification.status}`,
          title:
            notification.status === "APPROVED"
              ? "의료정보 공유 수락"
              : "의료정보 공유 거절",
          message:
            notification.status === "APPROVED"
              ? `${notification.patientName} 환자가 의료정보 공유를 수락했습니다.`
              : `${notification.patientName} 환자가 의료정보 공유를 거절했습니다.`,
          timestamp: notification.updatedAt,
          read: false,
          referralId: notification.referralId,
          status: notification.status,
        })
      );
      setNotifications(formattedNotifications);
    } catch (error) {
      console.error("알림 로드 실패:", error);
      throw error;
    }
  };

  const startNotificationSubscription = (email: string) => {
    loadUnreadNotifications(email);

    const unsubscribe = subscribeToReferralUpdates(email, (referral) => {
      const notificationKey = `${referral.referralId}-${referral.status}`;
      const isDuplicate = notifications.some(
        (n) => `${n.referralId}-${n.status}` === notificationKey
      );

      const shouldCreateNotification =
        (referral.toEmail === email &&
          referral.status === "APPROVED" &&
          !isDuplicate) ||
        (referral.fromEmail === email &&
          referral.status === "REJECTED" &&
          !isDuplicate);

      if (shouldCreateNotification) {
        const newNotification: Notification = {
          id: `${referral.referralId}-${Date.now()}`,
          title:
            referral.status === "APPROVED"
              ? "의료정보 공유 수락"
              : "의료정보 공유 거절",
          message:
            referral.status === "APPROVED"
              ? `${referral.patientName} 환자가 의료정보 공유를 수락했습니다.`
              : `${referral.patientName} 환자가 의료정보 공유를 거절했습니다.`,
          timestamp: new Date().toISOString(),
          read: false,
          referralId: referral.referralId,
          status: referral.status,
        };

        setNotifications((prev) => {
          const isDuplicateInPrev = prev.some(
            (n) => `${n.referralId}-${n.status}` === notificationKey
          );

          if (isDuplicateInPrev) {
            return prev;
          }

          return [newNotification, ...prev];
        });
      }
    });
    setUnsubscribeNotifications(() => unsubscribe);
  };

  const stopNotificationSubscription = () => {
    if (unsubscribeNotifications) {
      unsubscribeNotifications();
      setUnsubscribeNotifications(null);
    }
  };

  useEffect(() => {
    const initAuth = async () => {
      if (!web3auth) return;

      const storedUserInfo = localStorage.getItem("userInfo");
      const storedIsLoggedIn = localStorage.getItem("isLoggedIn");
      const isWeb3Connected = await checkConnection();

      if (storedUserInfo && storedIsLoggedIn && isWeb3Connected) {
        const userData = JSON.parse(storedUserInfo);
        setUserInfo(userData);
        setIsLoggedIn(true);
        if (userData.email) {
          startNotificationSubscription(userData.email);
        }
      } else {
        setIsLoggedIn(false);
        setUserInfo(null);
        localStorage.removeItem("isLoggedIn");
        localStorage.removeItem("userInfo");
        stopNotificationSubscription();
      }
      setIsLoading(false);
    };

    initAuth();

    return () => {
      stopNotificationSubscription();
    };
  }, [web3auth, checkConnection]);

  if (isLoading) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
        }}
      >
        <Spin size="large" tip="로딩 중..." />
      </div>
    );
  }

  const login = (userData: any) => {
    setIsLoggedIn(true);
    setUserInfo(userData);
    localStorage.setItem("isLoggedIn", "true");
    localStorage.setItem("userInfo", JSON.stringify(userData));

    if (userData.email) {
      startNotificationSubscription(userData.email);
    }
  };

  const logout = () => {
    setIsLoggedIn(false);
    setUserInfo(null);
    setNotifications([]);
    localStorage.removeItem("isLoggedIn");
    localStorage.removeItem("userInfo");
    stopNotificationSubscription();
  };

  return (
    <AuthContext.Provider
      value={{
        isLoggedIn,
        userInfo,
        notifications,
        unreadCount,
        markNotificationAsRead,
        clearNotifications,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export { AuthProvider, useAuth };
