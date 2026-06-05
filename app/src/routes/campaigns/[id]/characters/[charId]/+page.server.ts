import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/** Legacy URL — redirect to canonical character route */
export const load: PageServerLoad = ({ params }) => {
	redirect(301, `/characters/${params.charId}`);
};
