// Web3AuthContext.tsx
import { createContext, useContext, useState, useEffect } from "react";
import {
  CHAIN_NAMESPACES,
  IProvider,
  WALLET_ADAPTERS,
  WEB3AUTH_NETWORK,
} from "@web3auth/base";
import { Web3AuthNoModal } from "@web3auth/no-modal";
import { EthereumPrivateKeyProvider } from "@web3auth/ethereum-provider";
import { AuthAdapter } from "@web3auth/auth-adapter";
import { ec as EC } from "elliptic";

const ec = new EC("secp256k1");

const web3AuthClientId =
  "BAiwYWZI6UbKwvnkFOnDmW27ptYa_0lCAxK3WzeSQePLw7d_EPQHRFEwCi3RC0EdC0sw1qJz809n6o95fmBCook";
const googleOAuthClientId =
  "972164722537-af0c02i3ekqatav51dfulppn8ptp9qu3.apps.googleusercontent.com";

interface Web3AuthContextType {
  provider: IProvider | null;
  web3auth: Web3AuthNoModal | null;
  loginWithGoogle: () => Promise<{
    connected: boolean | null;
    publicKey: string | null;
    privateKey: string | null;
    email: string | null;
  }>;
  logout: () => Promise<void>;
  checkConnection: () => Promise<boolean>;
}

const chainConfig = {
  chainNamespace: CHAIN_NAMESPACES.EIP155,
  chainId: "0xaa36a7",
  rpcTarget: "https://rpc.ankr.com/eth_sepolia",
  displayName: "Ethereum Sepolia Testnet",
  blockExplorerUrl: "https://sepolia.etherscan.io",
  ticker: "ETH",
  tickerName: "Ethereum",
  logo: "https://cryptologos.cc/logos/ethereum-eth-logo.png",
};

const Web3AuthContext = createContext<Web3AuthContextType | null>(null);

export const Web3AuthProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [provider, setProvider] = useState<IProvider | null>(null);
  const [web3auth, setWeb3auth] = useState<Web3AuthNoModal | null>(null);

  // 기존 useWeb3Auth의 초기화 로직
  useEffect(() => {
    const init = async () => {
      console.log("init start");
      try {
        const privateKeyProvider = new EthereumPrivateKeyProvider({
          config: { chainConfig },
        });

        const web3authInstance = new Web3AuthNoModal({
          clientId: web3AuthClientId,
          web3AuthNetwork: WEB3AUTH_NETWORK.SAPPHIRE_DEVNET,
          privateKeyProvider,
        });

        const authAdapter = new AuthAdapter({
          adapterSettings: {
            loginConfig: {
              google: {
                verifier: "mutual-link",
                typeOfLogin: "google",
                clientId: googleOAuthClientId,
              },
            },
          },
          privateKeyProvider,
        });

        web3authInstance.configureAdapter(authAdapter);
        await web3authInstance.init();

        setWeb3auth(web3authInstance);
        setProvider(web3authInstance.provider);
      } catch (error) {
        console.error(error);
      }
    };
    init();
  }, []);

  // 기존 useWeb3Auth의 메서드들
  const loginWithGoogle = async () => {
    try {
      if (!web3auth) {
        throw new Error("web3auth not initialized");
      }

      if (web3auth.connected) {
        const privateKey = (await web3auth.provider?.request({
          method: "eth_private_key",
        })) as string;

        // 개인키로부터 공개키 생성
        const keyPair = ec.keyFromPrivate(privateKey.replace("0x", ""), "hex");
        const publicKey = keyPair.getPublic("hex");

        const userInfo = await web3auth.getUserInfo();
        return {
          connected: true,
          publicKey: publicKey,
          privateKey: privateKey,
          email: userInfo.email || null,
        };
      }

      const web3authProvider = await web3auth.connectTo(WALLET_ADAPTERS.AUTH, {
        loginProvider: "google",
      });
      setProvider(web3authProvider);

      const privateKey = (await web3authProvider?.request({
        method: "eth_private_key",
      })) as string;

      // 개인키로부터 공개키 생성
      const keyPair = ec.keyFromPrivate(privateKey.replace("0x", ""), "hex");
      const publicKey = keyPair.getPublic("hex");

      const userInfo = await web3auth.getUserInfo();

      return {
        connected: web3auth.connected,
        publicKey: publicKey,
        privateKey: privateKey,
        email: userInfo.email || null,
      };
    } catch (error) {
      throw error;
    }
  };

  const logout = async () => {
    if (!web3auth) {
      console.error("web3auth가 초기화되지 않았습니다");
      return;
    }

    try {
      await web3auth.logout();
      setProvider(null);
    } catch (error) {
      console.error("로그아웃 실패:", error);
    }
  };

  const checkConnection = async () => {
    if (!web3auth) return false;
    return web3auth.connected;
  };

  return (
    <Web3AuthContext.Provider
      value={{
        provider,
        web3auth,
        loginWithGoogle,
        logout,
        checkConnection,
      }}
    >
      {children}
    </Web3AuthContext.Provider>
  );
};

export const useWeb3Auth = () => {
  const context = useContext(Web3AuthContext);
  if (!context) {
    throw new Error("useWeb3Auth must be used within a Web3AuthProvider");
  }
  return context;
};
