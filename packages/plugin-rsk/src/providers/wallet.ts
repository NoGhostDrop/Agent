import { type IAgentRuntime, type Memory, type Provider, type State, elizaLogger } from "@elizaos/core";
import axios from "axios";
import { Web3 } from "web3";
import { getRskConfig } from "../environment";
import NodeCache from "node-cache";

// 캐시 생성 (데이터를 5분 동안 저장)
const walletCache = new NodeCache({ stdTTL: 300 });

// 지갑 데이터 인터페이스
interface WalletData {
  address: string;
  balance: string;
  transactions: number;
  uniqueInteractions: number;
  firstTransactionDate: string | null;
  walletAgeInDays: number | null;
}

// 지갑 정보 가져오기
async function getWalletInfo(address: string, rpcUrl: string): Promise<WalletData> {
  const web3 = new Web3(rpcUrl);
  
  try {
    // 캐시된 데이터 확인
    const cachedData = walletCache.get<WalletData>(address);
    if (cachedData) {
      return cachedData;
    }

    // 지갑 잔액 확인
    const balanceWei = await web3.eth.getBalance(address);
    const balance = Web3.utils.fromWei(balanceWei, "ether");
    
    // 지갑 거래 내역 가져오기
    // 실제 거래 내역은 블록 탐색기 API를 사용해야 하지만,
    // 여기서는 간단히 구현합니다.
    const latestBlockNumber = await web3.eth.getBlockNumber();
    
    // 마지막 1000개 블록에서 해당 주소의 거래 내역 찾기 (간소화된 버전)
    let transactions = 0;
    let uniqueAddresses = new Set<string>();
    let firstTransactionBlock = null;
    
    // 실제 구현에서는 블록 탐색기 API 사용 권장
    const startBlock = Math.max(0, latestBlockNumber - 1000);
    
    for (let i = startBlock; i <= latestBlockNumber; i += 10) {
      try {
        const block = await web3.eth.getBlock(i, true);
        if (block && block.transactions) {
          for (const tx of block.transactions) {
            if (typeof tx === 'object') {
              if (tx.from && tx.from.toLowerCase() === address.toLowerCase()) {
                transactions++;
                if (tx.to) uniqueAddresses.add(tx.to.toLowerCase());
                if (!firstTransactionBlock || i < firstTransactionBlock) {
                  firstTransactionBlock = i;
                }
              }
              
              if (tx.to && tx.to.toLowerCase() === address.toLowerCase()) {
                transactions++;
                if (tx.from) uniqueAddresses.add(tx.from.toLowerCase());
                if (!firstTransactionBlock || i < firstTransactionBlock) {
                  firstTransactionBlock = i;
                }
              }
            }
          }
        }
      } catch (error) {
        elizaLogger.error(`Error fetching block ${i}:`, error);
      }
    }
    
    // 첫 트랜잭션 날짜 및 지갑 나이 계산
    let firstTransactionDate = null;
    let walletAgeInDays = null;
    
    if (firstTransactionBlock) {
      try {
        const block = await web3.eth.getBlock(firstTransactionBlock);
        if (block && block.timestamp) {
          const blockTimestamp = Number(block.timestamp) * 1000; // to milliseconds
          firstTransactionDate = new Date(blockTimestamp).toISOString();
          
          const now = Date.now();
          walletAgeInDays = Math.floor((now - blockTimestamp) / (1000 * 60 * 60 * 24));
        }
      } catch (error) {
        elizaLogger.error("Error getting first transaction date:", error);
      }
    }
    
    const walletData: WalletData = {
      address,
      balance,
      transactions,
      uniqueInteractions: uniqueAddresses.size,
      firstTransactionDate,
      walletAgeInDays,
    };
    
    // 데이터 캐싱
    walletCache.set(address, walletData);
    
    return walletData;
  } catch (error) {
    elizaLogger.error("Error fetching wallet info:", error);
    throw error;
  }
}

// 지갑 정보 프로바이더
export const walletProvider: Provider = {
  get: async (runtime: IAgentRuntime, message: Memory, state?: State): Promise<string> => {
    try {
      // 현재 메시지에서 지갑 주소 추출
      const text = message.content.text.toLowerCase();
      
      // 지갑 주소 패턴 찾기 (0x로 시작하는 42자리 16진수)
      const addressMatch = text.match(/0x[a-f0-9]{40}/i);
      
      if (!addressMatch) {
        // message의 content 객체에서 지갑 주소 찾기
        const walletAddress = message.content.walletAddress || 
                            message.content.address ||
                            (message.content.data && message.content.data.walletAddress);
        
        if (!walletAddress) {
          return "지갑 주소를 찾을 수 없습니다.";
        }
        
        const config = await getRskConfig(runtime);
        const walletInfo = await getWalletInfo(walletAddress, config.RPC_URL);
        
        return `
지갑 정보:
- 주소: ${walletInfo.address}
- 잔액: ${walletInfo.balance} RSK
- 트랜잭션 수: ${walletInfo.transactions}
- 고유 상호작용 수: ${walletInfo.uniqueInteractions}
- 첫 트랜잭션 날짜: ${walletInfo.firstTransactionDate || '알 수 없음'}
- 지갑 나이: ${walletInfo.walletAgeInDays ? `${walletInfo.walletAgeInDays}일` : '알 수 없음'}
        `.trim();
      }
      
      const address = addressMatch[0];
      const config = await getRskConfig(runtime);
      const walletInfo = await getWalletInfo(address, config.RPC_URL);
      
      return `
지갑 정보:
- 주소: ${walletInfo.address}
- 잔액: ${walletInfo.balance} RSK
- 트랜잭션 수: ${walletInfo.transactions}
- 고유 상호작용 수: ${walletInfo.uniqueInteractions}
- 첫 트랜잭션 날짜: ${walletInfo.firstTransactionDate || '알 수 없음'}
- 지갑 나이: ${walletInfo.walletAgeInDays ? `${walletInfo.walletAgeInDays}일` : '알 수 없음'}
      `.trim();
    } catch (error) {
      elizaLogger.error("Error in wallet provider:", error);
      return "지갑 정보를 가져오는 중 오류가 발생했습니다.";
    }
  }
};

export default walletProvider; 