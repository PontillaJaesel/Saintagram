import { RecordedUserData } from "@/components/admin/recorded-user-data";

export default async function Page({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  return <RecordedUserData userId={userId} />;
}
