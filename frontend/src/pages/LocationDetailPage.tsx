import { useEffect, useState } from "react";
import type { ReactElement } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { DotLoading } from "antd-mobile";
import LucideIcon from "../components/LucideIcon";
import { ImmersivePage, CardComponent } from "../components/SharedUI";

import { fetchLocationDetail, fetchKnowledgeBaseLocationImages } from "../api";

type LocationDetails = {
	introduction?: string;
	highlights?: string[];
	bestSeasonToVisit?: string;
	recommendedDuration?: string;
	accommodationTips?: string;
};

type LocationInfo = {
	province?: string;
	city?: string;
	district?: string;
	address?: string;
};

type FacilitiesInfo = {
	parking?: boolean;
	restroom?: boolean;
	foodAndDrink?: boolean;
	accommodation?: boolean;
	medicalService?: boolean;
};

type TicketInfo = {
	price?: string;
	openingHours?: string;
	bookingTips?: string;
};

type TransportationInfo = {
	byAir?: string;
	byTrain?: string;
	byBus?: string;
	byBoat?: string;
};

type SectionsInfo = {
	highlightsTitle?: string;
	galleryTitle?: string;
	visitInfoTitle?: string;
	locationTitle?: string;
	transportationTitle?: string;
	facilitiesTitle?: string;
	ticketInfoTitle?: string;
};

type LocationDetail = {
	id?: number | string;
	name?: string;
	slug?: string;
	category?: string;
	description?: string;
	latitude?: number;
	longitude?: number;
	details?: LocationDetails;
	location?: LocationInfo;
	facilities?: FacilitiesInfo;
	ticketInfo?: TicketInfo;
	transportation?: TransportationInfo;
	sections?: SectionsInfo;
};

