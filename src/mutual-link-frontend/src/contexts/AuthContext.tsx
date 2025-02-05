import {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
} from "react";
import { useWeb3Auth } from "./Web3AuthContext";
import { Spin, message } from "antd";
import { subscribeToReferralUpdates } from "../firebase/notification";

interface AuthContextType {
  isLoggedIn: boolean;
  userInfo: {
    hospital: string;
    department: string;
    name: string;
    role?: "admin" | "user";
    email: string;
    phone: string;
    publicKey?: string;
    privateKey?: string;
    id?: string;
  } | null;
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
  const [userInfo, setUserInfo] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const { checkConnection, web3auth } = useWeb3Auth();
  const [unsubscribeNotifications, setUnsubscribeNotifications] = useState<
    (() => void) | null
  >(null);

  // 알림 구독 시작
  const startNotificationSubscription = (email: string) => {
    console.log("알림 구독 시작:", email);
    const unsubscribe = subscribeToReferralUpdates(email, (notification) => {
      console.log("알림 수신:", notification);
      // 여기서 알림 처리 (예: 안트디자인 메시지 표시)
      message.info(`진료의뢰 상태가 변경되었습니다: ${notification.status}`);
    });
    setUnsubscribeNotifications(() => unsubscribe);
  };

  // 알림 구독 종료
  const stopNotificationSubscription = () => {
    if (unsubscribeNotifications) {
      console.log("알림 구독 종료");
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
        // 저장된 사용자 정보가 있으면 알림 구독 시작
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

    // 컴포넌트 언마운트 시 알림 구독 해제
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
    console.log("login");
    setIsLoggedIn(true);
    setUserInfo(userData);
    localStorage.setItem("isLoggedIn", "true");
    localStorage.setItem("userInfo", JSON.stringify(userData));

    // 로그인 시 알림 구독 시작
    if (userData.email) {
      startNotificationSubscription(userData.email);
    }
  };

  const logout = () => {
    setIsLoggedIn(false);
    setUserInfo(null);
    localStorage.removeItem("isLoggedIn");
    localStorage.removeItem("userInfo");
    // 로그아웃 시 알림 구독 종료
    stopNotificationSubscription();
  };

  return (
    <AuthContext.Provider value={{ isLoggedIn, userInfo, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export { AuthProvider, useAuth };
