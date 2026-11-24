Pod::Spec.new do |s|
  s.name           = 'OnDeviceAi'
  s.version        = '0.1.0'
  s.summary        = 'Availability reasons for Apple Intelligence and file helpers for downloaded models.'
  s.description    = 'Local Expo module: SystemLanguageModel availability, streamed SHA-256, backup exclusion.'
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
