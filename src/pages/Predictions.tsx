import { useNavigate } from "react-router";
import { MvpNotice } from "@/components/MvpNotice";

export default function Predictions() {
  const navigate = useNavigate();

  return (
    <div className="mx-auto w-full max-w-[1100px] p-4 sm:p-6 lg:p-8">
      <MvpNotice
        title="Predictions are disabled in the MVP"
        description="This screen still depended on local-only mock state, so it has been removed from the functional MVP pass. The stable version of the app now focuses on authentication, persisted conversations, and vault metadata tied to the authenticated user."
        actionLabel="Back to dashboard"
        onAction={() => navigate("/dashboard")}
      />
    </div>
  );
}
