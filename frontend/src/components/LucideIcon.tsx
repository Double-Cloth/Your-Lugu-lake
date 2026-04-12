import type { ComponentType, ReactElement } from "react";
import * as LucideIcons from "lucide-react";
import type { LucideProps } from "lucide-react";

type LucideIconName = keyof typeof LucideIcons;

type LucideIconProps = LucideProps & {
	name: LucideIconName;
};

export const IconNames = {
	Home: "Home",
	MapPin: "MapPin",
	User: "User",
	Settings: "Settings",
	Search: "Search",
	Menu: "Menu",
	X: "X",
	ChevronRight: "ChevronRight",
	ChevronLeft: "ChevronLeft",
	ArrowRight: "ArrowRight",
	Users: "Users",
	LogOut: "LogOut",
	LogIn: "LogIn",
	UserPlus: "UserPlus",
	Camera: "Camera",
	Image: "Image",
	Imageplus: "ImagePlus",
	Video: "Video",
	Plus: "Plus",
	Minus: "Minus",
	Check: "Check",
	AlertCircle: "AlertCircle",
	Info: "Info",
	Navigation: "Navigation",
	Navigation2: "Navigation2",
	Compass: "Compass",
	Pin: "Pin",
	Clock: "Clock",
	Calendar: "Calendar",
	Heart: "Heart",
	Share2: "Share2",
	Download: "Download",
	Upload: "Upload",
	MessageSquare: "MessageSquare",
} as const;

export default function LucideIcon({ name, ...props }: LucideIconProps): ReactElement {
	const IconComponent = LucideIcons[name] as ComponentType<LucideProps> | undefined;

	if (!IconComponent) {
		const FallbackIcon = LucideIcons.HelpCircle as ComponentType<LucideProps>;
		return <FallbackIcon {...props} />;
	}

	return <IconComponent {...props} />;
}
