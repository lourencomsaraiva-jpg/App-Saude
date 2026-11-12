import { notFound, redirect } from "next/navigation";
import { isISODate, todayInTz } from "@/lib/calc/dates";
import { DayScreen } from "../../day-screen";

export default async function DayPage({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  if (!isISODate(date)) notFound();
  if (date === todayInTz()) redirect("/");
  return <DayScreen date={date} />;
}
