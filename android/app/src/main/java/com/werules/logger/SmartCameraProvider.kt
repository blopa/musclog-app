package com.werules.logger

import android.content.Context
import android.content.Intent
import android.net.Uri
import expo.modules.widgets.ExpoWidgetsAppWidgetProvider

class SmartCameraProvider : ExpoWidgetsAppWidgetProvider("SmartCamera") {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action == "expo.modules.widgets.ACTION_WIDGET_INTERACTION" &&
        intent.getStringExtra("expo.modules.widgets.extra.SOURCE") == "SmartCamera" &&
        intent.getStringExtra("expo.modules.widgets.extra.TARGET") == "__expo_widgets_target_0") {
      context.startActivity(Intent(Intent.ACTION_VIEW,
        Uri.parse("com.werules.logger://?action=open-camera"))
        .setPackage(context.packageName).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
      return
    }
    super.onReceive(context, intent)
  }
}
