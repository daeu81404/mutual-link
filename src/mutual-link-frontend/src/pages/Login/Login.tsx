import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Layout, Typography, Button } from "antd";
import {
  CHAIN_NAMESPACES,
  IProvider,
  WALLET_ADAPTERS,
  WEB3AUTH_NETWORK,
} from "@web3auth/base";
import { EthereumPrivateKeyProvider } from "@web3auth/ethereum-provider";
import { Web3AuthNoModal } from "@web3auth/no-modal";
import { AuthAdapter } from "@web3auth/auth-adapter";

const { Content } = Layout;
const { Title } = Typography;

const web3AuthClientId =
  "BAiwYWZI6UbKwvnkFOnDmW27ptYa_0lCAxK3WzeSQePLw7d_EPQHRFEwCi3RC0EdC0sw1qJz809n6o95fmBCook";
const googleOAuthClientId =
  "972164722537-af0c02i3ekqatav51dfulppn8ptp9qu3.apps.googleusercontent.com";

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

const Login = () => {
  const [provider, setProvider] = useState<IProvider | null>(null);
  const [loggedIn, setLoggedIn] = useState(false);
  const [web3auth, setWeb3auth] = useState<Web3AuthNoModal | null>(null);

  const navigate = useNavigate();

  useEffect(() => {
    const init = async () => {
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

        if (web3authInstance.connected) {
          setLoggedIn(true);
        }
      } catch (error) {
        console.error(error);
      }
    };

    init();
  }, []);

  const handleGoogleLogin = async () => {
    if (!web3auth) {
      console.error("web3auth not initialized");
      return;
    }

    try {
      if (web3auth.connected) {
        await web3auth.logout();
      }

      const web3authProvider = await web3auth.connectTo(WALLET_ADAPTERS.AUTH, {
        loginProvider: "google",
      });
      setProvider(web3authProvider);

      if (web3auth.connected) {
        setLoggedIn(true);
        navigate("/home/doctor-list");
      }
    } catch (error) {
      console.error("Google 로그인 실패:", error);
    }
  };

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Content
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "24px",
        }}
      >
        <Title level={3}>Mutual-Link Admin</Title>
        <Button
          type="primary"
          onClick={handleGoogleLogin}
          style={{
            width: "300px",
            height: "40px",
            borderRadius: "8px",
          }}
        >
          Google Login
        </Button>
      </Content>
    </Layout>
  );
};

export default Login;
