import { todayInTz } from "@/lib/calc/dates";
import { DayScreen } from "./day-screen";

export const dynamic = "force-dynamic";

export default function TodayPage() {
  return <DayScreen date={todayInTz()} />;
}
