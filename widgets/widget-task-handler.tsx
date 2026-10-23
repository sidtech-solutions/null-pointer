// The widget library calls these as plain functions outside React's renderer, so the React Compiler must leave them alone.
'use no memo';

import type { WidgetRepresentation, WidgetTaskHandlerProps } from 'react-native-android-widget';

import { cachedWidgetData, loadWidgetData, type WidgetData } from '@/lib/widget-data';

import { StreakWidget } from './streak-widget';

export const StreakWidgetName = 'Streak';

export function streakWidget(data: WidgetData | null, height = 0, width = 320): WidgetRepresentation {
  return { light: <StreakWidget data={data} dark={false} height={height} width={width} />, dark: <StreakWidget data={data} dark height={height} width={width} /> };
}

/**
 * Runs when the launcher adds, resizes or periodically updates the widget,
 * headless, with no screen behind it. What was kept last time draws at once;
 * fresh numbers follow when devnull answers.
 */
export async function widgetTaskHandler(props: WidgetTaskHandlerProps): Promise<void> {
  if (props.widgetInfo.widgetName !== StreakWidgetName) {
    return;
  }

  switch (props.widgetAction) {
    case 'WIDGET_ADDED':
    case 'WIDGET_UPDATE':
    case 'WIDGET_RESIZED': {
      const { height, width } = props.widgetInfo;
      const cached = cachedWidgetData();

      if (cached) {
        props.renderWidget(streakWidget(cached, height, width));
      }

      try {
        props.renderWidget(streakWidget(await loadWidgetData(), height, width));
      } catch {
        if (!cached) {
          props.renderWidget(streakWidget(null, height, width));
        }
      }

      break;
    }
    default:
      break;
  }
}
