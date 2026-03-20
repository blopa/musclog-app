const { withAndroidStyles } = require('@expo/config-plugins');

const withAndroidEdgeToEdgeStyles = (config) => {
  return withAndroidStyles(config, (config) => {
    const styles = config.modResults.resources.style || [];
    const appTheme = styles.find((style) => style.$.name === 'AppTheme');

    if (appTheme) {
      // Helper function to update or add an item
      const updateItem = (name, value) => {
        if (!appTheme.item) {
          appTheme.item = [];
        }
        const index = appTheme.item.findIndex((item) => item.$.name === name);
        if (index > -1) {
          appTheme.item[index]._ = value;
        } else {
          appTheme.item.push({ $: { name }, _: value });
        }
      };

      updateItem('android:statusBarColor', '@android:color/transparent');
      updateItem('android:navigationBarColor', '@android:color/transparent');
      updateItem('android:windowTranslucentStatus', 'true');
      updateItem('android:windowTranslucentNavigation', 'true');
    }

    return config;
  });
};

module.exports = withAndroidEdgeToEdgeStyles;
