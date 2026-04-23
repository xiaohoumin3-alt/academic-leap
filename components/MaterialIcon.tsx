/**
 * Material Symbol Icon Component
 *
 * 使用 Google Material Symbols Outlined 图标库
 * https://fonts.google.com/icons
 *
 * @example
 * <MaterialIcon icon="trending_up" />
 * <MaterialIcon icon="trending_up" filled />
 * <MaterialIcon icon="trending_up" className="text-primary" size={24} />
 */

interface MaterialIconProps {
  icon: string;
  filled?: boolean;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

export const MaterialIcon: React.FC<MaterialIconProps> = ({
  icon,
  filled = false,
  size = 24,
  className = '',
  style = {},
}) => {
  const mergedStyle = {
    fontSize: `${size}px`,
    lineHeight: '1',
    ...style,
  } as React.CSSProperties;

  return (
    <span
      className={`material-symbols-outlined ${filled ? 'filled' : ''} ${className}`}
      style={mergedStyle}
    >
      {icon}
    </span>
  );
};

export default MaterialIcon;
