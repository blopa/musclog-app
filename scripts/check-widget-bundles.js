const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');

// Exercise the actual serialized functions against Expo's isolated runtime, not React mocks.
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'musclog-widget-check-'));
try {
  for (const platform of ['android', 'ios']) {
    const registryPath = path.join(temporary, `${platform}.json`);
    const runtimePath = path.join(temporary, `${platform}.js`);
    for (const [script, output] of [
      ['build-layout-registry.mjs', registryPath],
      ['build-bundle.mjs', runtimePath],
    ]) {
      execFileSync(
        process.execPath,
        [require.resolve(`expo-widgets/scripts/${script}`), process.cwd(), platform, output],
        { stdio: 'inherit' }
      );
    }

    const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8')).widgets;
    assert.deepEqual(Object.keys(registry).sort(), ['Nutrition', 'SmartCamera']);
    const context = vm.createContext({ console });
    vm.runInContext(fs.readFileSync(runtimePath, 'utf8'), context);
    for (const [name, widget] of Object.entries(registry)) {
      context.__expoWidgetLayout = vm.runInContext(`(${widget.layout})`, context);
      const render = (props) => {
        context.props = props;
        return vm.runInContext(
          '__expoWidgetRender(props, {widgetFamily: "systemSmall", colorScheme: "dark"})',
          context
        );
      };

      const initial = render(widget.initialProps);
      assert.ok(initial.type, `${platform}/${name} has an initial layout`);
      if (platform === 'android') {
        assert.equal(
          initial.props.target,
          '__expo_widgets_target_0',
          'Native shortcut routing must match the root target'
        );
      }

      const populated = {
        ...widget.initialProps,
        message: '',
        calories: '987',
        calorieTarget: '/ 2000 kcal',
        calorieProgress: 0.49,
        macros: [{ label: 'Protein', value: '42 g', progress: 0.5, color: '#abcdef' }],
        imageUri: 'file:///shared/camera.png',
      };
      const rendered = JSON.stringify(render(populated));
      assert.ok(rendered.includes(name === 'Nutrition' ? '987' : 'camera.png'));
      if (name === 'Nutrition') {
        assert.ok(rendered.includes('42 g'));
        assert.ok(rendered.includes('#abcdef'));
        assert.ok(
          !JSON.stringify(
            render({ ...populated, message: 'Refresh', calories: '—', macros: [] })
          ).includes('987')
        );
      }

      console.log(`Verified ${platform}/${name}: initial, populated, and isolated rendering`);
    }
  }
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}
