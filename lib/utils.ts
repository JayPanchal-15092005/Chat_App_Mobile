export function getAvatarUrl(name: string | undefined | null, avatar: string | undefined | null): string {
  if (avatar) return avatar;
  const encodedName = encodeURIComponent(name || "User");
  return `https://ui-avatars.com/api/?name=${encodedName}&background=random`;
}
