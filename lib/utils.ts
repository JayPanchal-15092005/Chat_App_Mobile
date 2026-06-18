export function getAvatarUrl(name: string | undefined, avatar: string | undefined | null): string {
  if (avatar) return avatar;
  const encodedName = encodeURIComponent(name || "User");
  return `https://ui-avatars.com/api/?name=${encodedName}&background=random`;
}
