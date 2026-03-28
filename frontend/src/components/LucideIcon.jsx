import React from 'react';
import * as Icons from 'lucide-react';

/**
 * Lucide React 图标包装器
 * 使用示例: <LucideIcon name="Home" size={24} />
 */
const LucideIcon = ({ name, size = 24, color = '#1d2a33', className = '' }) => {
  const IconComponent = Icons[name];
  
  if (!IconComponent) {
    console.warn(`Icon "${name}" not found in lucide-react`);
    return null;
  }

  return (
    <IconComponent 
      size={size} 
      color={color} 
      className={className}
      strokeWidth={2}
    />
  );
};

export default LucideIcon;

// 常用图标集合 - 便捷导出
export const IconNames = {
  // 导航
  Home: 'Home',
  MapPin: 'MapPin',
  User: 'User',
  Settings: 'Settings',
  Search: 'Search',
  Menu: 'Menu',
  X: 'X',
  ChevronRight: 'ChevronRight',
  ChevronLeft: 'ChevronLeft',
  ArrowRight: 'ArrowRight',
  
  // 社交和用户
  Users: 'Users',
  LogOut: 'LogOut',
  LogIn: 'LogIn',
  UserPlus: 'UserPlus',
  
  // 媒体
  Camera: 'Camera',
  Image: 'Image',
  Imageplus: 'ImagePlus',
  Video: 'Video',
  
  // 常见操作
  Plus: 'Plus',
  Minus: 'Minus',
  Check: 'Check',
  AlertCircle: 'AlertCircle',
  Info: 'Info',
  
  // 位置和地图
  Navigation: 'Navigation',
  Navigation2: 'Navigation2',
  Compass: 'Compass',
  Pin: 'Pin',
  
  // 时间和日期
  Clock: 'Clock',
  Calendar: 'Calendar',
  
  // 其他
  Heart: 'Heart',
  Share2: 'Share2',
  Download: 'Download',
  Upload: 'Upload',
  MessageSquare: 'MessageSquare',
};
