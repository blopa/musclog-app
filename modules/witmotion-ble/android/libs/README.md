# Vendor SDK drop-in

Place `wit-sdk.aar` in this folder if you want to wire WitMotion's official Android SDK into this module.

The current plugin does not require it because it uses the Android BLE stack directly, but the build script
already picks up any `*.aar` files placed here.
