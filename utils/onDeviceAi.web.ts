export type OnDeviceMessage = { role: 'user' | 'assistant'; content: string };

export async function isOnDeviceAiCapable(): Promise<boolean> {
  return false;
}

export async function isOnDeviceAiAvailable(): Promise<boolean> {
  return false;
}

export async function sendOnDeviceMessage(
  _messages: OnDeviceMessage[],
  _systemPrompt?: string
): Promise<string> {
  return '';
}
