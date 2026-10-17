const { widgetProviderSource } = require('../withWidgetDeepLinks');

it.each([
  ['Nutrition', 'open-nutrition'],
  ['SmartCamera', 'open-camera'],
  ['Cycle', 'open-cycle'],
])('routes %s clicks without requiring the JS process', (name, action) => {
  const source = widgetProviderSource('com.werules.logger', name, action);
  expect(source).toContain(`class ${name}Provider : ExpoWidgetsAppWidgetProvider("${name}")`);
  expect(source).toContain(`Uri.parse("com.werules.logger://?action=${action}")`);
  expect(source).toContain('Intent.FLAG_ACTIVITY_NEW_TASK');
  expect(source).toContain(`== "${name}"`);
  expect(source).toContain('== "__expo_widgets_target_0"');
  expect(source).toContain('super.onReceive(context, intent)');
});
