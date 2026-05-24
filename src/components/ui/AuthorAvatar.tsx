interface AuthorAvatarProps {
  author: string;
}

export function AuthorAvatar({ author }: AuthorAvatarProps) {
  const initials = author
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div
      className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
      style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
    >
      {initials}
    </div>
  );
}
