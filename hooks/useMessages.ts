import { useApi } from "@/lib/axios";
import { queryClient } from "@/lib/queryClient";
import type { Message, MessageSender } from "@/types";
import { useQuery } from "@tanstack/react-query";

export const useMessages = (chatId: string) => {
  const { apiWithAuth } = useApi();

  return useQuery({
    queryKey: ["messages", chatId],
    queryFn: async (): Promise<Message[]> => {
      const { data } = await apiWithAuth<Message[]>({
        method: "GET",
        url: `/messages/chat/${chatId}`,
      });

      // Preserve any local optimistic/in-flight messages that have not yet been confirmed by the server
      const existing = queryClient.getQueryData<Message[]>(["messages", chatId]) || [];
      const pending = existing.filter((m) => m._id.startsWith("temp-"));
      if (pending.length === 0) return data;

      // Filter out pending messages that already appear in server data
      const unconfirmedPending = pending.filter((tempMsg) => {
        const tempSenderId =
          typeof tempMsg.sender === "string"
            ? tempMsg.sender
            : (tempMsg.sender as MessageSender)._id;

        return !data.some((m) => {
          const mSenderId =
            typeof m.sender === "string"
              ? m.sender
              : (m.sender as MessageSender)._id;
          return mSenderId === tempSenderId && m.text === tempMsg.text;
        });
      });

      return [...data, ...unconfirmedPending];
    },
    enabled: !!chatId,
    staleTime: 1000 * 60 * 5, // 5 minutes (real-time messages arrive via WebSocket)
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
};
