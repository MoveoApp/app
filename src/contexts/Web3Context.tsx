import React, { createContext, useContext, useMemo } from "react";
import { ethers } from "ethers";

interface Web3ContextProps {
  provider: ethers.JsonRpcProvider;
  signer: ethers.Wallet;
}

const Web3Context = createContext<Web3ContextProps>({} as Web3ContextProps);

export const Web3ContextProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const provider = useMemo(
    () => new ethers.JsonRpcProvider(process.env.RPC_URL!),
    []
  );
  const signer = useMemo(
    () => new ethers.Wallet(process.env.PRIVATE_KEY!, provider),
    [provider]
  );
  const value = useMemo<Web3ContextProps>(
    () => ({
      provider,
      signer,
    }),
    [provider, signer]
  );

  return <Web3Context.Provider value={value}>{children}</Web3Context.Provider>;
};

export const useWeb3 = () => {
  const ctx = useContext(Web3Context);
  if (!ctx) throw new Error("useWeb3 must be used within Web3ContextProvider");
  return ctx;
};
