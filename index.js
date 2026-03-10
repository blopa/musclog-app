import 'expo-router/entry';

import { widgetTaskHandler } from './widgets/widget-task-handler';

// Ensure widgetTaskHandler is initialized
console.log('Widget Task Handler registered:', !!widgetTaskHandler);
