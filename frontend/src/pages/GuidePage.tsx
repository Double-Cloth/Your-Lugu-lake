import { useState } from "react";
import type { ReactElement } from "react";
import { Button, Card, Selector, Toast } from "antd-mobile";

import { generateRoute, getUserToken } from "../api";

type RouteRequest = {
	duration: string;
	preference: string;
	group_type: string;
};

type TimelineItem = {
	time: string;
	location: string;
	stay_minutes: number;
	highlight?: string;
};

type RouteResponse = {
	route?: {
		title?: string;
		timeline?: TimelineItem[];
	};
};

const durationOptions = [
	{ label: "半天", value: "half-day" },
	{ label: "一天", value: "one-day" },
];

const preferenceOptions = [
	{ label: "自然风光", value: "nature" },
	{ label: "人文历史", value: "culture" },
	{ label: "平衡体验", value: "mixed" },
];

const groupOptions = [
	{ label: "亲子", value: "family" },
	{ label: "情侣", value: "couple" },
	{ label: "朋友", value: "friends" },
	{ label: "独行", value: "solo" },
];

export default function GuidePage(): ReactElement {
	const [duration, setDuration] = useState<string[]>(["one-day"]);
	const [preference, setPreference] = useState<string[]>(["mixed"]);
	const [groupType, setGroupType] = useState<string[]>(["friends"]);
	const [timeline, setTimeline] = useState<TimelineItem[]>([]);
	const [title, setTitle] = useState<string>("");
	const [loading, setLoading] = useState<boolean>(false);

	async function handleGenerate(): Promise<void> {
		setLoading(true);
		try {
			const payload: RouteRequest = {
				duration: duration[0],
				preference: preference[0],
				group_type: groupType[0],
			};

			const result = (await generateRoute(
				payload,
				getUserToken() || "cookie-session"
			)) as RouteResponse;

			setTitle(result.route?.title || "推荐路线");
			setTimeline(Array.isArray(result.route?.timeline) ? result.route.timeline : []);
		} catch (error: any) {
			if (error?.response?.status === 401) {
				Toast.show({ content: "请先在“我的”页面登录游客账号" });
				return;
			}
			Toast.show({ content: "路线生成失败，请稍后再试" });
		} finally {
			setLoading(false);
		}
	}

	return (
		<div className="page-fade-in">
			<div className="hero-shell mb-3">
				<div className="hero-kicker">Smart Route</div>
				<h1 className="page-title m-0">AI 导览</h1>
				<p className="hero-copy">选择你的旅行偏好，生成专属泸沽湖时间轴线路。</p>
			</div>

			<Card className="card card-glass">
				<div className="text-sm text-white/80 leading-6 mb-2">时长</div>
				<Selector options={durationOptions} value={duration} onChange={setDuration} />

				<div className="text-sm text-white/80 leading-6 mt-4 mb-2">偏好</div>
				<Selector options={preferenceOptions} value={preference} onChange={setPreference} />

				<div className="text-sm text-white/80 leading-6 mt-4 mb-2">出行人群</div>
				<Selector options={groupOptions} value={groupType} onChange={setGroupType} />

				<Button color="primary" className="mt-4" loading={loading} block onClick={handleGenerate}>
					生成路线
				</Button>
			</Card>

			{timeline.length > 0 && (
				<Card className="card card-glass">
					<h3 className="m-0 text-white/95">{title}</h3>
					<div className="mt-3 space-y-3">
						{timeline.map((item, idx) => (
							<div
								key={`${item.time}-${item.location}-${idx}`}
								className="timeline-item"
								style={{ animationDelay: `${idx * 90}ms` }}
							>
								<div className="text-xs text-white/95">{item.time}</div>
								<div className="font-medium text-base">{item.location}</div>
								<div className="text-sm text-white/60">停留约 {item.stay_minutes} 分钟</div>
								{item.highlight && <div className="text-xs text-wood-500 mt-1">{item.highlight}</div>}
							</div>
						))}
					</div>
				</Card>
			)}
		</div>
	);
}
