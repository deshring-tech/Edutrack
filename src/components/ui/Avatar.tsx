/**
 * MODULE: Avatar
 *
 * Purpose        Identify a person by initials and colour when there is no photo.
 * Responsibility Rendering only.
 *
 * A centre uploads no photographs of children — deliberately, since storing
 * images of minors adds a consent and retention obligation the product does not
 * need. Initials on a stable colour give the same at-a-glance recognition.
 */

interface AvatarProps {
  name: string;
  color: string;
  size?: number;
}

function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";

  const first = words[0]?.charAt(0) ?? "";
  const last = words.length > 1 ? (words[words.length - 1]?.charAt(0) ?? "") : "";
  return (first + last).toUpperCase() || "?";
}

export function Avatar({ name, color, size = 44 }: AvatarProps) {
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full font-semibold text-white"
      style={{
        width: size,
        height: size,
        background: color,
        fontSize: Math.round(size * 0.38),
      }}
      // The name is always rendered next to the avatar, so announcing the
      // initials again would just be noise for a screen reader.
      aria-hidden="true"
    >
      {initialsOf(name)}
    </div>
  );
}
