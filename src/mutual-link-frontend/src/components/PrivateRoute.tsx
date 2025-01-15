import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useWeb3Auth } from "@/contexts/Web3AuthContext";

const PrivateRoute = () => {
  const { isLoggedIn } = useAuth();
  const { web3auth } = useWeb3Auth();

  if (!web3auth) {
    return <div>초기화 중...</div>; // 또는 로딩 스피너 컴포넌트
  }

  return isLoggedIn ? <Outlet /> : <Navigate to="/login" replace />;
};

export default PrivateRoute;
