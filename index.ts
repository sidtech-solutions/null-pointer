import 'expo-router/entry';

import { Platform } from 'react-native';
import { registerWidgetTaskHandler } from 'react-native-android-widget';

import { widgetTaskHandler } from './widgets/widget-task-handler';

// The home screen widget draws on a headless JS thread, so its handler is registered beside the app itself.
if (Platform.OS === 'android') {
  registerWidgetTaskHandler(widgetTaskHandler);
}
