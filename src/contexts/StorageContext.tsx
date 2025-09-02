/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useCallback, useContext, useMemo } from "react";
import { ethers } from "ethers";
import { useWeb3 } from "./Web3Context";
import {
  Batcher,
  getFlowContract,
  Indexer,
  KvClient,
  ZgFile,
  type Value,
} from "@0glabs/0g-ts-sdk";

interface StorageContextProps {
  uploadFile: (filePath: string) => Promise<
    | {
        rootHash: string | null | undefined;
        txHash: { txHash: string; rootHash: string };
      }
    | undefined
  >;
  downloadFile: (rootHash: string, outputPath: string) => Promise<void>;
  uploadToKV: (
    streamId: string,
    key: string,
    value: string
  ) => Promise<{ txHash: string; rootHash: string }>;
  downloadFromKV: (streamId: string, key: string) => Promise<Value | null>;
}

const StorageContext = createContext<StorageContextProps>(
  {} as StorageContextProps
);

export const StorageContextProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const { signer } = useWeb3();
  const indexer = useMemo(() => new Indexer(process.env.INDEXER_RPC!), []);

  const uploadFile = useCallback(
    async (filePath: string) => {
      if (!signer) return;

      // Create file object from file path
      const file = await ZgFile.fromFilePath(filePath);

      // Generate Merkle tree for verification
      const [tree, treeErr] = await file.merkleTree();
      if (treeErr !== null) {
        throw new Error(`Error generating Merkle tree: ${treeErr}`);
      }

      // Upload to network
        const [tx, uploadErr] = await indexer.upload(
          file,
          process.env.RPC_URL!,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          signer as any
        );
      if (uploadErr !== null) {
        throw new Error(`Upload error: ${uploadErr}`);
      }

      await file.close();

      return { rootHash: tree?.rootHash(), txHash: tx };
    },
    [signer, indexer]
  );

  const downloadFile = useCallback(
    async (rootHash: string, outputPath: string) => {
      const err = await indexer.download(rootHash, outputPath, true);
      if (err !== null) {
        throw new Error(`Download error: ${err}`);
      }
    },
    [indexer]
  );

  const uploadToKV = useCallback(
    async (streamId: string, key: string, value: string) => {
      if (!signer) throw new Error("Signer not available");

      const [nodes, err] = await indexer.selectNodes(1);
      if (err !== null) {
        throw new Error(`Error selecting nodes: ${err}`);
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const flowContract = getFlowContract(signer.address, signer as any);

      const batcher = new Batcher(1, nodes, flowContract, process.env.RPC_URL!);

      const keyBytes = Uint8Array.from(Buffer.from(key, "utf-8"));
      const valueBytes = Uint8Array.from(Buffer.from(value, "utf-8"));
      batcher.streamDataBuilder.set(streamId, keyBytes, valueBytes);

      const [tx, batchErr] = await batcher.exec();
      if (batchErr !== null) {
        throw new Error(`Batch execution error: ${batchErr}`);
      }
      return tx;
    },
    [indexer, signer]
  );

  const downloadFromKV = useCallback(async (streamId: string, key: string) => {
    const kvClient = new KvClient(process.env.KV_CLIENT_IP!);
    const keyBytes: Uint8Array<ArrayBuffer> = Uint8Array.from(
      Buffer.from(key, "utf-8")
    );
    const value = await kvClient.getValue(
      streamId,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ethers.encodeBase64(keyBytes) as any
    );
    return value;
  }, []);

  const value = useMemo<StorageContextProps>(
    () => ({
      uploadFile,
      downloadFile,
      uploadToKV,
      downloadFromKV,
    }),
    [uploadFile, downloadFile, uploadToKV, downloadFromKV]
  );

  return (
    <StorageContext.Provider value={value}>{children}</StorageContext.Provider>
  );
};

export const useStorage = () => {
  const ctx = useContext(StorageContext);
  if (!ctx)
    throw new Error("useStorage must be used within StorageContextProvider");
  return ctx;
};
