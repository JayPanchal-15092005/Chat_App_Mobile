import { AppRegistry } from 'react-native';
import { getMessaging, setBackgroundMessageHandler } from '@react-native-firebase/messaging';
import { displayIncomingCallViaCallKeep } from './hooks/useCallKeep';
import 'expo-router/entry';

// Register background handler for FCM
setBackgroundMessageHandler(getMessaging(), async remoteMessage => {
  console.log('[FCM] Message handled in the background!', remoteMessage);
  
  if (remoteMessage.data?.type === 'incoming-call') {
    // Only process it if we haven't shown it recently
    displayIncomingCallViaCallKeep({
      callerId: remoteMessage.data.callerId,
      callerName: remoteMessage.data.callerName,
      callerAvatar: remoteMessage.data.callerAvatar,
      callType: remoteMessage.data.callType,
      callId: remoteMessage.data.callId,
    });
  }
});
