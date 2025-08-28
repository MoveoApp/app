import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  createZGComputeNetworkBroker,
  ZGComputeNetworkBroker,
} from "@0glabs/0g-serving-broker";
import { useWeb3 } from "./Web3Context";

interface AIContextProps {
  broker: ZGComputeNetworkBroker | undefined;
  setupAccount: (amount: number) => Promise<boolean>;
  depositOgFunds: (amount: number) => Promise<boolean>;
  withdrawOgFunds: (amount: number) => Promise<boolean>;
  getAccountBalance: () => Promise<
    undefined | { balance: bigint; available: bigint; user: string }
  >;
  ask: (question: string) => Promise<string | null>;
}

const AIContext = createContext<AIContextProps>({} as AIContextProps);

export const AIContextProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const { signer } = useWeb3();
  const [broker, setBroker] = useState<ZGComputeNetworkBroker>();

  useEffect(() => {
    const load = async () => {
      const b = await createZGComputeNetworkBroker(signer);
      setBroker(b);
    };

    if (signer) load();
  }, [signer]);

  const setupAccount = useCallback(
    async (amount: number) => {
      if (!broker) return false;
      await broker.ledger.addLedger(amount);
      await broker.inference.acknowledgeProviderSigner(
        process.env.PROVIDER_ADDRESS!
      );
      return true;
    },
    [broker]
  );

  const depositOgFunds = useCallback(
    async (amount: number) => {
      if (!broker) return false;
      await broker.ledger.depositFund(amount);
      return true;
    },
    [broker]
  );

  const withdrawOgFunds = useCallback(
    async (amount: number) => {
      if (!broker) return false;
      await broker.ledger.retrieveFund("inference", amount);
      return true;
    },
    [broker]
  );

  const getAccountBalance = useCallback(async () => {
    if (!broker) return;
    const account = await broker.ledger.getLedger();
    return {
      balance: account.totalBalance,
      available: account.availableBalance,
      user: account.user,
    };
  }, [broker]);

  const ask = useCallback(
    async (question: string) => {
      if (!broker) return null;

      const { endpoint, model } = await broker.inference.getServiceMetadata(
        process.env.PROVIDER_ADDRESS!
      );
      const headers = await broker.inference.getRequestHeaders(
        process.env.PROVIDER_ADDRESS!,
        question
      );

      const response = await fetch(`${endpoint}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({
          messages: [
            { role: "system", content: process.env.SYSTEM_PROMPT! },
            { role: "user", content: question },
          ],
          model: model,
        }),
      });

      const data = await response.json();
      const answer = data.choices[0].message.content;
      return answer as string;
    },
    [broker]
  );

  const value = useMemo<AIContextProps>(
    () => ({
      broker,
      setupAccount,
      depositOgFunds,
      withdrawOgFunds,
      getAccountBalance,
      ask,
    }),
    [
      broker,
      setupAccount,
      depositOgFunds,
      withdrawOgFunds,
      getAccountBalance,
      ask,
    ]
  );

  return <AIContext.Provider value={value}>{children}</AIContext.Provider>;
};

export const useAI = () => {
  const ctx = useContext(AIContext);
  if (!ctx) throw new Error("useAI must be used within AIContextProvider");
  return ctx;
};
