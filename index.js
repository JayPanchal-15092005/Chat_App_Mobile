import { AppRegistry } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import { displayIncomingCallViaCallKeep } from './hooks/useCallKeep';
import 'expo-router/entry';

// Register background handler for FCM
messaging().setBackgroundMessageHandler(async remoteMessage => {
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
