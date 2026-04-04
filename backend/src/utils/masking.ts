/** 아이 이름을 마스킹하여 AI API 전송 시 개인정보 보호 */
export function maskChildName(text: string, name: string): string {
  if (!name) return text;
  const regex = new RegExp(name, 'g');
  return text.replace(regex, '아이');
}
