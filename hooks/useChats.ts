import { useApi } from "@/lib/axios";
import type { Chat } from "@/types";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export const useChats = () => {
  const { apiWithAuth } = useApi();

  return useQuery({
    queryKey: ["chats"],
    queryFn: async () => {
      const { data } = await apiWithAuth<Chat[]>({
        method: "GET",
        url: "/chats",
      });
      return data;
    },
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30_000),
  });
};

export const useGetOrCreateChat = () => {
  const { apiWithAuth } = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (participantId: string) => {
      const { data } = await apiWithAuth<Chat>({
        method: "POST",
        url: `/chats/with/${participantId}`,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chats"] });
    },
  });
};

export const useCreateGroupChat = () => {
  const { apiWithAuth } = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: { name: string; participantIds: string[]; avatar?: string }) => {
      const { data } = await apiWithAuth<Chat>({
        method: "POST",
        url: "/chats/group",
        data: payload,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chats"] });
    },
  });
};

export const useAddGroupMembers = () => {
  const { apiWithAuth } = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ chatId, memberIds }: { chatId: string; memberIds: string[] }) => {
      const { data } = await apiWithAuth<Chat>({
        method: "PATCH",
        url: `/chats/${chatId}/members`,
        data: { memberIds },
      });
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["chats"] });
      queryClient.invalidateQueries({ queryKey: ["chatDetails", variables.chatId] });
    },
  });
};

export const useLeaveGroupChat = () => {
  const { apiWithAuth } = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (chatId: string) => {
      const { data } = await apiWithAuth({
        method: "PATCH",
        url: `/chats/${chatId}/leave`,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chats"] });
    },
  });
};

export const useChatDetails = (chatId: string) => {
  const { apiWithAuth } = useApi();

  return useQuery({
    queryKey: ["chatDetails", chatId],
    queryFn: async () => {
      const { data } = await apiWithAuth<Chat>({
        method: "GET",
        url: `/chats/${chatId}`,
      });
      return data;
    },
    enabled: !!chatId,
  });
};
