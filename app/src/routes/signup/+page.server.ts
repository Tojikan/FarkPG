import { fail, redirect } from '@sveltejs/kit';
import type { Actions } from './$types';

export const actions: Actions = {
	default: async ({ request, locals }) => {
		const formData = await request.formData();
		const email = String(formData.get('email') ?? '').trim();
		const password = String(formData.get('password') ?? '');
		const displayName = String(formData.get('displayName') ?? '').trim();

		if (!email || !password) {
			return fail(400, { error: 'Email and password are required.' });
		}

		if (password.length < 6) {
			return fail(400, { error: 'Password must be at least 6 characters.' });
		}

		const { error } = await locals.supabase.auth.signUp({
			email,
			password,
			options: {
				data: displayName ? { display_name: displayName } : undefined
			}
		});

		if (error) {
			return fail(400, { error: error.message });
		}

		const { error: signInError } = await locals.supabase.auth.signInWithPassword({ email, password });
		if (signInError) {
			return {
				success: 'Account created. Check your email if confirmation is required, then log in.'
			};
		}

		redirect(303, '/campaigns');
	}
};
