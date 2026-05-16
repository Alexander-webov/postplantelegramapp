import {
  LayoutDashboard, Radio, Send, Clock, FileText,
  BarChart3, Settings, CreditCard, Briefcase, Shield,
} from 'lucide-react';

export interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  comingSoon?: boolean;
}

export const PRIMARY_NAV: NavItem[] = [
  { href: '/dashboard', label: 'Обзор', icon: LayoutDashboard },
  { href: '/dashboard/posts/new', label: 'Создать пост', icon: Send },
  { href: '/dashboard/queue', label: 'Очередь', icon: Clock },
];

export const SECONDARY_NAV: NavItem[] = [
  { href: '/dashboard/channels', label: 'Каналы', icon: Radio },
  { href: '/dashboard/advertisers', label: 'Рекламодатели', icon: Briefcase },
  { href: '/dashboard/templates', label: 'Шаблоны', icon: FileText },
  { href: '/dashboard/analytics', label: 'Аналитика', icon: BarChart3 },
];

export const FOOTER_NAV: NavItem[] = [
  { href: '/dashboard/billing', label: 'Тариф', icon: CreditCard },
  { href: '/dashboard/settings', label: 'Настройки', icon: Settings },
];

// Shown only to users with profiles.is_admin = true
export const ADMIN_NAV: NavItem[] = [
  { href: '/admin', label: 'Админка', icon: Shield },
];
