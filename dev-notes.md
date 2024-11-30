## Roadmap
- Add workout reminders (notifications)
- Import and export workouts
- Add option to send messages on Telegram?
- Add 1RM calculation for creating workout
- Add option to finish a set with reps in reserve
- Integrate with fitness APIs (Google, etc)
- Add option to ask AI to improve workout
- Have some sort of queue to do OpenAI requests - save workout instantaneously and then do the request in the background
- https://chatgpt.com/c/47f4cf63-9dac-4062-9b72-ab10d15587f3
- Do this: https://developer.android.com/develop/background-work/services/foreground-services / https://chatgpt.com/c/b0d13e6a-a4f1-4b97-8f26-a107d9f250fe / https://stackoverflow.com/questions/72330535/use-foreground-service-with-expo-and-react-native
- Calculate next workout based on previous workout without openai
- https://chatgpt.com/c/60d19d49-09e2-4f06-8823-d48648f9e2b2
- https://chatgpt.com/c/25e878c6-fabb-461f-aaaf-afa92f0978a9 <- add/remove feature of edit data passing along to the next set
- https://chatgpt.com/c/b0d52136-f94f-4ba3-9074-05e39ec7581b <- translate release notes
- https://chatgpt.com/c/80cd7d56-0921-4909-aa63-6ac7a6274b87 <- calculate ideal body weight
- https://chatgpt.com/c/66e89ae5-5200-800f-8a59-23c1fc601a1b <- integration with Spotify
- Menstruation: https://v0.dev/chat/dQ4ZSQUjqn1 / https://chatgpt.com/c/66e89f27-2074-800f-bbca-2421ac307359
- Form https://docs.google.com/forms/d/1aHENPk6R2-WkT9SbVDL_cDRGhHp9V66GYnX20bTz3lk/edit
- Spreadsheet https://docs.google.com/spreadsheets/d/1yW8r-X05Isjhwl9v5Lh6fgcR5_uwVbqOSjvC3Zd_LdQ/edit?usp=sharing

## Notifications
- https://medium.com/@uncledev/local-push-notifications-in-react-native-using-expo-without-a-backend-c14114faed0f
- https://docs.expo.dev/versions/latest/sdk/notifications/#present-the-notification-to-the-user

## BLE
- https://stormotion.io/blog/how-to-create-an-app-for-fitness-devices-in-react-native/

## Roadmap for Production
- Make current workout buttons more cute
- Add more feature to the chat
- Add option to add macros when creating a recent workout
- https://github.com/marketplace/actions/upload-android-release-to-play-store look into this
- https://medium.com/@vontonnie/automating-success-github-actions-workflow-for-android-app-deployment-908095d53b97 <- this too

## Known Bugs
- https://github.com/expo/expo/issues/16084

## Performance
- Add health connect - https://github.com/matinzd/react-native-health-connect/issues/50#issuecomment-1965922702
- https://github.com/expo/router/discussions/464 / https://reactnavigation.org/docs/use-focus-effect / https://reactnavigation.org/docs/use-is-focused/
- https://www.reddit.com/r/reactnative/comments/18x6vic/navigation_how_to_achieve_quick_transitions_when/

## Done
- Import past workouts
- Add workout to calendar
- Update UI to use react-native-paper
- Add created_at and deleted_at fields to database
- Integrate with Sentry for error tracking
- Update prompt to use lifting experience
- Calculate workout volume
  - https://chatgpt.com/c/eae375af-8df7-4f51-8be0-803648aa9ce4
  - https://chatgpt.com/c/9bb8b417-a422-4cc5-bc2b-7cfb98f5a420
- Theming
  - https://chatgpt.com/c/9a34ae5d-b71e-48e8-92fe-fad71b3adcdf
  - https://chatgpt.com/c/0463eae4-72dd-4517-8f06-23321d256126

## Resources
- https://thenounproject.com/icon/avatar-6860572/


## Rest API
https://openfoodfacts.github.io/openfoodfacts-server/api/ref-v2/#get-/api/v2/search
https://github.com/blopa/musclog-api
