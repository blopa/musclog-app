Pod::Spec.new do |s|
  s.name           = 'ThemeAppIcon'
  s.version        = '0.1.0'
  s.summary        = 'Switches the launcher icon to match the selected Musclog theme.'
  s.description    = 'Local Expo module wrapping UIApplication alternate app icons.'
  s.author         = ''
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,mm,swift}"
end
