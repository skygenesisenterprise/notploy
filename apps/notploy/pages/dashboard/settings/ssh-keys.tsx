import type { GetServerSideProps } from "next";

const SSHKeysRedirect = () => null;

export default SSHKeysRedirect;

export const getServerSideProps: GetServerSideProps = async () => ({
	redirect: {
		destination: "/dashboard/settings/servers",
		permanent: false,
	},
});