export default function LocationDetailPage(): ReactElement {
	const { id } = useParams<{ id: string }>();
	const navigate = useNavigate();
	const locationState = useLocation();
	const [item, setItem] = useState<LocationDetail | null>(null);
	const [galleryImages, setGalleryImages] = useState<string[]>([]);
	const [loading, setLoading] = useState<boolean>(true);

	useEffect(() => {
		async function loadLocation(): Promise<void> {
			setLoading(true);
			try {
				const locationData = (await fetchLocationDetail(id || "")) as LocationDetail;
				setItem(locationData);

				if (locationData) {
					let images: string[] = [];
					if (locationData.slug) {
						images = (await fetchKnowledgeBaseLocationImages(locationData.slug)) as string[];
					}
					setGalleryImages(images);
				}
			} catch (error) {
				console.error("Failed to load location detail:", error);
			} finally {
				setLoading(false);
			}
		}

		if (id) {
			void loadLocation();
		}
	}, [id]);

	const handleBack = (): void => {
		const state = locationState.state as { fromPanel?: string } | null;
		const fromPanel = state?.fromPanel;
		if (fromPanel === "overview" || fromPanel === "global") {
			navigate("/home", { state: { openPanel: fromPanel } });
		} else {
			navigate(-1);
		}
	};

	if (loading) {
		return (
			<ImmersivePage>
				<div className="flex-1 flex justify-center items-center h-48">
					<DotLoading color="white" />
				</div>
			</ImmersivePage>
		);
	}

	if (!item) {
		return (
			<ImmersivePage>
				<CardComponent variant="glass" className="text-center mt-6">
					<p className="text-white/80">景点信息加载失败</p>
				</CardComponent>
			</ImmersivePage>
		);
	}

	const {
		details = {},
		location = {},
		facilities = {},
		ticketInfo = {},
		transportation = {},
		sections = {},
	} = item;

	const bgImage = galleryImages.length > 0 ? galleryImages[0] : "/images/lugu-hero.png";

	return (
		<ImmersivePage bgImage={bgImage} className="page-fade-in pb-[env(safe-area-inset-bottom)]">
			<div className="mb-4 pt-2 -mx-2">
				<button
					type="button"
					className="px-2 py-1 inline-flex items-center text-white/90 hover:text-white transition-colors drop-shadow-md"
					onClick={handleBack}
				>
					<LucideIcon name="ChevronLeft" size={20} className="mr-1" /> 返回
				</button>
			</div>

			<div className="mb-6">
				<div className="text-amber-200 text-sm font-bold tracking-wider uppercase mb-1 drop-shadow-md text-shadow-sm">
					Location Detail
				</div>
				<h1 className="text-3xl font-bold text-white drop-shadow-lg m-0 text-shadow">{item.name}</h1>
			</div>

			<CardComponent variant="glass" className="mb-4 backdrop-blur-xl">
				<div className="flex items-center justify-between mb-3 border-b border-white/10 pb-3">
					<span className="px-3 py-1 bg-amber-400/25 text-amber-100 rounded-full text-xs font-medium border border-amber-300/40">
						{item.category || "景点"}
					</span>
					<span className="text-amber-100/80 text-xs flex items-center">
						<LucideIcon name="MapPin" size={12} className="mr-1 text-amber-200" />
						{item.latitude?.toFixed(4)}, {item.longitude?.toFixed(4)}
					</span>
				</div>
				<p className="text-white/90 leading-relaxed text-justify mb-0">{item.description}</p>
				{details.introduction && (
					<div className="mt-4 text-sm text-white/70 leading-relaxed border-t border-white/10 pt-3">
						{details.introduction}
					</div>
				)}
			</CardComponent>

			{details.highlights && details.highlights.length > 0 && (
				<CardComponent variant="glass" className="mb-4 backdrop-blur-xl">
					<h2 className="text-lg font-bold text-white mb-4 flex items-center">
						<LucideIcon name="Sparkles" size={18} className="mr-2 text-amber-200" />
						{sections.highlightsTitle || "景点亮点"}
					</h2>
					<div className="flex flex-wrap gap-2">
						{details.highlights.map((highlight, idx) => (
							<span
								key={idx}
								className="px-3 py-1.5 bg-white/10 backdrop-blur border border-white/20 text-white rounded-full text-sm shadow-sm transition hover:bg-white/20"
							>
								{highlight}
							</span>
						))}
					</div>
				</CardComponent>
			)}

			<CardComponent variant="glass" className="mb-4 backdrop-blur-xl">
				<h2 className="text-lg font-bold text-white mb-4 flex items-center">
					<LucideIcon name="Image" size={18} className="mr-2 text-amber-200" />
					{sections.galleryTitle || "景点图片"}
				</h2>
				{galleryImages.length > 0 ? (
					<div className="grid grid-cols-2 gap-3">
						{galleryImages.map((src, idx) => (
							<div key={idx} className="aspect-square rounded-xl overflow-hidden shadow-smooth">
								<img
									src={src}
									alt={`${item.name} 图片 ${idx + 1}`}
									className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
								/>
							</div>
						))}
					</div>
				) : (
					<div className="text-center py-6 bg-white/5 rounded-xl border border-white/10">
						<LucideIcon name="ImageOff" size={32} className="mx-auto text-amber-100/80 mb-2" />
						<p className="text-white/60 text-sm">当前景点图片待补充</p>
						<p className="text-white/40 text-xs mt-1">/knowledge-base/locations/{item.slug || item.id}/images/</p>
					</div>
				)}
			</CardComponent>

			{(details.bestSeasonToVisit || details.recommendedDuration) && (
				<CardComponent variant="glass" className="mb-4 backdrop-blur-xl">
					<h2 className="text-lg font-bold text-white mb-4 flex items-center">
						<LucideIcon name="Compass" size={18} className="mr-2 text-amber-200" />
						{sections.visitInfoTitle || "游览信息"}
					</h2>
					<div className="space-y-3 text-sm text-white/80">
						{details.bestSeasonToVisit && (
							<div className="flex items-start">
								<span className="font-semibold text-white min-w-[70px]">最佳季节：</span>
								<span className="flex-1">{details.bestSeasonToVisit}</span>
							</div>
						)}
						{details.recommendedDuration && (
							<div className="flex items-start">
								<span className="font-semibold text-white min-w-[70px]">推荐时长：</span>
								<span className="flex-1">{details.recommendedDuration}</span>
							</div>
						)}
						{details.accommodationTips && (
							<div className="flex items-start">
								<span className="font-semibold text-white min-w-[70px]">住宿建议：</span>
								<span className="flex-1">{details.accommodationTips}</span>
							</div>
						)}
					</div>
				</CardComponent>
			)}

			{(location.province || location.city || location.address) && (
				<CardComponent variant="glass" className="mb-4 backdrop-blur-xl">
					<h2 className="text-lg font-bold text-white mb-4 flex items-center">
						<LucideIcon name="Map" size={18} className="mr-2 text-amber-200" />
						{sections.locationTitle || "位置信息"}
					</h2>
					<div className="space-y-2 text-sm text-white/80">
						{location.province && (
							<div className="flex items-center">
								<div className="w-[70px] flex items-center text-amber-100/80">
									<LucideIcon name="MapPin" size={14} className="mr-1 text-amber-200" /> 省份
								</div>
								<div>{location.province}</div>
							</div>
						)}
						{location.city && (
							<div className="flex items-center">
								<div className="w-[70px] flex items-center text-amber-100/80">
									<LucideIcon name="Building2" size={14} className="mr-1 text-amber-200" /> 城市
								</div>
								<div>
									{location.city} {location.district}
								</div>
							</div>
						)}
						{location.address && (
							<div className="flex items-start mt-3 pt-3 border-t border-white/10">
								<div className="w-[70px] flex items-center text-amber-100/80">
									<LucideIcon name="Navigation" size={14} className="mr-1 text-amber-200" /> 地址
								</div>
								<div className="flex-1 font-medium text-white">{location.address}</div>
							</div>
						)}
					</div>
				</CardComponent>
			)}

			{Object.keys(transportation).length > 0 && (
				<CardComponent variant="glass" className="mb-4 backdrop-blur-xl">
					<h2 className="text-lg font-bold text-white mb-4 flex items-center">
						<LucideIcon name="CarFront" size={18} className="mr-2 text-amber-200" />
						{sections.transportationTitle || "交通方式"}
					</h2>
					<div className="space-y-4 text-sm text-white/80">
						{transportation.byAir && (
							<div>
								<div className="flex items-center text-white font-medium mb-1">
									<LucideIcon name="Plane" size={16} className="mr-1.5 text-amber-200" /> 飞机
								</div>
								<div className="pl-6">{transportation.byAir}</div>
							</div>
						)}
						{transportation.byTrain && (
							<div>
								<div className="flex items-center text-white font-medium mb-1">
									<LucideIcon name="Train" size={16} className="mr-1.5 text-amber-200" /> 火车
								</div>
								<div className="pl-6">{transportation.byTrain}</div>
							</div>
						)}
						{transportation.byBus && (
							<div>
								<div className="flex items-center text-white font-medium mb-1">
									<LucideIcon name="Bus" size={16} className="mr-1.5 text-amber-200" /> 大巴
								</div>
								<div className="pl-6">{transportation.byBus}</div>
							</div>
						)}
						{transportation.byBoat && (
							<div>
								<div className="flex items-center text-white font-medium mb-1">
									<LucideIcon name="Ship" size={16} className="mr-1.5 text-amber-200" /> 游船
								</div>
								<div className="pl-6">{transportation.byBoat}</div>
							</div>
						)}
					</div>
				</CardComponent>
			)}

			{Object.keys(facilities).length > 0 && (
				<CardComponent variant="glass" className="mb-4 backdrop-blur-xl">
					<h2 className="text-lg font-bold text-white mb-4 flex items-center">
						<LucideIcon name="Coffee" size={18} className="mr-2 text-amber-200" />
						{sections.facilitiesTitle || "设施服务"}
					</h2>
					<div className="grid grid-cols-2 gap-3 text-sm">
						{facilities.parking !== undefined && (
							<div className="flex items-center bg-white/5 p-2 rounded-lg border border-white/5">
								<div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center mr-2">
									<LucideIcon name="ParkingSquare" size={16} className="text-amber-100" />
								</div>
								<span className="flex-1 text-white/80">停车场</span>
								{facilities.parking ? (
									<LucideIcon name="CheckCircle2" size={16} className="text-emerald-300" />
								) : (
									<LucideIcon name="XCircle" size={16} className="text-rose-300/80" />
								)}
							</div>
						)}
						{facilities.restroom !== undefined && (
							<div className="flex items-center bg-white/5 p-2 rounded-lg border border-white/5">
								<div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center mr-2">
									<LucideIcon name="Users" size={16} className="text-amber-100" />
								</div>
								<span className="flex-1 text-white/80">卫生间</span>
								{facilities.restroom ? (
									<LucideIcon name="CheckCircle2" size={16} className="text-emerald-300" />
								) : (
									<LucideIcon name="XCircle" size={16} className="text-rose-300/80" />
								)}
							</div>
						)}
						{facilities.foodAndDrink !== undefined && (
							<div className="flex items-center bg-white/5 p-2 rounded-lg border border-white/5">
								<div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center mr-2">
									<LucideIcon name="Utensils" size={16} className="text-amber-100" />
								</div>
								<span className="flex-1 text-white/80">餐饮</span>
								{facilities.foodAndDrink ? (
									<LucideIcon name="CheckCircle2" size={16} className="text-emerald-300" />
								) : (
									<LucideIcon name="XCircle" size={16} className="text-rose-300/80" />
								)}
							</div>
						)}
						{facilities.accommodation !== undefined && (
							<div className="flex items-center bg-white/5 p-2 rounded-lg border border-white/5">
								<div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center mr-2">
									<LucideIcon name="BedDouble" size={16} className="text-amber-100" />
								</div>
								<span className="flex-1 text-white/80">住宿</span>
								{facilities.accommodation ? (
									<LucideIcon name="CheckCircle2" size={16} className="text-emerald-300" />
								) : (
									<LucideIcon name="XCircle" size={16} className="text-rose-300/80" />
								)}
							</div>
						)}
						{facilities.medicalService !== undefined && (
							<div className="flex items-center bg-white/5 p-2 rounded-lg border border-white/5">
								<div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center mr-2">
									<LucideIcon name="Stethoscope" size={16} className="text-amber-100" />
								</div>
								<span className="flex-1 text-white/80">医疗</span>
								{facilities.medicalService ? (
									<LucideIcon name="CheckCircle2" size={16} className="text-emerald-300" />
								) : (
									<LucideIcon name="XCircle" size={16} className="text-rose-300/80" />
								)}
							</div>
						)}
					</div>
				</CardComponent>
			)}

			{ticketInfo.price && (
				<CardComponent variant="glass" className="mb-6 backdrop-blur-xl">
					<h2 className="text-lg font-bold text-white mb-4 flex items-center">
						<LucideIcon name="Ticket" size={18} className="mr-2 text-amber-200" />
						{sections.ticketInfoTitle || "票务信息"}
					</h2>
					<div className="space-y-3 text-sm text-white/80">
						<div className="flex items-center">
							<span className="font-semibold text-white w-[70px]">门票：</span>
							<span className="text-amber-200 font-bold text-lg">{ticketInfo.price}</span>
						</div>
						{ticketInfo.openingHours && (
							<div className="flex items-center">
								<span className="font-semibold text-white w-[70px]">开放时间：</span>
								<span>{ticketInfo.openingHours}</span>
							</div>
						)}
						{ticketInfo.bookingTips && (
							<div className="flex items-start mt-3 pt-3 border-t border-white/10">
								<span className="font-semibold text-white w-[70px] mt-0.5">预订须知：</span>
								<span className="flex-1 leading-relaxed">{ticketInfo.bookingTips}</span>
							</div>
						)}
					</div>
				</CardComponent>
			)}
		</ImmersivePage>
	);
}
