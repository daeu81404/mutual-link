import {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
} from "react";
import { useWeb3Auth } from "./Web3AuthContext";
import { Spin } from "antd";

interface AuthContextType {
  isLoggedIn: boolean;
  userInfo: {
    hospital: string;
    department: string;
    name: string;
    role?: "admin" | "user";
    email: string;
    publicKey?: string;
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

  useEffect(() => {
    const initAuth = async () => {
      if (!web3auth) return;

      const storedUserInfo = localStorage.getItem("userInfo");
      const storedIsLoggedIn = localStorage.getItem("isLoggedIn");
      const isWeb3Connected = await checkConnection();

      if (storedUserInfo && storedIsLoggedIn && isWeb3Connected) {
        setUserInfo(JSON.parse(storedUserInfo));
        setIsLoggedIn(true);
      } else {
        setIsLoggedIn(false);
        setUserInfo(null);
        localStorage.removeItem("isLoggedIn");
        localStorage.removeItem("userInfo");
      }
      setIsLoading(false);
    };

    initAuth();
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
  };

  const logout = () => {
    setIsLoggedIn(false);
    setUserInfo(null);
    localStorage.removeItem("isLoggedIn");
    localStorage.removeItem("userInfo");
  };

  return (
    <AuthContext.Provider value={{ isLoggedIn, userInfo, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export { AuthProvider, useAuth };
