import { ExtensionStorage } from '@bacons/apple-targets';
import { Platform } from 'react-native';
import { requestPinWidget, requestWidgetUpdate } from 'react-native-android-widget';

import { laneColor, light } from '@/constants/theme';

import { cachedWidgetData, forgetWidgetData, loadWidgetData, type WidgetData } from './widget-data';

/** The app group the iOS widget reads from, and the key it reads; see targets/streak/StreakData.swift. */
const AppGroup = 'group.com.siddarthkay.nullpointer';
const StreakKey = 'streak';

/** Hands the numbers to the iOS widget through the app group and asks WidgetKit to redraw. */
function writeIosWidget(data: WidgetData | null): void {
  try {
    const storage = new ExtensionStorage(AppGroup);

    storage.set(StreakKey, data ? JSON.stringify({ ...data, laneColor: laneColor(light, data.lane) }) : undefined);
    ExtensionStorage.reloadWidget('streak');
  } catch {
    // No app group on this build; the widget keeps what it had.
  }
}

/** Redraws the home screen widget with fresh numbers; nothing on platforms without one. */
export function refreshStreakWidget(): void {
  if (Platform.OS === 'ios') {
    loadWidgetData()
      .then(writeIosWidget)
      .catch(() => {});

    return;
  }

  if (Platform.OS !== 'android') {
    return;
  }

  // Imported here so the widget tree, which only Android draws, stays out of the iOS bundle's startup path.
  const { streakWidget, StreakWidgetName } = require('../widgets/widget-task-handler') as typeof import('../widgets/widget-task-handler');

  requestWidgetUpdate({
    widgetName: StreakWidgetName,
    renderWidget: async (info) => {
      try {
        return streakWidget(await loadWidgetData(), info.height, info.width);
      } catch {
        return streakWidget(cachedWidgetData(), info.height, info.width);
      }
    },
    widgetNotFound: () => {},
  }).catch(() => {});
}

/** On sign-out the widget forgets the account and says so. */
export function clearStreakWidget(): void {
  forgetWidgetData();

  if (Platform.OS === 'ios') {
    writeIosWidget(null);

    return;
  }

  if (Platform.OS !== 'android') {
    return;
  }

  const { streakWidget, StreakWidgetName } = require('../widgets/widget-task-handler') as typeof import('../widgets/widget-task-handler');

  requestWidgetUpdate({ widgetName: StreakWidgetName, renderWidget: (info) => streakWidget(null, info.height, info.width), widgetNotFound: () => {} }).catch(() => {});
}

/** Asks the launcher to put the streak widget on the home screen; answers whether the launcher offered to. */
export async function offerStreakWidget(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return false;
  }

  const { StreakWidgetName } = require('../widgets/widget-task-handler') as typeof import('../widgets/widget-task-handler');

  try {
    return await requestPinWidget({ widgetName: StreakWidgetName });
  } catch {
    return false;
  }
}
