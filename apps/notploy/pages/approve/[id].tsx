import { validateRequest } from "@notploy/server";
import type { GetServerSidePropsContext } from "next";
import { useRouter } from "next/router";
import type { ReactElement } from "react";
import { useState } from "react";
import { toast } from "sonner";
import { OnboardingLayout } from "@/components/layouts/onboarding-layout";
import { AlertBlock } from "@/components/shared/alert-block";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import { approveSecurityKeyQrLogin } from "@/lib/webauthn-two-factor";

/**
 * Phone side of the QR sign-in: a session already signed in to the account
 * approves the pending sign-in of another device. Opening the link is not
 * enough — the approval is an explicit action.
 */
const ApproveSignIn = () => {
	const router = useRouter();
	const requestId = typeof router.query.id === "string" ? router.query.id : "";
	const [isApproving, setIsApproving] = useState(false);
	const [approved, setApproved] = useState(false);

	const handleApprove = async () => {
		if (!requestId) return;

		setIsApproving(true);
		try {
			const { status, error } = await approveSecurityKeyQrLogin(requestId);
			if (error || status !== "approved") {
				toast.error(
					error?.message ??
						"This sign-in request expired. Ask the other device for a new QR code.",
				);
				return;
			}
			setApproved(true);
		} finally {
			setIsApproving(false);
		}
	};

	return (
		<>
			<div className="flex flex-col space-y-2 text-center">
				<h1 className="text-2xl font-semibold tracking-tight">
					Approve sign-in
				</h1>
				<p className="text-sm text-muted-foreground">
					Another device is signing in to your Notploy account. Approve it only
					if you started that sign-in.
				</p>
			</div>
			<CardContent className="p-0">
				{approved ? (
					<AlertBlock type="success">
						Approved. You can return to the other device.
					</AlertBlock>
				) : (
					<Button
						className="w-full"
						isLoading={isApproving}
						disabled={!requestId}
						onClick={handleApprove}
					>
						Approve this sign-in
					</Button>
				)}
			</CardContent>
		</>
	);
};

ApproveSignIn.getLayout = (page: ReactElement) => {
	return <OnboardingLayout>{page}</OnboardingLayout>;
};

export default ApproveSignIn;

export async function getServerSideProps(context: GetServerSidePropsContext) {
	const { user } = await validateRequest(context.req);

	// Approving needs a session of the account: sign in on this device first.
	if (!user) {
		return {
			redirect: {
				destination: "/",
				permanent: false,
			},
		};
	}

	return { props: {} };
}
