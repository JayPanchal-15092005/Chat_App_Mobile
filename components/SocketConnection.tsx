import { useSocketStore } from "@/lib/socket";
import { useAuth } from "@clerk/clerk-expo";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useCallStore } from "@/lib/callStore";

const SocketConnection = () => {
  const { getToken, isSignedIn } = useAuth();
  const queryClient = useQueryClient();
  const connect = useSocketStore((state) => state.connect);
  const disconnect = useSocketStore((state) => state.disconnect);

  useEffect(() => {
    if (isSignedIn) {
      getToken().then((token) => {
        if (token) {
          connect(token, queryClient);
          // Always init listeners when connect is called.
          // initCallListeners is idempotent and safely removes old listeners first.
          useCallStore.getState().initCallListeners();
        }
      });
    } else {
      useCallStore.getState()._cleanup();
      disconnect();
    }

    return () => {
      useCallStore.getState()._cleanup();
      disconnect();
    };
  }, [isSignedIn, connect, disconnect, getToken, queryClient]);

  return null;
};

export default SocketConnection;
